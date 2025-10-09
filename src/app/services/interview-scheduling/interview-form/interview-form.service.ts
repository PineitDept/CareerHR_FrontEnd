import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../shared/services/api/api.service';
import {
  GetCompanyUserInfoReq,
  IAppointmentFilterRequest,
  SendEmailRequest,
  SendReviewInterview,
  UpdateCandidateStageHistoryPayload,
  UpdateDepartmentReq,
  UpdateDivisionReq,
  UpdateLevelReq,
  UpdateSelectedPositionReq
} from '../../../interfaces/interview-scheduling/interview.interface';

@Injectable({
  providedIn: 'root'
})
export class InterviewFormService {
  private baseCandidate = 'CandidateStageHistory';
  private baseCompany = 'CompanyMasters';
  private base = 'OfferEmployments';

  constructor(private api: ApiService) { }

  private clean(obj: Record<string, any>) {
    const out: Record<string, any> = {};
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  }

  getTrackingForm<T>(params: IAppointmentFilterRequest): Observable<T> {
    const query = this.clean({
      Search: params.search,
      PositionId: params.positionId,
      Month: params.month,
      Year: params.year,
      InterviewDate: params.interviewDate,
      InterviewResult: params.InterviewResult,
      SortFields: params.sortFields,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
    });

    return this.api.get<T>('Applicants/track-interview-form', {
      params: query,
      withAuth: true,
      loading: true,
    });
  }

  getApplicantReview(applicationId: number, stageId: number): Observable<any> {
    return this.api.get<any>(`${this.baseCandidate}/by-application/${applicationId}?stageId=${stageId}`, {
      withAuth: true,
      loading: true,
    });
  }

  getApplicantTracking(applicationId: number): Observable<any> {
    return this.api.get<any>(`Applicants/track-interview-form/${applicationId}`, {
      withAuth: true,
      loading: true,
    });
  }

  postInterviewReview(body: SendReviewInterview): Observable<any> {
    return this.api.post<any>(`${this.baseCandidate}`, body, {
      withAuth: true,
      loading: false,
    });
  }

  updateInterviewDateStart(body: { appointmentId: string; interviewStartTime: string }): Observable<any> {
    return this.api.patch<any>('AppointmentInterviews/interview-start-time', body, {
      withAuth: true,
      loading: false,
    });
  }

  updateInterviewDateEnd(body: { appointmentId: string; interviewEndTime: string }): Observable<any> {
    return this.api.patch<any>('AppointmentInterviews/interview-end-time', body, {
      withAuth: true,
      loading: false,
    });
  }

  updateCandidateStageHistory(historyId: number, body: UpdateCandidateStageHistoryPayload): Observable<any> {
    return this.api.put<any>(`${this.baseCandidate}/${historyId}`, body, {
      withAuth: true,
      loading: true,
    });
  }

  getCompany(): Observable<any> {
    return this.api.get<any>(`${this.baseCompany}/all-company`, {
      withAuth: true,
      loading: true,
    });
  }

  getCompanyById(companyId: number): Observable<any> {
    return this.api.get<any>(`${this.baseCompany}/${companyId}`, {
      withAuth: true,
      loading: true,
    });
  }

  getCompanyDepartmentById(companyId: number, departmentId: number): Observable<any> {
    return this.api.get<any>(`${this.baseCompany}/${companyId}/${departmentId}`, {
      withAuth: true,
      loading: true,
    });
  }

  getCompanyPositions(): Observable<any> {
    return this.api.get<any>(`${this.baseCompany}/positions`, {
      withAuth: true,
      loading: true,
    });
  }

  getCompanyLevels(companyId: number): Observable<any> {
    return this.api.get<any>(`${this.baseCompany}/Level?companyId=${companyId}`, {
      withAuth: true,
      loading: true,
    });
  }

  postUpdateSelectPostion(body: { userId: number, selectedPositionId: number }): Observable<any> {
    return this.api.post<any>(`OfferEmployments/update-selected-position`, body, {
      withAuth: true,
      loading: false,
    });
  }


  // POST /api/OfferEmployments/GetCompanyUserInfo
  getCompanyUserInfo(body: GetCompanyUserInfoReq): Observable<any> {
    return this.api.post<any>(`${this.base}/GetCompanyUserInfo`, body, {
      withAuth: true,
      loading: true,
    });
  }

  // PATCH /api/OfferEmployments/update-department
  updateDepartment(body: UpdateDepartmentReq): Observable<any> {
    return this.api.patch<any>(`${this.base}/update-department`, body, {
      withAuth: true,
      loading: false,
    });
  }

  // PATCH /api/OfferEmployments/update-division
  updateDivision(body: UpdateDivisionReq): Observable<any> {
    return this.api.patch<any>(`${this.base}/update-division`, body, {
      withAuth: true,
      loading: false,
    });
  }

  // PATCH /api/OfferEmployments/update-level
  updateLevel(body: UpdateLevelReq): Observable<any> {
    return this.api.patch<any>(`${this.base}/update-level`, body, {
      withAuth: true,
      loading: false,
    });
  }

  updateSelectedPosition(body: UpdateSelectedPositionReq): Observable<any> {
    return this.api.post<any>(`${this.base}/update-selected-position`, body, {
      withAuth: true,
      loading: false,
    });
  }

}
