import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';

// 9h clear cash
const defaultTTLms = 9 * 60 * 60 * 1000;

interface CacheEntry {
  handle: DetachedRouteHandle;
  expiresAt: number;
}

export class KeepAliveRouteStrategy implements RouteReuseStrategy {
  private cache = new Map<string, CacheEntry>();
  private defaultTTLms = defaultTTLms;

  /** ตรวจว่าควร cache route นี้ไหม */
  private isKeepAlive(route: ActivatedRouteSnapshot): boolean {
    for (let r of route.pathFromRoot.reverse()) {
      if (r.routeConfig?.data?.['keepAlive']) return true;
    }
    return !!route.routeConfig?.data?.['keepAlive'];
  }

  /** ดึง TTL เฉพาะของ route ถ้ามี (data.keepAliveTTL) */
  private getTTL(route: ActivatedRouteSnapshot): number {
    for (let r of route.pathFromRoot.reverse()) {
      const ttl = r.routeConfig?.data?.['keepAliveTTL'];
      if (typeof ttl === 'number' && ttl > 0) return ttl;
    }
    return this.defaultTTLms;
  }

  /** สร้างคีย์เฉพาะ route */
  private getConfigPathKey(route: ActivatedRouteSnapshot): string {
    const parts: string[] = [];
    let r: ActivatedRouteSnapshot | null = route;
    while (r) {
      const p = r.routeConfig?.path;
      if (p) parts.unshift(p);
      r = r.parent ?? null;
    }
    const comp = route.routeConfig?.component?.toString() ?? '';
    return `${parts.join('/')}::${comp}`;
  }

  /** ลบ cache ที่หมดอายุ */
  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        // console.log(`[reuse] expired: ${key}`);
        this.cache.delete(key);
      }
    }
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const ok = !!route.routeConfig && this.isKeepAlive(route);
    // console.log('[reuse] shouldDetach', route.routeConfig?.path, ok);
    return ok;
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    if (!route.routeConfig || !handle) return;
    const key = this.getConfigPathKey(route);
    const ttl = this.getTTL(route);
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { handle, expiresAt });
    // console.log('[reuse] store', key, 'expires in', ttl / 1000 / 60, 'minutes');
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    this.purgeExpired();
    const key = this.getConfigPathKey(route);
    const entry = this.cache.get(key);
    const ok = !!entry && entry.expiresAt > Date.now();
    // console.log('[reuse] shouldAttach', key, ok);
    return ok;
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    this.purgeExpired();
    const key = this.getConfigPathKey(route);
    const entry = this.cache.get(key);
    if (!entry) return null;
    // console.log('[reuse] retrieve', key, !!entry);
    return entry.handle;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }
}
