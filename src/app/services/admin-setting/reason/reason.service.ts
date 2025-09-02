import { Injectable } from '@angular/core';
import { ApiService } from '../../../shared/services/api/api.service';
import { Observable } from 'rxjs';

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
}
