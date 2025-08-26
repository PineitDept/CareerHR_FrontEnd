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
  getAllEmailTemplates(): Observable<any> {
    return this.apiService.get<any>(this.base, {
      withAuth: true,
      loading: true
    });
  }

  // ดึงรายการเดียวตาม id
  getEmailTemplateById(id: number | string): Observable<any> {
    return this.apiService.get<any>(`${this.base}/${id}`, {
      withAuth: true,
      loading: true
    });
  }

  // แก้ไขรายการ
  updateEmailTemplate(id: number | string, data: any): Observable<any> {
    return this.apiService.put<any>(`${this.base}/${id}`, data, {
      withAuth: true,
      loading: true
    });
  }
}
