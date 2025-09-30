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
  TabMenu,
} from '../../../interfaces/Application/application.interface';
import { Columns } from '../../../shared/interfaces/tables/column.interface';
import { createStatusBadge } from '../../../utils/application/badge-utils';
import { FormDialogComponent } from '../../../shared/components/dialogs/form-dialog/form-dialog.component';
import { MatDialog } from '@angular/material/dialog';

// Component-specific Configuration
const SCREENING_CONFIG = {
  STORAGE_KEYS: {
    FILTER_SETTINGS: 'screeningFiterSettings',
    CLICKED_ROWS: 'screeningClickedRowIndexes',
    SORT_CONFIG: 'screeningSortConfig',
  },
} as const;

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

  constructor (
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
    {
      header: 'Bonus',
      field: 'totalBonus',
      type: 'text',
      align: 'right',
      sortable: true
    },
    {
      header: 'Screen By',
      field: 'employeeAction',
      type: 'text',
      align: 'center',
      sortable: true
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
    return SCREENING_CONFIG.STORAGE_KEYS;
  }

  protected createInitialFilter(): ICandidateFilterRequest {
    return {
      page: 1,
      pageSize: 30,
    };
  }

  protected createInitialTabs(): TabMenu[] {
    return [
      { key: 'total', label: 'All Applications', count: 0 },
      { key: 'pending', label: 'Pending', count: 0 },
      { key: 'accept', label: 'Accepted', count: 0 },
      { key: 'decline', label: 'Declined', count: 0 },
      { key: 'hold', label: 'On Hold', count: 0 },
    ];
  }

  protected transformApiDataToRows(
    items: readonly ICandidateWithPositionsDto[]
  ): ScreeningRow[] {
    return items.map((item) => this.transformSingleItem(item));
  }


  // Override tab change behavior for screening-specific logic
  protected override updateFilterForTab(tab: string): ICandidateFilterRequest {
    const currentFilter = this.filterRequest();
    return { ...currentFilter, status: tab, page: 1 };
  }
  protected override updateTabCounts(response: ApiResponse): void {
    const updatedTabs = this.tabMenusData().map((tab) => ({
      ...tab,
      count:this.safeGetStatusCount(response.statusCounts,tab.key),
    }));
    this.tabMenusData.set(updatedTabs);
  }

   override readonly activeTab = computed(() => this.filterRequest().status || '');

  private transformSingleItem(
    item: ICandidateWithPositionsDto
  ): ScreeningRow {
    const summary = item.summary;

    return {
      id: summary.userID.toString(),
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
      employeeAction: summary.employeeAction?.split(' ')[0] || '',
      screening: createStatusBadge(summary.screening),
    };
  }

  override onRowClick(row: ApplicationRow): void {
    const id = (row as any)?.id;
    if (!id) return;

    const queryParams = {
      id: id,
    }

    this.router.navigate(['/applications/screening/application-form'], { queryParams });
  }

  override ngOnDestroy(): void {
    this.ro?.disconnect?.();
    super.ngOnDestroy();
  }
}
