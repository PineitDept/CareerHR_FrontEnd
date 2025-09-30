import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../shared/services/api/api.service';
import { IAppointmentFilterRequest, SendEmailRequest, SendReviewInterview } from '../../../interfaces/interview-scheduling/interview.interface';

@Injectable({
  providedIn: 'root'
})
export class InterviewFormService {
  private baseCandidate = 'CandidateStageHistory';


  // setAppointmentsType(type?: number) {
  //   switch (type) {
  //     case 1:
  //       this.base = 'Appointments/appointments/1';
  //       break;
  //     case 2:
  //       this.base = 'Appointments/appointments/2';
  //       break;
  //     case 3:
  //       this.base = 'Appointments/appointments/3';
  //       break;
  //     default:
  //       this.base = 'Appointments/appointments';
  //   }
  // }

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

    return this.api.get<T>(`Applicants/track-interview-form`, {
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
}

