// screening.component.ts
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  ViewChild,
  ElementRef,
  effect,
  Injector,
} from '@angular/core';

import { BaseApplicationComponent } from '../../../shared/base/base-application.component';
import {
  ApiResponse,
  ApplicationRow,
  ICandidateFilterRequest,
  ICandidateWithPositionsDto,
  IPositionDto,
  ScreeningRow,
  SearchForm,
  TabMenu,
} from '../../../interfaces/Application/application.interface';
import { Columns } from '../../../shared/interfaces/tables/column.interface';
import { createStatusBadge } from '../../../utils/application/badge-utils';
import { FormDialogComponent } from '../../../shared/components/dialogs/form-dialog/form-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { SortState } from '../../../shared/components/tables/tables.component';

// Component-specific Configuration
// const SCREENING_CONFIG = {
// STORAGE_KEYS: {
//   FILTER_SETTINGS: 'screeningFiterSettings',
//   CLICKED_ROWS: 'screeningClickedRowIndexes',
//   SORT_CONFIG: 'screeningSortConfig',
//   HEADER_SEARCH_FORM: 'screeningHeaderSearchForm',
// },
// } as const;

@Component({
  selector: 'app-screening',
  templateUrl: './screening.component.html',
  styleUrl: './screening.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScreeningComponent extends BaseApplicationComponent {
  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  hasOverflowY = false;
  private ro?: ResizeObserver;

  constructor(
    private dialog: MatDialog,
    private injector: Injector,
  ) {
    super();
  }

  // Table Configuration
  readonly columns: Columns = [
    {
      header: 'Screening',
      field: 'screening',
      type: 'badge',
      align: 'center'
    },
    {
      header: 'Submit Date',
      field: 'submitDate',
      type: 'date',
      align: 'center',
      sortable: true
    },
    {
      header: 'Screen Date',
      field: 'employeeActionDate',
      type: 'date',
      align: 'center',
      sortable: true
    },
    {
      header: 'Applicant ID',
      field: 'userID',
      type: 'text',
      align: 'center',
      sortable: true
    },
    {
      header: 'Applicant Name',
      field: 'fullName',
      type: 'text',
      sortable: true
    },
    {
      header: 'Job Position',
      field: 'position',
      type: 'list',
      // maxWidth: '400px',
      minWidth: '264px',
      width: '16%',
      wrapText: true
    },
    {
      header: 'University',
      field: 'university',
      type: 'text',
      // maxWidth: '400px',
      minWidth: '264px',
      width: '16%',
      wrapText: true,
      sortable: true
    },
    {
      header: 'GPA',
      field: 'gpa',
      type: 'text',
      align: 'center',
      sortable: true
    },
    {
      header: 'Grade',
      field: 'gradeCandidate',
      type: 'text',
      align: 'center',
      maxWidth: '20px',
      sortable: true
    },
    {
      header: 'Total Score',
      field: 'totalCandidatePoint',
      type: 'expandable',
      align: 'right',
      mainColumn: 'totalCandidatePoint',
      sortable: true
    },
    {
      header: 'Education (1 Point)',
      field: 'bdPoint',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true
    },
    {
      header: 'GPA (1 Point)',
      field: 'gpaScore',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true
    },
    {
      header: 'Test EQ (1 Point)',
      field: 'eqScore',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true
    },
    {
      header: 'Test Ethics (1 Point)',
      field: 'ethicsScore',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true
    },
    // {
    //   header: 'Bonus',
    //   field: 'totalBonus',
    //   type: 'text',
    //   align: 'right',
    //   sortable: true
    // },
    {
      header: 'Screen By',
      field: 'employeeAction',
      type: 'text',
      align: 'center',
      sortable: true
    },
    {
      header: 'Status',
      field: 'submitStatusLabel',
      type: 'badge',
      align: 'center',
    },
  ] as const;

  ngAfterViewInit(): void {
    this.measureOverflow();

    this.ro = new ResizeObserver(() => this.measureOverflow());
    this.ro.observe(this.scrollArea.nativeElement);

    // 👇 วัดใหม่ทุกครั้งที่ rows() อัปเดตจาก Base
    effect(() => {
      const _ = this.rows();          // อ่านค่าเพื่อให้ effect ติดตาม
      queueMicrotask(() => this.measureOverflow()); // วัดหลัง DOM อัปเดต
    }, { injector: this.injector });
  }

  measureOverflow(): void {
    const el = this.scrollArea.nativeElement;
    this.hasOverflowY = el.scrollHeight > el.clientHeight;
  }

  // Abstract method implementations
  // protected getStorageKeys() {
  //   return SCREENING_CONFIG.STORAGE_KEYS;
  // }

  // protected createInitialFilter(): ICandidateFilterRequest {
  //   return {
  //     page: 1,
  //     pageSize: 30,
  //   };
  // }

  protected createInitialFilter(): ICandidateFilterRequest {
    const d = new Date();
    d.setMonth(d.getMonth());

    return {
      page: 1,
      pageSize: 30,
      month: String(d.getMonth() + 1),
      year: String(d.getFullYear()),
    };
  }

  protected createInitialTabs(): TabMenu[] {
    return [
      { key: 'total', label: 'All Applications', count: 0 },
      // { key: 'pending', label: 'Pending', count: 0 },
      { key: 'accept', label: 'Accepted', count: 0 },
      { key: 'decline', label: 'Declined', count: 0 },
      { key: 'hold', label: 'On Hold', count: 0 },
    ];
  }

  override onSearch(form: SearchForm): void {
    // 1) clone เพื่อไม่ให้ reference ชี้ตัวเดียวกับที่ ngModel จะเปลี่ยนต่อ
    const payload: SearchForm = {
      searchBy: form.searchBy,
      searchValue: form.searchValue
    };

    // 2) persist UI ของ Header
    // const { HEADER_SEARCH_FORM } = this.getStorageKeys();
    // this.saveToStorage(HEADER_SEARCH_FORM, payload);

    // 3) ส่งต่อไปยังสตรีมใน Base (จะผ่าน distinctUntilChanged ได้ถูกต้อง)
    super.onSearch(payload);
  }

  override onClearSearch(): void {
    // เคลียร์ UI + storage
    this.searchForm = { searchBy: '', searchValue: '' };
    // const { HEADER_SEARCH_FORM } = this.getStorageKeys();
    // this.saveToStorage(HEADER_SEARCH_FORM, { searchBy: '', searchValue: '' });

    // ทำงานเดิม (ส่งสัญญาณ clear)
    super.onClearSearch();
  }

  protected transformApiDataToRows(
    items: readonly ICandidateWithPositionsDto[]
  ): ScreeningRow[] {
    return items.map((item) => this.transformSingleItem(item));
  }


  // Override tab change behavior for screening-specific logic
  protected override updateFilterForTab(tab: string): ICandidateFilterRequest {
    // ตัด statusGroup ทิ้งให้เกลี้ยง เพื่อไม่ให้ไปกระทบ API/สเตท
    const { statusGroup, ...rest } = this.filterRequest() as any;
    return { ...rest, status: tab, page: 1 };
  }

  // screening.component.ts (เพิ่ม override สำหรับ updateFilterForSearch)
  protected override updateFilterForSearch(searchForm: SearchForm): ICandidateFilterRequest {
    const { statusGroup, ...rest } = this.filterRequest() as any;
    const search = this.isValidSearchOption(searchForm.searchBy)
      ? (searchForm.searchValue || undefined)
      : undefined;

    return { ...rest, search, page: 1 };
  }

  protected override updateTabCounts(response: ApiResponse): void {
    const updatedTabs = this.tabMenusData().map((tab) => ({
      ...tab,
      count: this.safeGetStatusCount(response.statusCounts, tab.key),
    }));
    this.tabMenusData.set(updatedTabs);
  }

  override readonly activeTab = computed(() => this.filterRequest().status || '');

  private transformSingleItem(
    item: ICandidateWithPositionsDto
  ): ScreeningRow {
    const summary = item.summary;
    const daySince = summary.daysSinceEmployeeActionDate || -1;
    const displayStaus = daySince > 0 ? this.displayStaus(daySince) : "pending";
    return {
      id: item.userID.toString(),
      submitDate: summary.submitDate || '',
      employeeActionDate: summary.employeeActionDate || '',
      userID: item.userID.toString(),
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
      employeeAction: summary.employeeAction?.split(' ')[0] || '',
      screening: createStatusBadge(summary.screening),
      submitStatusLabel: createStatusBadge(displayStaus),
    };
  }

  override onRowClick(row: ApplicationRow): void {
    const id = (row as any)?.id;
    if (!id) return;

    const queryParams = {
      id: id,
      round: (row as any)?.roundID
    }

    this.router.navigate(['/applications/screening/application-form'], { queryParams });
  }
  private displayStaus(daySince: number): string {
    if (daySince <= 3) return 'New';
    if (daySince <= 7) return 'Over 3 Days';
    if (daySince <= 30) return 'Over Week';
    return 'Over Month';
  }

  // เพิ่ม normalize + override load/persist state
  private normalizeScreeningFilter(f: ICandidateFilterRequest | null | undefined): ICandidateFilterRequest {
    const src: any = f || {};
    // ถ้ามี statusGroup ให้ย้ายไป status
    const status = src.status ?? src.statusGroup ?? undefined;

    const cleaned: any = {
      page: src.page ?? 1,
      pageSize: src.pageSize ?? 30,
      status,                   // ใช้เฉพาะ status
      search: src.search ?? undefined,
      month: src.month ?? undefined,
      year: src.year ?? undefined,
      sortFields: src.sortFields ?? undefined,
      hasNextPage: src.hasNextPage ?? undefined,
    };

    // ลบคีย์ที่ undefined ออก
    Object.keys(cleaned).forEach(k => cleaned[k] === undefined && delete cleaned[k]);
    return cleaned as ICandidateFilterRequest;
  }

  // protected override loadPersistedState(): void {
  //   const storageKeys = this.getStorageKeys();

  //   // 1) Filter (มี normalize เหมือนที่คุณใส่ไว้แล้ว)
  //   const persisted = this.loadFromStorage<ICandidateFilterRequest>(storageKeys.FILTER_SETTINGS);
  //   if (persisted) {
  //     const normalized = this.normalizeScreeningFilter(persisted);
  //     this.filterRequest.set({ ...this.createInitialFilter(), ...normalized });
  //     this.filterDateRange = {
  //       month: normalized.month || '',
  //       year: normalized.year || '',
  //     };
  //   }

  //   // 2) Clicked rows
  //   const clickedRows = this.loadFromStorage<string[]>(storageKeys.CLICKED_ROWS);
  //   if (clickedRows) this.clickedRowIds.set(new Set(clickedRows));

  //   // 3) Sort
  //   const persistedSortConfig = this.loadFromStorage<SortState>(storageKeys.SORT_CONFIG);
  //   if (persistedSortConfig) this.sortConfig.set(persistedSortConfig);

  //   // 4) Header Search UI 👇
  //   const headerForm = this.loadFromStorage<{ searchBy: string; searchValue: string }>(storageKeys.HEADER_SEARCH_FORM);
  //   if (headerForm) {
  //     // กู้คืน UI ทั้งคู่
  //     this.searchForm = { ...headerForm };
  //   } else {
  //     // กรณีไม่มี headerForm แต่มี filter.search → ตั้งค่า UI ให้พอใช้ได้
  //     const f = this.filterRequest();
  //     if (f.search) {
  //       this.searchForm = {
  //         searchBy: this.searchByOptions?.[0] || 'Application ID', // default ที่ทีมตกลงร่วมกัน
  //         searchValue: f.search
  //       };
  //     }
  //   }
  // }

  // protected override persistFilterState(): void {
  //   const storageKeys = this.getStorageKeys();
  //   const normalized = this.normalizeScreeningFilter(this.filterRequest());
  //   this.saveToStorage(storageKeys.FILTER_SETTINGS, normalized);
  // }

  override ngOnDestroy(): void {
    this.ro?.disconnect?.();
    super.ngOnDestroy();
  }
}
