import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  computed,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  Observable,
  Subject,
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  tap,
  catchError,
  EMPTY,
  map,
} from 'rxjs';

import { ApplicationService } from '../../../services/application/application.service';
import {
  ApiResponse,
  ApplicationRow,
  BadgeConfig,
  DateRange,
  ICandidateFilterRequest,
  ICandidateWithPositionsDto,
  IconConfig,
  IPositionDto,
  SearchForm,
  StatusGroupCount,
  TabMenu,
} from '../../../interfaces/Application/application.interface';
import { Columns } from '../../../shared/interfaces/tables/column.interface';
import { SortState } from '../../../shared/components/tables/tables.component';

// Constants
const CONFIG = {
  STORAGE_KEYS: {
    FILTER_SETTINGS: 'candidateFilterSettings',
    CLICKED_ROWS: 'candidateclickedRowIndexes',
    SORT_CONFIG: 'candidateSortConfig', // เพิ่ม key สำหรับ sort config
  },
  SCROLL: {
    THRESHOLD: 2,
  },
  DEBOUNCE_TIME: 300,
  DEFAULT_PAGE_SIZE: 30,
  DEFAULT_STATUS: 'pending',
} as const;

const SEARCH_OPTIONS: string[] = [
  'Application ID',
  'Application Name',
  'University',
] as const;
type SearchOption = (typeof SEARCH_OPTIONS)[number];

const BADGE_STYLES = {
  New: ['tw-bg-green-500', 'tw-text-white', 'tw-ring-green-500/10'],
  'Over 3 Day': ['tw-bg-yellow-400', 'tw-text-black', 'tw-ring-yellow-500/10'],
  'Over Week': ['tw-bg-red-500', 'tw-text-white', 'tw-ring-red-500/10'],
  'Over Month': ['tw-bg-red-900', 'tw-text-white', 'tw-ring-red-900/10'],
} as const;

@Component({
  selector: 'app-all-application',
  templateUrl: './all-application.component.html',
  styleUrl: './all-application.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllApplicationComponent implements OnInit, OnDestroy {
  // Dependency Injection
  private readonly router = inject(Router);
  private readonly applicationService = inject(ApplicationService);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('tableContainer', { static: false })
  private tableContainer!: ElementRef<HTMLElement>;

  // Reactive State Management with Signals
  private readonly loadingState = signal(false);
  private readonly filterRequest = signal<ICandidateFilterRequest>(
    this.createInitialFilter()
  );
  private readonly rowsData = signal<ApplicationRow[]>([]);
  private readonly tabMenusData = signal<TabMenu[]>(this.createInitialTabs());
  private readonly clickedRowIds = signal<Set<string>>(new Set());
  private readonly sortConfig = signal<SortState>({});

  // Computed Properties
  readonly isLoading = computed(() => this.loadingState());
  readonly rows = computed(() => this.rowsData());
  readonly tabMenus = computed(() => this.tabMenusData());
  readonly activeTab = computed(() => this.filterRequest().statusGroup || '');
  readonly currentSort = computed(() => this.sortConfig());
  readonly resetCounter = signal<number>(0);
  // Subjects for reactive streams
  private readonly searchSubject = new BehaviorSubject<SearchForm>({
    searchBy: '',
    searchValue: '',
  });
  private readonly dateRangeSubject = new BehaviorSubject<DateRange>({
    month: '',
    year: '',
  });
  private readonly tabChangeSubject = new BehaviorSubject<string>('');
  private readonly columnSortSubject = new BehaviorSubject<string>('');
  private readonly scrollSubject = new Subject<Event>();

  // Public Properties
  readonly searchByOptions = SEARCH_OPTIONS;
  searchForm: SearchForm = { searchBy: '', searchValue: '' };
  filterDateRange: DateRange = { month: '', year: '' };

  // Table Configuration
  readonly columns: Columns = [
    {
      header: 'Qualified',
      field: 'qualifield',
      type: 'icon',
      align: 'center',
      minWidth: '30px',
      sortable: true,
    },
    {
      header: 'Submit Date',
      field: 'submitDate',
      type: 'date',
      align: 'center',
      sortable: true,
    },
    {
      header: 'Applicant ID',
      field: 'userID',
      type: 'text',
      align: 'center',
      sortable: true,
    },
    {
      header: 'Applicant Name',
      field: 'fullName',
      type: 'text',
      sortable: true,
    },
    {
      header: 'Job Position',
      field: 'position',
      type: 'list',
      maxWidth: '400px',
      wrapText: true,
    },
    {
      header: 'University',
      field: 'university',
      type: 'text',
      maxWidth: '400px',
      wrapText: true,
      sortable: true,
    },
    {
      header: 'GPA',
      field: 'gpa',
      type: 'text',
      align: 'center',
      sortable: true,
    },
    {
      header: 'Grade',
      field: 'gradeCandidate',
      type: 'text',
      align: 'center',
      maxWidth: '20px',
      sortable: true,
    },
    {
      header: 'Total Score',
      field: 'totalCandidatePoint',
      type: 'expandable',
      align: 'right',
      mainColumn: 'totalCandidatePoint',
      sortable: true,
    },
    {
      header: 'Education (1 Point)',
      field: 'bdPoint',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true,
    },
    {
      header: 'GPA (1 Point)',
      field: 'gpaScore',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true,
    },
    {
      header: 'Test EQ (1 Point)',
      field: 'eqScore',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true,
    },
    {
      header: 'Test Ethics (1 Point)',
      field: 'ethicsScore',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true,
    },
    {
      header: 'Bonus',
      field: 'totalBonus',
      type: 'text',
      align: 'right',
      sortable: true,
    },
    {
      header: 'Status',
      field: 'submitStatusLabel',
      type: 'badge',
      align: 'center',
    },
  ] as const;

  ngOnInit(): void {
    this.initializeComponent();
    this.setupReactiveStreams();
  }

  ngOnDestroy(): void {
    this.persistCurrentState();
  }

  // Public Event Handlers
  async onSearch(form: SearchForm): Promise<void> {
    this.searchSubject.next(form);
  }

  async onClearSearch(): Promise<void> {
    this.searchForm = { searchBy: '', searchValue: '' };
    this.searchSubject.next(this.searchForm);
  }

  async onDateRangeSelected(event: {
    startDate: string;
    endDate: string;
  }): Promise<void> {
    const dateRange = this.extractDateRange(event);
    this.filterDateRange = dateRange;
    this.dateRangeSubject.next(dateRange);
  }

  async onTabChanged(tab: string): Promise<void> {
    this.tabChangeSubject.next(tab);
  }

  onRowClick(row: ApplicationRow): void {
    console.log('Row clicked:', row);
    // Implement row selection logic
  }

  // อัปเดต onColumnClick method
  async onColumnClick(sortState: SortState): Promise<void> {
    // กรองเอาค่าที่ไม่เป็น null ออกมา
    const filteredSortState = Object.keys(sortState)
      .filter((key) => sortState[key] !== null)
      .reduce((acc, key) => {
        acc[key] = sortState[key];
        return acc;
      }, {} as SortState);

    const sortedColumns = Object.keys(filteredSortState);
    // แปลงเป็น string เพื่อส่งไปยัง API/subject
    const sortedColumnsString = sortedColumns
      .map((c) => `${c}:${filteredSortState[c]}`)
      .join(',');

    // เก็บ sortedColumns ใน storage
    this.persistSortConfig(filteredSortState); // หรือวิธีการเก็บที่คุณต้องการ

    // // ส่งไปยัง stream เพื่อทำการ sort
    this.columnSortSubject.next(sortedColumnsString);
  }
  onScroll(event: Event): void {
    this.scrollSubject.next(event);
  }

  onClickedRowsChanged(clickedRowIds: Set<string>): void {
    this.clickedRowIds.set(new Set(clickedRowIds));
    this.persistClickedRows(clickedRowIds);
  }

  // Private Initialization Methods
  private initializeComponent(): void {
    this.loadPersistedState();
    this.loadInitialData();
  }

  private setupReactiveStreams(): void {
    this.setupSearchStream();
    this.setupDateRangeStream();
    this.setupTabChangeStream();
    this.setupColumnSortStream();
    this.setupScrollStream();
  }

  private setupSearchStream(): void {
    this.searchSubject
      .pipe(
        debounceTime(CONFIG.DEBOUNCE_TIME),
        distinctUntilChanged(
          (prev, curr) =>
            prev.searchBy === curr.searchBy &&
            prev.searchValue === curr.searchValue
        ),
        tap(() => this.resetPagination()),
        switchMap((searchForm) => this.handleSearch(searchForm)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private setupDateRangeStream(): void {
    this.dateRangeSubject
      .pipe(
        distinctUntilChanged(
          (prev, curr) => prev.month === curr.month && prev.year === curr.year
        ),
        tap(() => this.resetPagination()),
        switchMap((dateRange) => this.handleDateRangeChange(dateRange)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private setupTabChangeStream(): void {
    this.tabChangeSubject
      .pipe(
        distinctUntilChanged(),
        tap(() => this.resetPagination()),
        switchMap((tab) => this.handleTabChange(tab)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private setupColumnSortStream(): void {
    this.columnSortSubject
      .pipe(
        distinctUntilChanged(),
        tap(() => this.resetPagination()),
        switchMap((column) => this.handleColumnSort(column)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private setupScrollStream(): void {
    this.scrollSubject
      .pipe(
        debounceTime(100),
        tap((event) => this.handleInfiniteScroll(event)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  // Private Stream Handlers
  private handleSearch(searchForm: SearchForm): Observable<void> {
    const updatedFilter = this.updateFilterForSearch(searchForm);
    return this.fetchData(updatedFilter, false);
  }

  private handleDateRangeChange(dateRange: DateRange): Observable<void> {
    const updatedFilter = this.updateFilterForDateRange(dateRange);
    return this.fetchData(updatedFilter, false);
  }

  private handleTabChange(tab: string): Observable<void> {
    const updatedFilter = this.updateFilterForTab(tab);
    return this.fetchData(updatedFilter, false);
  }

  private handleColumnSort(column: string): Observable<void> {
    const updatedFilter = this.updateFilterForSort(column);
    return this.fetchData(updatedFilter, false);
  }

  private handleInfiniteScroll(event: Event): void {
    const element = event.target as HTMLElement;
    if (!this.canLoadMore(element)) return;

    const currentFilter = this.filterRequest();
    if (currentFilter.hasNextPage && !this.isLoading()) {
      const updatedFilter = { ...currentFilter, page: currentFilter.page + 1 };
      this.fetchData(updatedFilter, true).subscribe();
    }
  }

  // Private Data Fetching
  private fetchData(
    filter: ICandidateFilterRequest,
    append: boolean
  ): Observable<void> {
    if (this.isLoading()) return EMPTY;
    console.log('Fetching data with filter:', filter);
    this.loadingState.set(true);
    this.filterRequest.set(filter);

    return this.applicationService.getApplications(filter).pipe(
      tap((response) => this.handleApiResponse(response, append)),
      tap(() => this.persistFilterState()),
      catchError((error) => this.handleApiError(error)),
      tap(() => this.loadingState.set(false)),
      map(() => void 0)
    );
  }

  private loadInitialData(): void {
    this.fetchData(this.filterRequest(), false).subscribe();
  }

  // Private Response Handlers
  private handleApiResponse(response: ApiResponse, append: boolean): void {
    this.updateFilterWithResponse(response);
    this.updateTabCounts(response);
    this.updateRowsData(response.items, append);
  }

  private handleApiError(error: any): Observable<never> {
    console.error('API Error:', error);
    // Implement user-friendly error handling
    return EMPTY;
  }

  // Private State Updates
  private updateFilterWithResponse(response: ApiResponse): void {
    const currentFilter = this.filterRequest();
    this.filterRequest.set({
      ...currentFilter,
      page: response.page,
      hasNextPage: response.hasNextPage,
    });
  }

  private updateTabCounts(response: ApiResponse): void {
    const updatedTabs = this.tabMenusData().map((tab) => ({
      ...tab,
      count:
        tab.key === ''
          ? response.totalItems
          : this.safeGetStatusCount(response.statusGroupCount, tab.key),
    }));
    this.tabMenusData.set(updatedTabs);
  }

  private updateRowsData(
    items: readonly ICandidateWithPositionsDto[],
    append: boolean
  ): void {
    const processedRows = this.transformApiDataToRows(items);
    const currentRows = this.rowsData();
    this.rowsData.set(
      append ? [...currentRows, ...processedRows] : processedRows
    );
  }

  // Private Filter Updates
  private updateFilterForSearch(
    searchForm: SearchForm
  ): ICandidateFilterRequest {
    const currentFilter = this.filterRequest();
    const search = this.isValidSearchOption(searchForm.searchBy)
      ? searchForm.searchValue || undefined
      : undefined;

    return { ...currentFilter, search, page: 1 };
  }

  private updateFilterForDateRange(
    dateRange: DateRange
  ): ICandidateFilterRequest {
    const currentFilter = this.filterRequest();
    return {
      ...currentFilter,
      month: dateRange.month || undefined,
      year: dateRange.year || undefined,
      page: 1,
    };
  }

  private updateFilterForTab(tab: string): ICandidateFilterRequest {
    const currentFilter = this.filterRequest();
    return { ...currentFilter, statusGroup: tab, page: 1 };
  }

  // อัปเดต updateFilterForSort method ให้รองรับ sort direction
  private updateFilterForSort(column: string): ICandidateFilterRequest {
    const currentFilter = this.filterRequest();
    const currentSort = this.sortConfig();

    const sortedColumns = Object.keys(currentSort);
    // แปลงเป็น string เพื่อส่งไปยัง API/subject
    const sortFields = sortedColumns
      .map((c) => `${c}:${currentSort[c]}`)
      .join(',');

    return {
      ...currentFilter,
      sortFields: sortFields || undefined,
      page: 1,
    };
  }

  // Private Utility Methods
  private createInitialFilter(): ICandidateFilterRequest {
    return {
      page: 1,
      pageSize: CONFIG.DEFAULT_PAGE_SIZE,
      status: CONFIG.DEFAULT_STATUS,
    };
  }

  private createInitialTabs(): TabMenu[] {
    return [
      { key: '', label: 'All Applications', count: 0 },
      { key: 'new', label: 'New Applications', count: 0 },
      { key: 'over3', label: 'Over 3 Days', count: 0 },
      { key: 'overweek', label: 'Over 1 Week', count: 0 },
      { key: 'overmonth', label: 'Over 1 Month', count: 0 },
    ];
  }

  private safeGetStatusCount(
    statusGroupCount: StatusGroupCount,
    key: string
  ): number {
    return statusGroupCount[key] ?? 0;
  }

  private extractDateRange(event: {
    startDate: string;
    endDate: string;
  }): DateRange {
    const startMonth = event.startDate.substring(5, 7);
    const endMonth = event.endDate.substring(5, 7);

    return {
      month: startMonth === endMonth ? endMonth : '',
      year: event.endDate.substring(0, 4),
    };
  }

  private transformApiDataToRows(
    items: readonly ICandidateWithPositionsDto[]
  ): ApplicationRow[] {
    return items.map((item) => this.transformSingleItem(item));
  }

  private transformSingleItem(
    item: ICandidateWithPositionsDto
  ): ApplicationRow {
    const summary = item.summary;

    return {
      id: summary.userID.toString(),
      qualifield: this.createQualifiedIcon(summary.qualifield),
      submitDate: summary.submitDate || '',
      userID: summary.userID.toString(),
      fullName: summary.fullName,
      position:
        item.positions?.map((pos: IPositionDto) => pos.namePosition) || [],
      university: summary.university,
      gpa: summary.gpa?.toString() || '',
      gradeCandidate: summary.gradeCandidate,
      totalCandidatePoint: `${summary.totalCandidatePoint}/4`,
      bdPoint: summary.bdPoint,
      gpaScore: summary.gpaScore,
      eqScore: summary.eqScore,
      ethicsScore: summary.ethicsScore,
      totalBonus: summary.totalBonus,
      submitStatusLabel: this.createStatusBadge(summary.submitStatusLabel),
    };
  }

  private createQualifiedIcon(qualified: number): IconConfig {
    return qualified === 1
      ? { icon: 'check-circle', fill: 'green', size: '25' }
      : { icon: 'xmark-circle', fill: 'red', size: '25' };
  }

  private createStatusBadge(statusLabel: string): BadgeConfig {
    return {
      label: statusLabel,
      class: BADGE_STYLES[statusLabel as keyof typeof BADGE_STYLES] || [
        'tw-bg-gray-50',
        'tw-text-gray-600',
        'tw-ring-gray-500/10',
      ],
    };
  }

  private isValidSearchOption(searchBy: string): searchBy is SearchOption {
    return SEARCH_OPTIONS.includes(searchBy as SearchOption);
  }

  private canLoadMore(element: HTMLElement): boolean {
    if (!element) return false;

    const { scrollHeight, scrollTop, clientHeight } = element;
    return scrollHeight - scrollTop <= clientHeight + CONFIG.SCROLL.THRESHOLD;
  }

  private resetPagination(): void {
    this.scrollToTop();
  }

  private scrollToTop(): void {
    requestAnimationFrame(() => {
      if (this.tableContainer?.nativeElement) {
        this.tableContainer.nativeElement.scrollTop = 0;
      }
    });
  }

  // อัปเดต Private Persistence Methods
  private loadPersistedState(): void {
    const persistedFilter = this.loadFromStorage<ICandidateFilterRequest>(
      CONFIG.STORAGE_KEYS.FILTER_SETTINGS
    );
    if (persistedFilter) {
      this.filterRequest.set({
        ...this.createInitialFilter(),
        ...persistedFilter,
      });
      this.filterDateRange = {
        month: persistedFilter.month || '',
        year: persistedFilter.year || '',
      };
    }

    const clickedRows = this.loadFromStorage<string[]>(
      CONFIG.STORAGE_KEYS.CLICKED_ROWS
    );
    if (clickedRows) {
      this.clickedRowIds.set(new Set(clickedRows));
    }

    // โหลด sort config จาก storage
    const persistedSortConfig = this.loadFromStorage<SortState>(
      CONFIG.STORAGE_KEYS.SORT_CONFIG
    );
    if (persistedSortConfig) {
      this.sortConfig.set(persistedSortConfig);
    }
  }

  private persistCurrentState(): void {
    this.persistFilterState();
    this.persistClickedRows(this.clickedRowIds());
    this.persistSortConfig(this.sortConfig()); // เพิ่ม persist sort config
  }

  private persistFilterState(): void {
    this.saveToStorage(
      CONFIG.STORAGE_KEYS.FILTER_SETTINGS,
      this.filterRequest()
    );
  }

  private persistClickedRows(clickedRowIds: Set<string>): void {
    this.saveToStorage(
      CONFIG.STORAGE_KEYS.CLICKED_ROWS,
      Array.from(clickedRowIds)
    );
  }

  // เพิ่ม method สำหรับ persist sort config
  private persistSortConfig(sortConfig: SortState): void {
    this.saveToStorage(CONFIG.STORAGE_KEYS.SORT_CONFIG, sortConfig);
  }

  private saveToStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  }

  private loadFromStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error);
      return null;
    }
  }
}
