import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

type ToastType = 'success' | 'error' | 'info' | 'warn';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private lastMessages: Record<ToastType, string | null> = {
    success: null,
    error: null,
    info: null,
    warn: null
  };

  constructor(
    private toastrService: ToastrService
  ) { }

  private shouldShow(type: ToastType, message: string): boolean {
    if (this.lastMessages[type] === message) return false;
    this.lastMessages[type] = message;

    setTimeout(() => {
      this.lastMessages[type] = null;
    }, 3000);

    return true;
  }

  success(message: string) {
    if (this.shouldShow('success', message)) {
      this.toastrService.success(message, 'Success');
    }
  }

  error(message: string) {
    if (this.shouldShow('error', message)) {
      this.toastrService.error(message, 'Error');
    }
  }

  info(message: string) {
    if (this.shouldShow('info', message)) {
      this.toastrService.info(message, 'Info');
    }
  }

  warn(message: string) {
    if (this.shouldShow('warn', message)) {
      this.toastrService.warning(message, 'Warning');
    }
  }
}
