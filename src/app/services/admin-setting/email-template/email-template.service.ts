import { Injectable } from '@angular/core';
import { ApiService } from '../../../shared/services/api/api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EmailTemplateService {
  private base = '';

  constructor(private apiService: ApiService) {}

  setEMailType(type: 'email-template' | 'email-attribute' | 'content-policy') {
    switch (type) {
      case 'email-template':
        this.base = 'EmailSettings/mail-management';
        break;
      case 'email-attribute':
        this.base = 'AttributeMailSettings/attribute-based';
        break;
      case 'content-policy':
        this.base = 'ContentPolicy/policies';
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
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
