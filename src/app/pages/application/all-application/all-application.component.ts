// all-application.component.ts
import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  effect,
  Injector,
} from '@angular/core';

import { BaseApplicationComponent } from '../../../shared/base/base-application.component';
import {
  ApplicationRow,
  ICandidateFilterRequest,
  ICandidateWithPositionsDto,
  IPositionDto,
  SearchForm,
  TabMenu,
} from '../../../interfaces/Application/application.interface';
import { Columns } from '../../../shared/interfaces/tables/column.interface';
import { createQualifiedIcon, createStatusBadge } from '../../../utils/application/badge-utils';


// Component-specific Configuration
const ALL_APPLICATION_CONFIG = {
  STORAGE_KEYS: {
    FILTER_SETTINGS: 'candidateFilterSettings',
    CLICKED_ROWS: 'candidateclickedRowIndexes',
    SORT_CONFIG: 'candidateSortConfig',
    HEADER_SEARCH_FORM: 'allAppHeaderSearchForm',
  },
  DEFAULT_STATUS: 'pending',
} as const;

@Component({
  selector: 'app-all-application',
  templateUrl: './all-application.component.html',
  styleUrl: './all-application.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllApplicationComponent extends BaseApplicationComponent {

  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  hasOverflowY = false;
  private ro?: ResizeObserver;

  constructor(
    private injector: Injector,
  ) {
    super();
  }

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
  protected getStorageKeys() {
    return ALL_APPLICATION_CONFIG.STORAGE_KEYS;
  }

  protected createInitialFilter(): ICandidateFilterRequest {
    return {
      page: 1,
      pageSize: 30,
      status: ALL_APPLICATION_CONFIG.DEFAULT_STATUS,
    };
  }

  protected createInitialTabs(): TabMenu[] {
    return [
      { key: 'total', label: 'All Applications', count: 0 },
      { key: 'new', label: 'New Applications', count: 0 },
      { key: 'over3', label: 'Over 3 Days', count: 0 },
      { key: 'overweek', label: 'Over 1 Week', count: 0 },
      { key: 'overmonth', label: 'Over 1 Month', count: 0 },
    ];
  }

  override onSearch(form: SearchForm): void {
    // clone เพื่อกัน reference เดิมจาก ngModel
    const payload: SearchForm = {
      searchBy: form.searchBy,
      searchValue: form.searchValue,
    };

    // persist UI header
    const { HEADER_SEARCH_FORM } = this.getStorageKeys();
    this.saveToStorage(HEADER_SEARCH_FORM, payload);

    // ส่งเข้า Base → Base จะเติม __nonce ให้เอง (กดซ้ำก็รีเฟรช)
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
  ): ApplicationRow[] {
    return items.map((item) => this.transformSingleItem(item));
  }

  private transformSingleItem(
    item: ICandidateWithPositionsDto
  ): ApplicationRow {
    const summary = item.summary;

    return {
      id: item.userID.toString(),
      qualifield: createQualifiedIcon(summary.qualifield),
      submitDate: summary.submitDate || '',
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
      submitStatusLabel: createStatusBadge(summary.submitStatusLabel ?? ''),
      roundID: (item as any).roundID,
    };
  }

  protected override loadPersistedState(): void {
    super.loadPersistedState();

    const { HEADER_SEARCH_FORM } = this.getStorageKeys();
    const headerForm = this.loadFromStorage<{ searchBy: string; searchValue: string }>(HEADER_SEARCH_FORM);
    if (headerForm) {
      this.searchForm = { ...headerForm };
    } else {
      // ถ้าไม่มี headerForm แต่ filter เคยมี search ให้เดาง่าย ๆ ว่าค้นหาด้วย option แรก
      const f = this.filterRequest();
      if (f.search) {
        this.searchForm = {
          searchBy: this.searchByOptions?.[0] || 'Application ID',
          searchValue: f.search,
        };
      }
    }
  }

  override onRowClick(row: ApplicationRow): void {
    const id = (row as any)?.id;
    if (!id) return;

    const queryParams = {
      id,
      round: (row as any)?.roundID,
    };

    this.router.navigate(
      ['/applications/all-applications/application-form'],
      { queryParams }
    );
  }

  override ngOnDestroy(): void {
    this.ro?.disconnect?.();
    super.ngOnDestroy();
  }
}
