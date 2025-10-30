import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';

// 9h
const defaultTTLms = 9 * 60 * 60 * 1000;

interface CacheEntry {
  handle: DetachedRouteHandle;
  expiresAt: number;
  siteKey: string; // << เก็บ site ที่สร้าง cache นี้
}

export class KeepAliveRouteStrategy implements RouteReuseStrategy {
  private cache = new Map<string, CacheEntry>();
  private currentSiteKey: string | null = null;
  private defaultTTLms = defaultTTLms;

  /** อนุญาต cache ถ้า route (ตัวเองหรือบรรพบุรุษ) มี data.keepAlive */
  private isKeepAlive(route: ActivatedRouteSnapshot): boolean {
    for (let r of route.pathFromRoot.reverse()) {
      if (r.routeConfig?.data?.['keepAlive']) return true;
    }
    return !!route.routeConfig?.data?.['keepAlive'];
  }

  /** TTL เฉพาะ route (data.keepAliveTTL) */
  private getTTL(route: ActivatedRouteSnapshot): number {
    for (let r of route.pathFromRoot.reverse()) {
      const ttl = r.routeConfig?.data?.['keepAliveTTL'];
      if (typeof ttl === 'number' && ttl > 0) return ttl;
    }
    return this.defaultTTLms;
  }

  /**
   * กำหนด siteKey:
   * 1) ถ้ามี data.keepAliveSite ให้ใช้ค่านั้น (ควบคุมได้แม่นสุด)
   * 2) มิฉะนั้น ใช้ path segment ระดับบนสุดที่ไม่ว่าง เช่น 'applications' | 'career' | 'interviews'
   */
  private getSiteKey(route: ActivatedRouteSnapshot): string {
    // (1) override ผ่าน data
    for (let r of route.pathFromRoot) {
      const site = r.routeConfig?.data?.['keepAliveSite'];
      if (typeof site === 'string' && site.trim()) return site;
    }
    // (2) หา path องค์ประกอบบนสุด
    const top = route.pathFromRoot.find(r => !!r.routeConfig?.path && r.routeConfig.path.trim().length > 0);
    return top?.routeConfig?.path ?? '__root__';
  }

  /** key แยก cache ต่อคอมโพเนนต์และเส้นทาง config */
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

  /** purge รายการที่หมดอายุ */
  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  /** ถ้า siteKey เปลี่ยน ให้ล้าง cache ทั้งหมด */
  private purgeIfSiteChanged(incomingSiteKey: string): void {
    if (this.currentSiteKey && this.currentSiteKey !== incomingSiteKey) {
      // เปลี่ยน site แล้ว เคลียร์ทั้งกอง
      this.cache.clear();
    }
    this.currentSiteKey = incomingSiteKey;
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const ok = !!route.routeConfig && this.isKeepAlive(route);
    return ok;
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    if (!route.routeConfig || !handle) return;
    const siteKey = this.getSiteKey(route);
    this.purgeIfSiteChanged(siteKey);

    const key = this.getConfigPathKey(route);
    const ttl = this.getTTL(route);
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, { handle, expiresAt, siteKey });
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    this.purgeExpired();

    const siteKey = this.getSiteKey(route);
    this.purgeIfSiteChanged(siteKey);

    const key = this.getConfigPathKey(route);
    const entry = this.cache.get(key);
    return !!entry && entry.expiresAt > Date.now() && entry.siteKey === siteKey;
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    this.purgeExpired();

    const siteKey = this.getSiteKey(route);
    this.purgeIfSiteChanged(siteKey);

    const key = this.getConfigPathKey(route);
    const entry = this.cache.get(key);
    if (!entry || entry.siteKey !== siteKey) return null;
    return entry.handle;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  /** เคลียร์ทั้งหมด */
  public clearAll(): void {
    this.cache.clear();
    this.currentSiteKey = null;
  }

  /** เคลียร์เฉพาะ site */
  public clearBySite(siteKey: string): void {
    for (const [k, entry] of this.cache) {
      if (entry.siteKey === siteKey) this.cache.delete(k);
    }
  }

  /** เคลียร์แบบกำหนดเองด้วยเงื่อนไข */
  public clearWhere(predicate: (key: string) => boolean): void {
    for (const k of Array.from(this.cache.keys())) {
      if (predicate(k)) this.cache.delete(k);
    }
  }
}
