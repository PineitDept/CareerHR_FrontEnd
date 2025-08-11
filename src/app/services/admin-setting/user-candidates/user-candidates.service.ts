import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../shared/services/api/api.service';

@Injectable({
  providedIn: 'root'
})
export class UserCandidatesService {

  constructor(
    private apiService: ApiService
  ) { }

  private withSortFields(baseUrl: string, sortFields?: string[]): string {
    if (!sortFields || sortFields.length === 0) return baseUrl;

    const tokens = sortFields
      .flatMap(sf => String(sf).split(','))
      .map(s => s.trim())
      .filter(Boolean);

    if (tokens.length === 0) return baseUrl;

    const qs = tokens.map(t => `SortFields=${encodeURIComponent(t)}`).join('&');
    return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${qs}`;
  }

  getUserCandidates(params: {
    startDate: string;
    endDate: string;
    page: number;
    limit: number;
    search?: any;
    sortFields?: string[];
  }): Observable<any> {

    const q: Array<[string,string]> = [
      ['DateFrom', params.startDate],
      ['DateTo', params.endDate],
      ['page', String(params.page)],
      ['pageSize', String(params.limit)],
    ];
    if (params.search != null && params.search !== '') q.push(['Search', String(params.search)]);
    (params.sortFields ?? []).forEach(sf => q.push(['SortFields', sf]));

    const enc = (s: string) => encodeURIComponent(s);
    const encSort = (s: string) => encodeURIComponent(s).replace(/%3A/gi, ':');

    const qs = q
      .filter(([,v]) => v !== undefined && v !== null && v !== '')
      .map(([k,v]) => `${enc(k)}=${k === 'SortFields' ? encSort(v) : enc(v)}`)
      .join('&');

    const urlWithQuery = qs ? `Applicants/progress?${qs}` : 'Applicants/progress';

    return this.apiService.get<any>(urlWithQuery, {
      withAuth: true,
      loading: true
    });
  }
}
