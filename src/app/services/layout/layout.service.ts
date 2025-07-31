import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private sidebarWidthSubject = new BehaviorSubject<string>('60px');
  sidebarWidth$ = this.sidebarWidthSubject.asObservable();

  updateSidebarWidth(width: string) {
    sessionStorage.setItem('sidebarWidth', width);
    this.sidebarWidthSubject.next(width);
  }
}
