// shared/base/base-general-benefits.component.ts
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
import { NavigationStart, Router } from '@angular/router';
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

import { GeneralBenefitsService } from '../../services/admin-setting/general-benefits/general-benefits.service'
import {
    ApiResponse,
    IBenefitsFilterRequest,
    IBenefitsWithPositionsDto
} from '../../interfaces/admin-setting/general-benefits.interface';
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
    'welfareBenefits'
] as const;

export type SearchOption = (typeof SEARCH_OPTIONS)[number];

@Directive()
export abstract class BaseGeneralBenefitsComponent implements OnInit, OnDestroy {
    // Dependency Injection
    protected readonly router = inject(Router);
    protected readonly generalbenefitsService = inject(GeneralBenefitsService);
    protected readonly destroyRef = inject(DestroyRef);

    @ViewChild('tableContainer', { static: false })
    protected tableContainer!: ElementRef<HTMLElement>;

    // Abstract properties that child components must implement
    protected abstract getStorageKeys(): {
        FILTER_SETTINGS: string;
        CLICKED_ROWS: string;
        SORT_CONFIG: string;
    };

    protected abstract createInitialFilter(): IBenefitsFilterRequest;
    protected abstract transformApiDataToRows(
        items: readonly IBenefitsWithPositionsDto[]
    ): any[];

    // Reactive State Management with Signals
    protected readonly loadingState = signal(false);
    protected readonly filterRequest = signal<IBenefitsFilterRequest>(
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
    
    protected readonly tabChangeSubject = new BehaviorSubject<string>('');
    protected readonly columnSortSubject = new BehaviorSubject<string>('');
    protected readonly scrollSubject = new Subject<Event>();

    ngOnInit(): void {
        this.initializeComponent();
        this.setupReactiveStreams();
    }

    ngOnDestroy(): void {
        this.persistCurrentState();
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
        this.setupRouteChangeListener();
    }

    protected setupReactiveStreams(): void {
        this.setupTabChangeStream();
        this.setupColumnSortStream();
        this.setupScrollStream();
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
        filter: IBenefitsFilterRequest,
        append: boolean
    ): Observable<void> {
        if (this.isLoading()) return EMPTY;

        this.loadingState.set(true);

        const fullFilter: IBenefitsFilterRequest = {
            ...filter
        };

        return this.generalbenefitsService.getBenefitsWeb(fullFilter).pipe(
            tap((items) => this.handleApiResponse(items, append)),
            tap(() => this.persistFilterState()),
            catchError((error) => this.handleApiError(error)),
            tap(() => this.loadingState.set(false)),
            map(() => void 0)
        );
    }

    protected setupRouteChangeListener(): void {
        this.router.events
            .pipe(
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(event => {
                if (event instanceof NavigationStart) {
                    this.clearPersistedSearchForm();
                }
            });
    }

    protected clearPersistedSearchForm(): void {
        const storageKeys = this.getStorageKeys();
        localStorage.removeItem(storageKeys.FILTER_SETTINGS + '_SEARCH_FORM');
    }

    protected loadInitialData(): void {
        this.fetchData(this.filterRequest(), false).subscribe();
    }

    protected handleApiResponse(
        response: IBenefitsWithPositionsDto[], 
        append: boolean
    ): void {
        this.updateFilterWithResponse(response);
        this.updateRowsData(response, append);
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
            // page: response.page,
            // hasNextPage: response.hasNextPage,
        });
    }

    protected updateRowsData(
        items: readonly IBenefitsWithPositionsDto[],
        append: boolean
    ): void {
        const processedRows = this.transformApiDataToRows(items);
        const currentRows = this.rowsData();
        this.rowsData.set(
            append ? [...currentRows, ...processedRows] : processedRows
        );
    }

    protected updateFilterForSort(column: string): IBenefitsFilterRequest {
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

        const persistedFilter = this.loadFromStorage<IBenefitsFilterRequest>(
            storageKeys.FILTER_SETTINGS
        );
        if (persistedFilter) {
            this.filterRequest.set({
                ...this.createInitialFilter(),
                ...persistedFilter,
            });
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
