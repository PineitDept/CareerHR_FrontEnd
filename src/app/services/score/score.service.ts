import { Injectable } from '@angular/core';
import { ApiService } from '../../shared/services/api/api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScoreService {

  constructor(
    private apiService: ApiService
  ) { }

  getScoreSettingTypes(): Observable<any> {
    return this.apiService.get<any>('ScoreSetting/types', {
      withAuth: true,
      loading: true
    });
  }

  getScoreSettingDetailsByType(scoreType: number): Observable<any> {
    return this.apiService.get<any>(`ScoreSetting/by-type/${scoreType}`, {
      withAuth: true,
      loading: true
    });
  }

  getRevisionScoreSettingDetailsByType(scoreType: number, divisionId: number): Observable<any> {
    return this.apiService.get<any>(`ScoreSetting/by-type/${scoreType}/division/${divisionId}`, {
      withAuth: true,
      loading: true
    });
  }

  saveScoreSettingDetails(body: any): Observable<any> {
    return this.apiService.post<any>('ScoreSetting/forms', body, {
      withAuth: true,
      loading: true
    });
  }
}
