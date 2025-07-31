import { Injectable } from '@angular/core';
import { ApiService } from '../../shared/services/api/api.service';
import { ICandidateFilterRequest, ICandidateWithPositionsDto } from '../../interfaces/Application/application.interface';
import { Observable } from 'rxjs';
import { CandidatePagedResult, PagedResult } from '../../shared/interfaces/api/paged-result.interface';
import { CandidateTracking } from '../../interfaces/Application/tracking.interface';
@Injectable({
  providedIn: 'root'
})
export class ApplicationService {

  constructor(private apiService: ApiService) {
  }

  getApplications(params: ICandidateFilterRequest): Observable<CandidatePagedResult<ICandidateWithPositionsDto>> {
    return this.apiService.get<PagedResult<ICandidateWithPositionsDto>>('api/Applicants/SummaryScores', {
      params: params,
      loading: true, 
      withAuth: true
    });
  }

getTrackingApplications(params: ICandidateFilterRequest): Observable<CandidatePagedResult<CandidateTracking>> {
  return this.apiService.get<CandidatePagedResult<CandidateTracking>>('api/Applicants/CandidateTracking', {
    params: params,
    loading: true,
    withAuth: true
  });
}

}
