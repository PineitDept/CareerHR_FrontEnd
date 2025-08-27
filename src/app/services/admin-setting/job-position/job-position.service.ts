import { Injectable } from '@angular/core';
import { ApiService } from '../../../shared/services/api/api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class JobPositionService {
  private base = '';

  constructor(private apiService: ApiService) {}

  setEMailType(type: 'job-position') {
    switch (type) {
      case 'job-position':
        this.base = 'JobPositions';
        break;
      default:
        this.base = 'JobPositions';
        break;
    }
  }

  // ดึงรายการทั้งหมด
  getAllJobTemplates(): Observable<any> {
    return this.apiService.get<any>(this.base, {
      withAuth: true,
      loading: true
    });
  }

  // ดึงรายการเดียวตาม id
  getJobTemplateById(id: number | string): Observable<any> {
    return this.apiService.get<any>(`${this.base}/${id}`, {
      withAuth: true,
      loading: true
    });
  }

  // แก้ไขรายการ
  updateJobPosition(id: number | string, data: any): Observable<any> {
    return this.apiService.put<any>(`${this.base}/${id}`, data, {
      withAuth: true,
      loading: true
    });
  }

  // PATCH: Toggle Active/Inactive Status
  toggleStatus(id: number): Observable<any> {
    return this.apiService.patch(`${this.base}/${id}/toggle-status`, {}, {
      withAuth: true,
      loading: true,
    });
  }
}
