import { Injectable } from '@angular/core';
import { ApiService } from '../../../shared/services/api/api.service';
import { Observable } from 'rxjs';
import { ApiRequestBody } from '../../../interfaces/admin-setting/reason.interface';

@Injectable({
  providedIn: 'root'
})
export class ReasonService {

  constructor(
    private apiService: ApiService
  ) { }

  getRecruitmentStages(): Observable<any> {
    return this.apiService.get<any>('RecruitmentStages', {
      withAuth: true,
      loading: true
    });
  }

  getRecruitmentStagesWithReasons(processId: number): Observable<any> {
    return this.apiService.get<any>(`RecruitmentStages/${processId}/categories/with-reasons`, {
      withAuth: true,
      loading: true
    });
  }

  updateReasonsOfRecruitmentStage(body: ApiRequestBody): Observable<any> {
    return this.apiService.post<any>(`RecruitmentReasons/bulk-update`, body, {
      withAuth: true,
      loading: true
    });
  }

  getUnmappedReasonCategories(id: number): Observable<any> {
    return this.apiService.get<any>(`ReasonCategories/unmapped/stages/${id}`, {
      withAuth: true,
      loading: true
    });
  }

  getReasonByCategoryId(id: number): Observable<any> {
    return this.apiService.get<any>(`RecruitmentReasons/by-category/${id}`, {
      withAuth: true,
      loading: true
    });
  }
}
