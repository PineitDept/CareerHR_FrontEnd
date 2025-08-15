import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../shared/services/api/api.service';

import {
  UserPagedResult,
  IUserFilterRequest,
  IUserWithPositionsDto,
  IUserRole,
  CreateUserWebDto,
  UpdateUserWebDto,
  ChangePasswordDto,
  AssignRolesDto,
} from '../../../interfaces/admin-setting/user-web.interface';

// ---------- Service ----------
@Injectable({ providedIn: 'root' })
export class UserWebService {
  private readonly base = 'UserWeb';

  constructor(private api: ApiService) {}

  // Utils: ลบ key ที่เป็น null/undefined/'' ออกจาก params
  private clean(obj: Record<string, any>) {
    const out: Record<string, any> = {};
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  }

  // GET /api/UserWeb
  getUserWeb(params: IUserFilterRequest): Observable<UserPagedResult<IUserWithPositionsDto>> {
    const query = this.clean({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      sortFields: params.sortFields,
      loading: true,
      withAuth: true,
    });

    return this.api.get<UserPagedResult<IUserWithPositionsDto>>(this.base, {
      params: query,
      loading: true,
      withAuth: true,
    });
  }

  // POST /api/UserWeb
  createUserWeb(payload: CreateUserWebDto): Observable<IUserWithPositionsDto> {
    return this.api.post<IUserWithPositionsDto>(this.base, payload, {
      loading: true,
      withAuth: true,
    });
  }

  // GET /api/UserWeb/{id}
  getUserWebById(id: number | string): Observable<IUserWithPositionsDto> {
    return this.api.get<IUserWithPositionsDto>(`${this.base}/${id}`, {
      loading: true,
      withAuth: true,
    });
  }

  // PUT /api/UserWeb/{id}
  updateUserWeb(id: number | string, payload: UpdateUserWebDto): Observable<IUserWithPositionsDto> {
    return this.api.put<IUserWithPositionsDto>(`${this.base}/${id}`, payload, {
      loading: true,
      withAuth: true,
    });
  }

  // DELETE /api/UserWeb/{id}
  deleteUserWeb(id: number | string): Observable<void> {
    return this.api.delete<void>(`${this.base}/${id}`, {
      loading: true,
      withAuth: true,
    });
  }

  // PATCH /api/UserWeb/{id}/toggle-active
  toggleActive(id: number | string): Observable<{ isActive: boolean }> {
    return this.api.patch<{ isActive: boolean }>(`${this.base}/${id}/toggle-active`, {}, {
      loading: true,
      withAuth: true,
    });
  }

  // PATCH /api/UserWeb/{id}/change-password
  changePassword(id: number | string, payload: ChangePasswordDto): Observable<void> {
    return this.api.patch<void>(`${this.base}/${id}/change-password`, payload, {
      loading: true,
      withAuth: true,
    });
  }

  // GET /api/UserWeb/{id}/roles
  getUserRoles(id: number | string): Observable<IUserRole[]> {
    return this.api.get<IUserRole[]>(`${this.base}/${id}/roles`, {
      loading: true,
      withAuth: true,
    });
  }

  // POST /api/UserWeb/{id}/roles
  assignRoles(id: number | string, payload: AssignRolesDto): Observable<IUserRole[]> {
    return this.api.post<IUserRole[]>(`${this.base}/${id}/roles`, payload, {
      loading: true,
      withAuth: true,
    });
  }

  // GET /api/UserWeb/roles  (catalog ของ role ทั้งหมด)
  getAllRoles(): Observable<IUserRole[]> {
    return this.api.get<IUserRole[]>(`${this.base}/roles`, {
      loading: false,
      withAuth: true,
    });
  }
}
