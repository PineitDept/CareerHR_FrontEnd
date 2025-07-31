import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  private sidebarWidthSubject = new BehaviorSubject<number>(this.getSidebarWidth());
  sidebarWidth$ = this.sidebarWidthSubject.asObservable();

  setSidebarWidth(px: string) {
    sessionStorage.setItem('sidebarWidth', px);
    this.sidebarWidthSubject.next(parseInt(px, 10));
  }

  getSidebarWidth(): number {
    const raw = sessionStorage.getItem('sidebarWidth') || '190px';
    return parseInt(raw, 10);
  }
}
