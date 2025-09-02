import { Injectable } from '@angular/core';
import { ApiService } from '../../../shared/services/api/api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InterviewerService {
  private base = 'TeamInterview';

  constructor(private apiService: ApiService) { }

  getAllTeams(): Observable<any> {
    return this.apiService.get<any>(this.base, { withAuth: true, loading: true });
  }

  createTeam(data: any): Observable<any> {
    return this.apiService.post<any>(this.base, data, { withAuth: true, loading: true });
  }

  getTeamById(id: number | string): Observable<any> {
    return this.apiService.get<any>(`${this.base}/${id}`, { withAuth: true, loading: true });
  }

  updateTeam(id: number | string, data: any): Observable<any> {
    return this.apiService.put<any>(`${this.base}/${id}`, data, { withAuth: true, loading: true });
  }

  deleteTeam(id: number | string): Observable<any> {
    return this.apiService.delete<any>(`${this.base}/${id}`, { withAuth: true, loading: true });
  }

  addTeamMember(id: number | string, interviewerId: number): Observable<any> {
    return this.apiService.post<any>(`${this.base}/${id}/members`, { interviewerId }, {
      withAuth: true,
      loading: true
    });
  }

  removeTeamMember(teamId: number | string, interviewerId: number): Observable<any> {
    return this.apiService.delete<any>(`${this.base}/${teamId}/members/${interviewerId}`, {
      withAuth: true,
      loading: true
    });
  }

  getAllInterviewers(): Observable<any> {
    return this.apiService.get<any>(`${this.base}/interviewers`, { withAuth: true, loading: true });
  }
}