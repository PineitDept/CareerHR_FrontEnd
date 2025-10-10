import { Injectable } from '@angular/core';
import { ApiService } from '../../shared/services/api/api.service';
import {
  ICandidateFilterRequest,
  ICandidateTrackingFilterRequest,
  ICandidateWithPositionsDto,
} from '../../interfaces/Application/application.interface';
import { Observable } from 'rxjs';
import {
  CandidatePagedResult,
  PagedResult,
} from '../../shared/interfaces/api/paged-result.interface';
import { CandidateTracking } from '../../interfaces/Application/tracking.interface';
import { HttpParams } from '@angular/common/http';
@Injectable({
  providedIn: 'root',
})
export class ApplicationService {
  constructor(private apiService: ApiService) {}

  getApplications(
    params: ICandidateFilterRequest
  ): Observable<CandidatePagedResult<ICandidateWithPositionsDto>> {
    return this.apiService.get<PagedResult<ICandidateWithPositionsDto>>(
      'Applicants/Summary-Scores',
      {
        params: params,
        loading: true,
        withAuth: true,
      }
    );
  }

  getTrackingApplications(
    filter: ICandidateTrackingFilterRequest
  ): Observable<CandidatePagedResult<CandidateTracking>> {
    // สร้าง query string โดยตรงแทนการใช้ HttpParams
    const queryParts: string[] = [];

    if (filter.page !== undefined) queryParts.push(`page=${filter.page}`);
    if (filter.pageSize !== undefined)
      queryParts.push(`pageSize=${filter.pageSize}`);
    if (filter.status)
      queryParts.push(`Status=${encodeURIComponent(filter.status)}`);
    if (filter.year !== undefined) queryParts.push(`year=${filter.year}`);
    if (filter.month !== undefined) queryParts.push(`month=${filter.month}`);
    if (filter.search)
      queryParts.push(`search=${encodeURIComponent(filter.search)}`);
    if (filter.sortFields)
      queryParts.push(`sortFields=${encodeURIComponent(filter.sortFields)}`);

    // Arrays - สร้าง multiple parameters
    if (filter.interview1?.length) {
      filter.interview1.forEach((val) => queryParts.push(`Interview1=${val}`));
    }
    if (filter.interview2?.length) {
      filter.interview2.forEach((val) => queryParts.push(`Interview2=${val}`));
    }
    if (filter.offer?.length) {
      filter.offer.forEach((val) => queryParts.push(`Offer=${val}`));
    }
    if (filter.hired?.length) {
      filter.hired.forEach((val) => queryParts.push(`Hired=${val}`));
    }

    const queryString = queryParts.join('&');
    const endpoint = queryString
      ? `Applicants/tracking?${queryString}`
      : 'Applicants/tracking';

    return this.apiService.get<CandidatePagedResult<CandidateTracking>>(
      endpoint,
      {
        loading: true,
        withAuth: true,
      }
    );
  }

  getApplicationAssessmentAndCandidateWarning(id: number, round: number): Observable<any> {
    return this.apiService.get<any>(`Validation/candidate-score/${id}/round/${round}`, {
      loading: true,
      withAuth: true,
    });
  }

  getCandidateStageHistoryById(
    id: number,
    stageId?: number
  ): Observable<any> {
    const endpoint = stageId
      ? `CandidateStageHistory/by-application/${id}?stageId=${stageId}`
      : `CandidateStageHistory/by-application/${id}`;

    return this.apiService.get<any>(endpoint, {
      loading: true,
      withAuth: true,
    });
  }

  getCommentsById(id: number): Observable<any> {
    return this.apiService.get<any>(`Comments/candidate/${id}`, {
      loading: true,
      withAuth: true,
    });
  }

  addCommentByCandidateId(body: any): Observable<any> {
    return this.apiService.post<any>(`Comments`, body, {
      loading: true,
      withAuth: true,
    });
  }

  editCommentById(id: number, body: any): Observable<any> {
    return this.apiService.put<any>(`Comments/${id}`, body, {
      loading: true,
      withAuth: true,
    });
  }

  deleteCommentById(id: number): Observable<any> {
    return this.apiService.delete<any>(`Comments/${id}`, {
      loading: true,
      withAuth: true,
    });
  }

  getCurrentStageByCandidateId(id: number): Observable<any> {
    return this.apiService.get<any>(`Appointments/currentStage/${id}`, {
      loading: true,
      withAuth: true,
    });
  }

  getInterestByCandidateId(id: number): Observable<any> {
    return this.apiService.get<any>(`Interest/${id}`, {
      loading: true,
      withAuth: true,
    });
  }

  addInterest(body: any): Observable<any> {
    return this.apiService.post<any>(`Interest`, body, {
      loading: true,
      withAuth: true,
    });
  }

  deleteInterest(body: any): Observable<any> {
    const options = {
      body: body,
      loading: true,
      withAuth: true
    };
    return this.apiService.delete<any>(`Interest`, options);
  }

  getFileByCandidateId(id: number): Observable<any> {
    return this.apiService.get<any>(`ApplicantDetail/${id}/uploadfile`, {
      loading: true,
      withAuth: true,
    });
  }

  getApplicantDetailById(id: number): Observable<any> {
    return this.apiService.get<any>(`ApplicantDetail/${id}`, {
      loading: true,
      withAuth: true,
    });
  }
}
