import { Injectable } from '@angular/core';
import { ApiService } from '../../../shared/services/api/api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApplicationQuestionService {

  constructor(
    private apiService: ApiService
  ) { }

  getCategoryTypesInfoQuestion(): Observable<any> {
    return this.apiService.get<any>('InfoQuestion/TypeCategories', {
      withAuth: true,
      loading: true
    });
  }

  getCategoryTypesInfoQuestionDetails(categoryType: string): Observable<any> {
    return this.apiService.get<any>(`InfoQuestion/TypeCategories/${categoryType}`, {
      withAuth: true,
      loading: true
    });
  }
}
