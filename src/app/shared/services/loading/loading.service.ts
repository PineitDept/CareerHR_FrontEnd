import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {

  private loadingCount = 0;
  private loading$ = new BehaviorSubject<boolean>(false);

  constructor() { }

  get isLoading(): boolean {
    return this.loadingCount > 0;
  }

  show() {
    this.loadingCount++;
    if (this.loadingCount === 1) {
      this.loading$.next(true);
    }
  }

  hide() {
    if (this.loadingCount > 0) {
      this.loadingCount--;
      if (this.loadingCount === 0) {
        this.loading$.next(false);
      }
    }
  }

  isLoading$() {
    return this.loading$.asObservable();
  }
}
