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
  private base = 'Appointments';

  constructor(private api: ApiService) {}

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
}
