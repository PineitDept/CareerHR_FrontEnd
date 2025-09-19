import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../shared/services/api/api.service';

export interface IAppointmentFilterRequest {
  search?: string;
  positionId?: number;
  month?: number;
  year?: number;
  interviewDate?: string;
  InterviewResult?: string;
  sortFields?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({
  providedIn: 'root',
})
export class AppointmentsService {
  private baseAPI = 'Appointments';
  private base = '';
  private baseCandidate = 'Candidates'


  setAppointmentsType(type?: number) {
    switch (type) {
      case 1:
        this.base = 'Appointments/appointments/1';
        break;
      case 2:
        this.base = 'Appointments/appointments/2';
        break;
      case 3:
        this.base = 'Appointments/appointments/3';
        break;
      default:
        this.base = 'Appointments/appointments';
    }
  }

  constructor(private api: ApiService) { }

  private clean(obj: Record<string, any>) {
    const out: Record<string, any> = {};
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  }

  getAppointments<T>(params: IAppointmentFilterRequest): Observable<T> {
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

    return this.api.get<T>(`${this.base}`, {
      params: query,
      withAuth: true,
      loading: true,
    });
  }

  getAppointmentsHistory<T>(params: IAppointmentFilterRequest): Observable<T> {
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

    return this.api.get<T>(`${this.base}/history`, {
      params: query,
      withAuth: true,
      loading: true,
    });
  }

  updateCandidateStatus(
    id: number,
    body: { isPassed: boolean; positionId: number; applyRound: number }
  ): Observable<any> {
    return this.api.patch<any>(`${this.baseCandidate}/${id}/status`, body, {
      withAuth: true,
      loading: false
    });
  }

  getStatus<T>(params: IAppointmentFilterRequest): Observable<T> {
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

    return this.api.get<T>(`${this.baseAPI}/misscall-reasons`, {
      params: query,
      withAuth: true,
      loading: true,
    });
  }

  appointmentMisscall(body: { appointmentId: string; missCallId: number; isNoShow: boolean }): Observable<any> {
    return this.api.post<any>(`${this.baseAPI}/appointment-misscall`, body, {
      withAuth: true,
      loading: false,
    });
  }

  getPositionLogs(id: number, round: number): Observable<any> {
    return this.api.get<any>(`PositionLogs/${id}/${round}`, {
      withAuth: true,
      loading: false,
    });
  }

  addPositionJob(body: { userId: number; idjobPst: number; round: number }): Observable<any> {
    return this.api.post<any>(`PositionLogs/add-job-log`, body, {
      withAuth: true,
      loading: false,
    });
  }

  deletePositionJob(userId: number, round: number, idjobPst: number): Observable<any> {
    return this.api.delete<any>(`PositionLogs/delete/?userId=${userId}&round=${round}&positionid=${idjobPst}`, {
      withAuth: true,
      loading: false,
    });
  }


}
