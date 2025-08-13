// shared/base/base-user.component.ts
import {
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  computed,
  signal,
  ViewChild,
  ElementRef,
  Directive,
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
  exhaustMap,
  skip,
} from 'rxjs';

import { UserWebService } from '../../services/admin-setting/user-web/user-web.service';
import {
  ApiResponse,
  IUserFilterRequest,
  IUserWithPositionsDto,
  SearchForm,
  DateRange
} from '../../interfaces/admin-setting/user-web.interface';
import { SortState } from '../../shared/components/tables/tables.component';

// Shared Configuration
export const BASE_CONFIG = {
  DEBOUNCE_TIME: 300,
  DEFAULT_PAGE_SIZE: 30,
  SCROLL: {
    THRESHOLD: 2,
  },
} as const;

export const SEARCH_OPTIONS: string[] = [
  'Employee ID',
  'Username'
] as const;

export type SearchOption = (typeof SEARCH_OPTIONS)[number];

@Directive()
export abstract class BaseUserWebComponent implements OnInit, OnDestroy {
  // Dependency Injection
  protected readonly router = inject(Router);
  protected readonly userwebService = inject(UserWebService);
  protected readonly destroyRef = inject(DestroyRef);

  @ViewChild('tableContainer', { static: false })
  protected tableContainer!: ElementRef<HTMLElement>;

  // Abstract properties that child components must implement
  protected abstract getStorageKeys(): {
    FILTER_SETTINGS: string;
    CLICKED_ROWS: string;
    SORT_CONFIG: string;
  };

  protected abstract createInitialFilter(): IUserFilterRequest;
  protected abstract transformApiDataToRows(
    items: readonly IUserWithPositionsDto[]
  ): any[];

  // Reactive State Management with Signals
  protected readonly loadingState = signal(false);
  protected readonly filterRequest = signal<IUserFilterRequest>(
    this.createInitialFilter()
  );
  protected readonly rowsData = signal<any[]>([]);
  protected readonly clickedRowIds = signal<Set<string>>(new Set());
  protected readonly sortConfig = signal<SortState>({});

  // Computed Properties
  readonly isLoading = computed(() => this.loadingState());
  readonly rows = computed(() => this.rowsData());
//   readonly activeTab = computed(() => this.filterRequest().statusGroup || '');
  readonly currentSort = computed(() => this.sortConfig());

  readonly resetCounter = signal<number>(0);

  // Subjects for reactive streams
  protected readonly searchSubject = new BehaviorSubject<SearchForm>({
    searchBy: '',
    searchValue: '',
  });
  protected readonly dateRangeSubject = new BehaviorSubject<DateRange>({
    month: '',
    year: '',
  });
  protected readonly tabChangeSubject = new BehaviorSubject<string>('');
  protected readonly columnSortSubject = new BehaviorSubject<string>('');
  protected readonly scrollSubject = new Subject<Event>();

  // Public Properties
  readonly searchByOptions = SEARCH_OPTIONS;
  searchForm: SearchForm = { searchBy: '', searchValue: '' };
//   filterDateRange: DateRange = { month: '', year: '' };

  ngOnInit(): void {
    this.initializeComponent();
    this.setupReactiveStreams();
  }

  ngOnDestroy(): void {
    this.persistCurrentState();
  }

  // Public Event Handlers
  onSearch(form: SearchForm): void {
    // this.searchSubject.next(form);
    this.searchSubject.next({
      ...form,
      __marker: Date.now()
    } as any);
  }

  onClearSearch(): void {
    this.searchForm = { searchBy: '', searchValue: '' };
    // this.searchSubject.next(this.searchForm);
    const forceTriggerSearch = {
      ...(this.searchForm as any),
      __marker: Date.now()
    };
    this.searchSubject.next(forceTriggerSearch);
  }

  async onColumnClick(payload: { state: SortState; order: string[] }): Promise<void> {
    const { state, order } = payload;
    const filteredSortState = Object.keys(state)
      .filter((key) => state[key] !== null)
      .reduce((acc, key) => {
        acc[key] = state[key];
        return acc;
      }, {} as SortState);

    const sortedColumns = Object.keys(filteredSortState);
    const sortedColumnsString = sortedColumns
      .map((c) => `${c}:${filteredSortState[c]}`)
      .join(',');

    this.persistSortConfig(filteredSortState);
    this.columnSortSubject.next(sortedColumnsString);
  }

  onScroll(event: Event): void {
    this.scrollSubject.next(event);
  }

  onClickedRowsChanged(clickedRowIds: Set<string>): void {
    this.clickedRowIds.set(new Set(clickedRowIds));
    this.persistClickedRows(clickedRowIds);
  }

  // Protected Initialization Methods
  protected initializeComponent(): void {
    this.loadPersistedState();
    this.loadInitialData();
  }

  protected setupReactiveStreams(): void {
    this.setupSearchStream();
    this.setupDateRangeStream();
    this.setupTabChangeStream();
    this.setupColumnSortStream();
    this.setupScrollStream();
  }

  protected setupSearchStream(): void {
    this.searchSubject
      .pipe(
        skip(1),
        debounceTime(BASE_CONFIG.DEBOUNCE_TIME),
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

  protected setupDateRangeStream(): void {
    this.dateRangeSubject
      .pipe(
        skip(1),
        // distinctUntilChanged(
        //   (prev, curr) => prev.month === curr.month && prev.year === curr.year
        // ),
        tap(() => this.resetPagination()),
        // switchMap((dateRange) => this.handleDateRangeChange(dateRange)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  protected setupTabChangeStream(): void {
    this.tabChangeSubject
      .pipe(
        skip(1),
        distinctUntilChanged(),
        tap(() => this.resetPagination()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  protected setupColumnSortStream(): void {
    this.columnSortSubject
      .pipe(
        skip(1),
        distinctUntilChanged(),
        tap(() => this.resetPagination()),
        switchMap((column) => this.handleColumnSort(column)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

 
  protected setupScrollStream(): void {
    this.scrollSubject.pipe(
      debounceTime(100),
      exhaustMap((event) => this.handleInfiniteScroll(event)), 
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  // Protected Stream Handlers
  protected handleSearch(searchForm: SearchForm): Observable<void> {
    const updatedFilter = this.updateFilterForSearch(searchForm);
    return this.fetchData(updatedFilter, false);
  }

  protected handleColumnSort(column: string): Observable<void> {
    const updatedFilter = this.updateFilterForSort(column);
    return this.fetchData(updatedFilter, false);
  }

  protected handleInfiniteScroll(event: Event): Observable<void> {
    const element = event.target as HTMLElement;
    if (!this.canLoadMore(element)) return EMPTY;

    const currentFilter = this.filterRequest();
    if (currentFilter.hasNextPage && !this.isLoading()) {
      const updatedFilter = { ...currentFilter, page: currentFilter.page + 1 };
      return this.fetchData(updatedFilter, true);
    }
    
    return EMPTY;
  }
  
  // Protected Data Fetching
  protected fetchData(
    filter: IUserFilterRequest,
    append: boolean
  ): Observable<void> {
    if (this.isLoading()) return EMPTY;

    this.loadingState.set(true);
    // this.filterRequest.set(filter);

    const fullFilter: IUserFilterRequest = {
      ...filter,
      search: this.searchForm.searchValue || undefined
    };
    
    return this.userwebService.getUserWeb(fullFilter).pipe(
      tap((response) => this.handleApiResponse(response, append)),
      tap(() => this.persistFilterState()),
      catchError((error) => this.handleApiError(error)),
      tap(() => this.loadingState.set(false)),
      map(() => void 0)
    );
  }

  protected loadInitialData(): void {
    this.fetchData(this.filterRequest(), false).subscribe();
  }

  // Protected Response Handlers
  protected handleApiResponse(response: ApiResponse, append: boolean): void {
    this.updateFilterWithResponse(response);
    this.updateRowsData(response.items, append);
  }

  protected handleApiError(error: any): Observable<never> {
    console.error('API Error:', error);
    return EMPTY;
  }

  // Protected State Updates
  protected updateFilterWithResponse(response: ApiResponse): void {
    const currentFilter = this.filterRequest();
    this.filterRequest.set({
      ...currentFilter,
      page: response.page,
      hasNextPage: response.hasNextPage,
    });
  }

  protected updateRowsData(
    items: readonly IUserWithPositionsDto[],
    append: boolean
  ): void {
    const processedRows = this.transformApiDataToRows(items);
    const currentRows = this.rowsData();
    this.rowsData.set(
      append ? [...currentRows, ...processedRows] : processedRows
    );
  }

  // Protected Filter Updates
  protected updateFilterForSearch(
    searchForm: SearchForm
  ): IUserFilterRequest {
    const currentFilter = this.filterRequest();
    const search = this.isValidSearchOption(searchForm.searchBy)
      ? searchForm.searchValue || undefined
      : undefined;

    return { ...currentFilter, page: 1 };
  }

//   protected updateFilterForDateRange(
//     dateRange: DateRange
//   ): IUserFilterRequest {
//     const currentFilter = this.filterRequest();
//     return {
//       ...currentFilter,
//       page: 1,
//     };
//   }

  protected updateFilterForSort(column: string): IUserFilterRequest {
    const currentFilter = this.filterRequest();
    
    return {
      ...currentFilter,
      page: 1,
      sortFields: column
    };
  }

  // Protected Utility Methods
  protected safeGetStatusCount(statusGroupCount: any, key: string): number {
    return statusGroupCount?.[key] ?? 0;
  }
  
  protected isValidSearchOption(searchBy: string): searchBy is SearchOption {
    return SEARCH_OPTIONS.includes(searchBy as SearchOption);
  }

  protected canLoadMore(element: HTMLElement): boolean {
    if (!element) return false;

    const { scrollHeight, scrollTop, clientHeight } = element;
    return (
      scrollHeight - scrollTop <= clientHeight + BASE_CONFIG.SCROLL.THRESHOLD
    );
  }

  protected resetPagination(): void {
    this.scrollToTop();
  }

  protected scrollToTop(): void {
    requestAnimationFrame(() => {
      if (this.tableContainer?.nativeElement) {
        this.tableContainer.nativeElement.scrollTop = 0;
      }
    });
  }

  // Protected Persistence Methods
  protected loadPersistedState(): void {
    const storageKeys = this.getStorageKeys();

    const persistedFilter = this.loadFromStorage<IUserFilterRequest>(
      storageKeys.FILTER_SETTINGS
    );
    if (persistedFilter) {
      this.filterRequest.set({
        ...this.createInitialFilter(),
        ...persistedFilter,
      });
    //   this.filterDateRange = {
    //     month: persistedFilter.month || '',
    //     year: persistedFilter.year || '',
    //   };
    }

    const clickedRows = this.loadFromStorage<string[]>(
      storageKeys.CLICKED_ROWS
    );
    if (clickedRows) {
      this.clickedRowIds.set(new Set(clickedRows));
    }

    const persistedSortConfig = this.loadFromStorage<SortState>(
      storageKeys.SORT_CONFIG
    );
    if (persistedSortConfig) {
      this.sortConfig.set(persistedSortConfig);
    }
  }

  protected persistCurrentState(): void {
    this.persistFilterState();
    this.persistClickedRows(this.clickedRowIds());
    this.persistSortConfig(this.sortConfig());
  }

  protected persistFilterState(): void {
    const storageKeys = this.getStorageKeys();
    this.saveToStorage(storageKeys.FILTER_SETTINGS, this.filterRequest());
  }

  protected persistClickedRows(clickedRowIds: Set<string>): void {
    const storageKeys = this.getStorageKeys();
    this.saveToStorage(storageKeys.CLICKED_ROWS, Array.from(clickedRowIds));
  }

  protected persistSortConfig(sortConfig: SortState): void {
    const storageKeys = this.getStorageKeys();
    this.saveToStorage(storageKeys.SORT_CONFIG, sortConfig);
  }

  protected saveToStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  }

  protected loadFromStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error);
      return null;
    }
  }
}
