// tracking.component.ts
import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  OnDestroy,
  signal,
  computed,
  HostListener,
} from '@angular/core';
import { Observable, tap, catchError, EMPTY, map } from 'rxjs';

import { BaseApplicationComponent } from '../../../shared/base/base-application.component';
import {
  ICandidateFilterRequest,
  ICandidateWithPositionsDto,
  IPositionDto,
  TabMenu,
  ICandidateTrackingFilterRequest,
  SearchForm,
} from '../../../interfaces/Application/application.interface';
import { Columns } from '../../../shared/interfaces/tables/column.interface';
import {
  FilterConfig,
  GroupedCheckboxOption,
} from '../../../shared/components/filter-check-box/filter-check-box.component';
import { TrackingRow } from '../../../interfaces/Application/tracking.interface';

// Component-specific Configuration
const TRACKING_CONFIG = {
  STORAGE_KEYS: {
    FILTER_SETTINGS: 'trackingFiterSettings',
    CLICKED_ROWS: 'trackingClickedRowIndexes',
    SORT_CONFIG: 'trackingSortConfig',
    HEADER_SEARCH_FORM: 'trackingHeaderSearchForm',
  },
} as const;

// Status ID to Icon mapping
const STATUS_ICON_MAP: Record<
  number,
  { icon: string; fill?: string; size?: string; extraClass?: string }
> = {
  12: {icon: 'minus-circle-solid', extraClass: 'fill-gray-light-1', size: '25'}, // Pending
  15: { icon: 'check-circle-solid', fill: 'skyblue', size: '25' }, // Scheduled
  20: { icon: 'onhold-solid', fill: 'orange', size: '25' }, // On Hold
  21: { icon: 'check-circle-solid', fill: 'green', size: '25' }, // Accept
  22: { icon: 'xmark-circle-solid', fill: 'red', size: '25' }, // Decline
  23: { icon: 'xmark-circle-solid', fill: 'purple', size: '25' }, // NO SHOW PINE (นัดสัมภาษณ์แล้ว candidate ติดต่อไม่ได้)
  25: { icon: 'xmark-circle-solid', fill: 'pink', extraClass: 'fill-pink', size: '25' }, // NO SHOW Candidate (นัดสัมภาษณ์แล้ว candidate ยกเลิกการสัมภาษณ์)
  41: { icon: 'check-circle-solid', fill: 'green', size: '25' }, // Onboarded
  44: { icon: 'xmark-circle-solid', fill: 'red', size: '25' }, // Declined onboard
};

@Component({
  selector: 'app-tracking',
  templateUrl: './tracking.component.html',
  styleUrl: './tracking.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackingComponent
  extends BaseApplicationComponent
  implements AfterViewInit, OnDestroy
{
  // Additional ViewChild for tracking-specific functionality
  @ViewChild('filter', { static: false }) filterRef!: ElementRef;
  @ViewChild('tableContainer') tableContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  hasOverflowY = false;
  private ro?: ResizeObserver;

  // Tracking-specific state
  private readonly trackingFilterRequest =
    signal<ICandidateTrackingFilterRequest>({
      page: 1,
      pageSize: 30,
    });
  private readonly filterHeight = signal<number>(0);
  private resizeObserver!: ResizeObserver;

  // Computed properties for tracking
  readonly currentTrackingFilter = computed(() => this.trackingFilterRequest());

  // Table Configuration
  readonly columns: Columns = [
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
      // maxWidth: '400px',
      minWidth: '264px',
      width: '16%',
      wrapText: true,
    },
    {
      header: 'University',
      field: 'university',
      type: 'text',
      // maxWidth: '400px',
      minWidth: '264px',
      width: '16%',
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
      header: 'Applied',
      field: 'applied',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Screen',
      field: 'statusCSD',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Interview1',
      field: 'interview1',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Interview2',
      field: 'interview2',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Offered',
      field: 'offer',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Hired',
      field: 'hired',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Last Update',
      field: 'lastUpdate',
      type: 'date',
      align: 'center',
      sortable: true,
    },
  ] as const;

  // Filter configuration for tracking
  readonly filterItems: GroupedCheckboxOption[] = [
    {
      groupKey: 'applied',
      groupLabel: 'Applied',
      options: [{ key: 'received', label: 'Received (20,000)' }],
    },
    {
      groupKey: 'screened',
      groupLabel: 'Screened',
      options: [
        { key: 'pending', label: 'Pending (3,000)' },
        { key: 'accept', label: 'Accept (3,000)' },
        { key: 'decline', label: 'Decline (3,000)' },
        { key: 'hold', label: 'On Hold (3,000)' },
      ],
    },
    {
      groupKey: 'interview1',
      groupLabel: 'Interview 1',
      options: [
        { key: '12', label: 'Pending' },
        { key: '15', label: 'Scheduled' },
        { key: '23', label: 'No-Show (PINE)' },
        { key: '25', label: 'No-Show (Candidate)' },
        { key: '21', label: 'Accept' },
        { key: '22', label: 'Decline' },
      ],
    },
    {
      groupKey: 'interview2',
      groupLabel: 'Interview 2',
      options: [
        { key: '12', label: 'Pending' },
        { key: '15', label: 'Scheduled' },
        { key: '23', label: 'No-Show (PINE)' },
        { key: '25', label: 'No-Show (Candidate)' },
        { key: '21', label: 'Accept' },
        { key: '22', label: 'Decline' },
      ],
    },
    {
      groupKey: 'offered',
      groupLabel: 'Offered',
      options: [
        { key: '12', label: 'Pending' },
        { key: '41', label: 'Accept' },
        { key: '44', label: 'Decline' },
      ],
    },
    {
      groupKey: 'hired',
      groupLabel: 'Hired',
      options: [
        { key: '41', label: 'Onboarded' },
        { key: '25', label: 'No-Show' },
        { key: '44', label: 'Decline' },
      ],
    },
  ];

  readonly filterConfig: FilterConfig = {
    expandAllByDefault: true,
    animationDuration: 300,
  };

  // Abstract method implementations
  protected getStorageKeys() {
    return TRACKING_CONFIG.STORAGE_KEYS;
  }

  protected createInitialFilter(): ICandidateFilterRequest {
    return {
      page: 1,
      pageSize: 30,
      month: '7', // Set default month
    };
  }

  protected createInitialTabs(): TabMenu[] {
    return [
      { key: '', label: 'All Applications', count: 0 },
      { key: 'pending', label: 'Pending', count: 0 },
      { key: 'accept', label: 'Accepted', count: 0 },
      { key: 'decline', label: 'Declined', count: 0 },
      { key: 'hold', label: 'On Hold', count: 0 },
    ];
  }

  override onSearch(form: SearchForm): void {
    // clone เพื่อกัน reference เดิม
    const payload: SearchForm = {
      searchBy: form.searchBy,
      searchValue: form.searchValue,
    };

    // persist UI
    const { HEADER_SEARCH_FORM } = this.getStorageKeys();
    this.saveToStorage(HEADER_SEARCH_FORM, payload);

    // ส่งต่อให้ Base (ซึ่งจะเติม __nonce ให้เองและรีเฟรชทุกครั้ง)
    super.onSearch(payload);
  }

  override onClearSearch(): void {
    this.searchForm = { searchBy: '', searchValue: '' };

    const { HEADER_SEARCH_FORM } = this.getStorageKeys();
    this.saveToStorage(HEADER_SEARCH_FORM, { searchBy: '', searchValue: '' });

    super.onClearSearch();
  }

  protected transformApiDataToRows(
    items: readonly ICandidateWithPositionsDto[]
  ): TrackingRow[] {
    return items.map((item) => this.transformSingleItem(item));
  }

  // Override for tracking-specific data fetching
  protected override fetchData(
    filter: ICandidateFilterRequest,
    append: boolean
  ): Observable<void> {
    if (this.isLoading()) return EMPTY;

    this.loadingState.set(true);
    this.filterRequest.set(filter);

    // Convert to tracking filter request
    const trackingFilter: ICandidateTrackingFilterRequest = {
      ...filter,
      ...this.trackingFilterRequest(),
    };

    return this.applicationService.getTrackingApplications(trackingFilter).pipe(
      tap((response: any) => this.handleApiResponse(response, append)),
      tap(() => this.persistFilterState()),
      catchError((error: any) => this.handleApiError(error)),
      tap(() => this.loadingState.set(false)),
      map(() => void 0)
    );
  }

  protected override persistFilterState(): void {
    const storageKeys = this.getStorageKeys();
    const normalized = this.normalizeTrackingFilter(this.filterRequest());
    this.saveToStorage(storageKeys.FILTER_SETTINGS, normalized);
  }

  // Lifecycle hooks
  ngAfterViewInit(): void {
    super.ngOnInit();
    this.updateTableHeight();
    this.setupResizeObserver();
  }

  override ngOnDestroy(): void {
    this.ro?.disconnect?.();
    super.ngOnDestroy();
    this.disconnectResizeObserver();
  }

  // Tracking-specific methods
  onFiltersSelected(filters: Record<string, string[]>): void {
    const currentTrackingFilter = this.trackingFilterRequest();

    // Update tracking filter
    const updatedTrackingFilter: ICandidateTrackingFilterRequest = {
      ...currentTrackingFilter,
      page: 1,
    };

    // Handle status (screened)
    const screened = filters['screened']?.[0];
    if (['accept', 'decline', 'hold'].includes(screened)) {
      updatedTrackingFilter.status = screened;
    } else {
      delete updatedTrackingFilter.status;
    }

    // Helper function for parsing arrays
    const parseToIntArray = (values?: string[]) =>
      values?.map((v) => parseInt(v)).filter((v) => !isNaN(v)) ?? [];

    // Update tracking-specific filters
    updatedTrackingFilter.interview1 = filters['interview1']?.length
      ? parseToIntArray(filters['interview1'])
      : undefined;

    updatedTrackingFilter.interview2 = filters['interview2']?.length
      ? parseToIntArray(filters['interview2'])
      : undefined;

    updatedTrackingFilter.offer = filters['offered']?.length
      ? parseToIntArray(filters['offered'])
      : undefined;

    updatedTrackingFilter.hired = filters['hired']?.length
      ? parseToIntArray(filters['hired'])
      : undefined;

    this.trackingFilterRequest.set(updatedTrackingFilter);
    this.resetPagination();
    this.fetchData(this.filterRequest(), false).subscribe();
  }

  // Private methods
  private transformSingleItem(item: any): TrackingRow {
    return {
      id: item.userID.toString(),
      submitDate: item.submitDate || '',
      userID: item.userID.toString(),
      fullName: item.fullName,
      fullNameTH: item.fullNameTH,
      position: item.positions?.map((pos: any) => pos.namePosition) || [],
      university: item.university,
      gpa: item.gpa?.toString() || '',
      gradeCandidate: item.gradeCandidate,
      applied: this.mapStatusIdToIcon(21) || STATUS_ICON_MAP[12],
      statusCSD: this.mapStatusIdToIcon(item.statusCSD) || STATUS_ICON_MAP[12],
      interview1:
        this.mapStatusIdToIcon(item.interview1?.id) || STATUS_ICON_MAP[12],
      interview2:
        this.mapStatusIdToIcon(item.interview2?.id) || STATUS_ICON_MAP[12],
      offer: this.mapStatusIdToIcon(item.offer?.id) || STATUS_ICON_MAP[12],
      hired: this.mapStatusIdToIcon(item.hired?.id) || STATUS_ICON_MAP[12],
      lastUpdate: item.lastUpdate,
      roundID: item.roundID,
    };
  }

  private mapStatusIdToIcon(
    id: number
  ): {
    icon: string;
    fill?: string;
    size?: string;
    extraClass?: string;
  } | null {
    return STATUS_ICON_MAP[id] || STATUS_ICON_MAP[12];
  }

  private setupResizeObserver(): void {
    if (this.filterRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateTableHeight();
      });
      this.resizeObserver.observe(this.filterRef.nativeElement);
    }
  }

  // เพิ่ม HostListener สำหรับรีไซส์หน้าต่าง
  @HostListener('window:resize')
  onWindowResize() {
    this.updateTableHeight();
  }

  private disconnectResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private updateTableHeight(): void {
    requestAnimationFrame(() => {
      const container = this.tableContainerRef?.nativeElement;
      if (!container) return;

      // วัดระยะจากขอบบนของ container ถึงขอบล่างของ viewport
      const top = container.getBoundingClientRect().top;
      const viewportH = window.innerHeight;
      const bottomGap = 16; // กันไว้เล็กน้อยไม่ให้ชนขอบ

      const newHeight = Math.max(240, viewportH - top - bottomGap);
      container.style.height = `${newHeight}px`;

      // อัปเดตสถานะมีสกรอลล์แนวตั้งหรือไม่ (ส่งต่อไปที่ <app-tables [hasOverflowY]>)
      const hasOverflow = container.scrollHeight > container.clientHeight;
      if (this.hasOverflowY !== hasOverflow) {
        this.hasOverflowY = hasOverflow;
      }
    });
  }

  // Override persistence methods to handle tracking-specific data
  protected override loadPersistedState(): void {
    super.loadPersistedState();

    // 1) normalize filterRequest ที่ Base เพิ่งเซ็ตขึ้นมา
    const normalized = this.normalizeTrackingFilter(this.filterRequest());
    this.filterRequest.set({ ...this.createInitialFilter(), ...normalized });
    this.filterDateRange = {
      month: normalized.month || '',
      year: normalized.year || '',
    };

    // 2) restore Header search UI
    const { HEADER_SEARCH_FORM } = this.getStorageKeys();
    const headerForm = this.loadFromStorage<{ searchBy: string; searchValue: string }>(HEADER_SEARCH_FORM);
    if (headerForm) {
      this.searchForm = { ...headerForm };
    } else if (normalized.search) {
      // fallback: ถ้ามี search แต่ยังไม่เคยเก็บ UI
      this.searchForm = {
        searchBy: this.searchByOptions?.[0] || 'Application ID',
        searchValue: normalized.search,
      };
    }

    // 3) set default month '7' ถ้ายังไม่มี (พฤติกรรมเดิม)
    const currentFilter = this.filterRequest();
    if (!currentFilter.month) {
      this.filterDateRange.month = '7';
      this.trackingFilterRequest.update((filter) => ({
        ...filter,
        month: '7',
      }));
    }
  }

  // Helper method for creating pipe operators (extracted for reusability)
  private createDataPipeOperators(append: boolean): Observable<void> {
    const trackingFilter: ICandidateTrackingFilterRequest = {
      ...this.filterRequest(),
      ...this.trackingFilterRequest(),
    };

    return this.applicationService.getTrackingApplications(trackingFilter).pipe(
      tap((response: any) => this.handleApiResponse(response, append)),
      tap(() => this.persistFilterState()),
      catchError((error: any) => this.handleApiError(error)),
      tap(() => this.loadingState.set(false)),
      map(() => void 0)
    );
  }

  override onRowClick(row: any): void {
    const id = (row as any)?.id;
    if (!id) return;
    console.log('Row clicked:', row);

    const queryParams = {
      id,
      round: (row as any)?.roundID
    };
    this.router.navigate(['/applications/tracking/application-form'], { queryParams });
  }

  private normalizeTrackingFilter(f: ICandidateFilterRequest | null | undefined): ICandidateFilterRequest {
    const src: any = f || {};
    const status = src.status ?? src.statusGroup ?? undefined;

    const cleaned: any = {
      page: src.page ?? 1,
      pageSize: src.pageSize ?? 30,
      status,
      search: src.search ?? undefined,
      month: src.month ?? undefined,
      year: src.year ?? undefined,
      sortFields: src.sortFields ?? undefined,
      hasNextPage: src.hasNextPage ?? undefined,
    };

    Object.keys(cleaned).forEach((k) => cleaned[k] === undefined && delete cleaned[k]);
    return cleaned as ICandidateFilterRequest;
  }

}
