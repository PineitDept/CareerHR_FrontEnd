import { Component } from '@angular/core';
import { createStatusIcon, defaultColumns, defaultFilterButtons, defaultSearchByOptions, defaultSearchForm } from '../../../../../constants/admin-setting/user-candidates.constants';
import { UserCandidatesUtils } from '../../../../../utils/admin-setting/user-candidates-utils';
import { UserCandidatesService } from '../../../../../services/admin-setting/user-candidates/user-candidates.service';
import { LoadingService } from '../../../../../shared/services/loading/loading.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

@Component({
  selector: 'app-user-candidates',
  templateUrl: './user-candidates.component.html',
  styleUrl: './user-candidates.component.scss'
})
export class UserCandidatesComponent {
  searchForm = defaultSearchForm();
  searchByOptions = defaultSearchByOptions();

  filterButtons = defaultFilterButtons();
  startDate = '';
  endDate = '';

  rows: any[] = [];
  columns = defaultColumns();

  currentPage = 1;
  hasMoreData = true;

  queryParams: any = {};
  sortFields: string[] = [];
  tableResetKey = 0;

  constructor(
    private userCandidatesService: UserCandidatesService,
    private loadingService: LoadingService,
  ) {}

  onSearch(form: { searchBy: string; searchValue: string }) {
    console.log('called from onSearch', { form });
    UserCandidatesUtils.onSearch(
      form,
      (append, queryParams) =>
        this.fetchUserCandidates(this.startDate, this.endDate, queryParams, append),
      () => this.scrollTableToTop(),
      this.clearSort,
      (qp) => (this.queryParams = qp)
    );
  }

  onClearSearch() {
    console.log('called from onClearSearch');
    UserCandidatesUtils.onClearSearch(
      (append, queryParams) =>
        this.fetchUserCandidates(this.startDate, this.endDate, queryParams, append),
      () => this.scrollTableToTop(),
      this.clearSort,
      (qp) => (this.queryParams = qp),
      () => (this.searchForm = { searchBy: '', searchValue: '' })
    );
  }

  onDateRangeSelected(range: { startDate: string; endDate: string }) {
    console.log('called from onDateRangeSelected', { range })

    this.startDate = range.startDate;
    this.endDate = range.endDate;

    UserCandidatesUtils.onDateRangeSelected(
      (start, end) => {
        this.startDate = start;
        this.endDate = end;
      },
      () => this.fetchUserCandidates(this.startDate, this.endDate, this.queryParams),
      () => (this.searchForm = { searchBy: '', searchValue: '' }),
      () => this.scrollTableToTop(),
      this.clearSort
    );
  }

  onColumnClicked(payload: { state: { [f: string]: 'asc'|'desc'|null }, order: string[] }) {
    UserCandidatesUtils.onColumnClicked(
      payload.state,
      payload.order,                                           // <<— ส่งลำดับ
      (sf) => this.sortFields = sf,
      () => this.fetchUserCandidates(this.startDate, this.endDate, this.queryParams, false),
      () => this.scrollTableToTop()
    );
  }

  private clearSort = () => {
    this.sortFields = [];
    this.tableResetKey++;
  };

  fetchUserCandidates(startDate: string, endDate: string, queryParams: any, append = false) {
    console.log('Fetching user candidates with params:', { startDate, endDate, queryParams, append });
    const keys = Object.keys(queryParams || {});
    const search = keys.length ? queryParams[keys[0]] : undefined;
    // Implement the logic to fetch user candidates here
    this.userCandidatesService.getUserCandidates({
      startDate,
      endDate,
      page: append ? this.currentPage + 1 : 1,
      limit: 20,
      search,
      sortFields: this.sortFields,
    })
    .subscribe({
      next: (res) => {
        const mapped = (res?.items ?? []).map((r: any) => ({
          ...r,
          userName: `${r.engFirstname} ${r.engLastName}`,
          informationCompleted: createStatusIcon(r.informationCompleted),
          quizCompleted: createStatusIcon(r.quizCompleted),
          sendFormCompleted: createStatusIcon(r.sendFormCompleted),
        }));
        this.rows = append ? [...this.rows, ...mapped] : mapped;
        this.currentPage = append ? this.currentPage + 1 : 1;
        this.hasMoreData = mapped.length === 20;
      },
      error: (err) => {
        console.error('Error fetching user candidates:', err);
      },
    });
  }

  onScroll(event: any) {
    console.log('called from onScroll', { event });
    UserCandidatesUtils.onScroll(event, () => this.onLoadMore());
  }

  onLoadMore() {
    const isLoading = this.loadingService['loadingCount'] > 0;
    if (!this.hasMoreData || isLoading) return;

    this.fetchUserCandidates(
      this.startDate,
      this.endDate,
      this.queryParams,
      true
    );
  }

  scrollTableToTop() {
    UserCandidatesUtils.scrollTableToTop();
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'export':
        this.onExportClicked();
        break;
    }
  }

  onExportClicked() {
    console.log('Button clicked: Export Excel');
    const filename = `User-Candidates_${dayjs(this.startDate).format('YYYY-MM-DD')}_to_${dayjs(this.endDate).format('YYYY-MM-DD')}.xlsx`;
    UserCandidatesUtils.onExportClicked(this.columns, this.rows, filename);
  }
}
