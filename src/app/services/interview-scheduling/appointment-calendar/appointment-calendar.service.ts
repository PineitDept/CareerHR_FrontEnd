import { Injectable } from '@angular/core';
import { ApiService } from '../../../shared/services/api/api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppointmentCalendarService {
  private base = 'Calendar/interviews';

  constructor(private apiService: ApiService) { }

  getInterviewAppointments(year: number, month: number): Observable<any> {
    return this.apiService.get<any>(this.base, {
      params: { year, month },
      withAuth: true,
      loading: true
    });
  }
}
