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
}
