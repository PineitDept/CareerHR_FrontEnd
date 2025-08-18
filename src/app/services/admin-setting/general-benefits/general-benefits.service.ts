import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../shared/services/api/api.service';

import {
  IBenefitsFilterRequest,
  IBenefitsWithPositionsDto,
} from '../../../interfaces/admin-setting/general-benefits.interface';

@Injectable({
  providedIn: 'root'
})
export class GeneralBenefitsService {
  private base = '';

  constructor(private api: ApiService) {}

  // Set API base path depending on the benefit type
  setBenefitType(type: 'general-benefits' | 'special-benefits' | 'computer-skills') {
    switch (type) {
      case 'general-benefits':
        this.base = 'InfoWelfareBenefit/info-welfare-benefits';
        break;
      case 'special-benefits':
        this.base = 'WelfareBenefit/welfare-benefits';
        break;
      case 'computer-skills':
        this.base = 'ComputerSkill/cp-skills';
        break;
      default:
        throw new Error(`Unknown benefit type: ${type}`);
    }
  }

  // Clean empty/null/undefined values from object
  private clean(obj: Record<string, any>) {
    const out: Record<string, any> = {};
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  }

  // GET: List benefits with filters
  getBenefitsWeb<T>(params: IBenefitsFilterRequest): Observable<T[]> {
    const query = this.clean({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      sortFields: params.sortFields,
    });

    return this.api.get<T[]>(this.base, {
      params: query,
      loading: true,
      withAuth: true,
    });
  }

  // GET: Single benefit by ID
  getBenefitById<T>(id: number): Observable<T> {
    return this.api.get<T>(`${this.base}/${id}`, {
      withAuth: true,
      loading: true,
    });
  }

  // POST: Create new Benefit
  createBenefit(payload: Partial<IBenefitsWithPositionsDto>): Observable<any> {
    return this.api.post(this.base, payload, {
      withAuth: true,
      loading: true,
    });
  }

  // PUT: Update Benefit by ID
  updateBenefit(id: number, payload: Partial<IBenefitsWithPositionsDto>): Observable<any> {
    return this.api.put(`${this.base}/${id}`, payload, {
      withAuth: true,
      loading: true,
    });
  }

  // DELETE: Remove Benefit by ID
  deleteBenefit(id: number): Observable<any> {
    return this.api.delete(`${this.base}/${id}`, {
      withAuth: true,
      loading: true,
    });
  }

  // PATCH: Toggle Active/Inactive Status
  toggleStatus(id: number): Observable<any> {
    return this.api.patch(`${this.base}/${id}/toggle-status`, {}, {
      withAuth: true,
      loading: true,
    });
  }
}
