import {
  Component,
  Output,
  EventEmitter,
  ViewChild,
  ChangeDetectorRef,
  ElementRef,
} from '@angular/core';
import { Columns } from '../../../../../../shared/interfaces/tables/column.interface';
import { BaseGeneralBenefitsComponent } from '../../../../../../shared/base/base-general-benefits.component';
import { GeneralBenefitsService } from '../../../../../../services/admin-setting/general-benefits/general-benefits.service'
import { LoadingService } from '../../../../../../shared/services/loading/loading.service';
import {
  IApiResponse,
  IBenefitsFilterRequest,
  IUniversityWithPositionsDto,
  SearchForm,
  UniversityScreeningRow,
} from '../../../../../../interfaces/admin-setting/general-benefits.interface';
import { catchError, EMPTY, map, Observable, tap } from 'rxjs';
import { TablesComponent } from '../../../../../../shared/components/tables/tables.component';
import { NotificationService } from '../../../../../../shared/services/notification/notification.service';

const SCREENING_CONFIG = {
  STORAGE_KEYS: {
    FILTER_SETTINGS: 'benefitsFiterSettings',
    CLICKED_ROWS: 'benefitsClickedRowIndexes',
    SORT_CONFIG: 'benefitsSortConfig',
  },
} as const;

@Component({
  selector: 'app-university',
  templateUrl: './university.component.html',
  styleUrl: './university.component.scss'
})
export class UniversityComponent extends BaseGeneralBenefitsComponent<IUniversityWithPositionsDto> {
  @ViewChild('tables', { static: false }) tables!: TablesComponent;
  @Output() toggleRequested = new EventEmitter<{ row: any; next: boolean }>();

  hasMoreData = true;
  currentPage = 1;
  ScreenRows: UniversityScreeningRow[] = this.rows();
  SearchForm!: SearchForm;
  isAddingRow = false;
  fieldErrors:boolean = false;
  duplicateRowIndex: number | null = null;
  gradeSelected: number = 0;

  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  hasOverflowY = false;
  private ro?: ResizeObserver;

  constructor(
    private generalBenefitsService: GeneralBenefitsService,
    private loadingService: LoadingService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef ) {
    super();
  }

  ngAfterViewInit(): void {
    this.measureOverflow();

    this.ro = new ResizeObserver(() => this.measureOverflow());
    this.ro.observe(this.scrollArea.nativeElement);
  }

  measureOverflow(): void {
    const el = this.scrollArea.nativeElement;
    this.hasOverflowY = el.scrollHeight > el.clientHeight;
  }

  readonly columns: Columns = [
    {
      header: 'No',
      field: '__index',
      type: 'number',
      align: 'center',
      width: '5%',
    },
    {
      header: 'University',
      field: 'university',
      type: 'text'
    },
    {
      header: 'University ID',
      field: 'uniId',
      type: 'text',
      align: 'center',
      width: '10%'
    },
    {
      header: 'Grade',
      field: 'typeScore',
      type: 'text',
      align: 'center',
      width: '10%'
    },
    {
      header: 'Status',
      field: 'status',
      type: 'toggle',
      align: 'center',
      width: '10%'
    },
    {
      header: 'Action',
      field: 'textlink',
      type: 'textlink',
      align: 'center',
      width: '15%',
      textlinkActions: ['edit-inrow']
    },
  ] as const;

  defaultFilterButtons = () => ([
    { label: 'Add', key: 'add', color: '#00AAFF' },
  ]);

  filterButtons = this.defaultFilterButtons();

  override ngOnInit(): void {
    this.generalBenefitsService.setBenefitType('university');
    // this.loadUsers();
    
    // const storageKeys = this.getStorageKeys();
    // this.saveToStorage(storageKeys.FILTER_SETTINGS + '_Grade', 0);

    super.ngOnInit();
  }

  handleEditRow(row: UniversityScreeningRow): void {
    const id = row.id;
    const payload: Partial<IUniversityWithPositionsDto> = {
      uniId: row.uniId,
      university: row.university,
      typeScore: this.mapGradeToScore(row.typeScore),
      status: row.activeStatus ? 1 : 2,
    };

    this.loadingService.show();

    this.generalBenefitsService.updateBenefit(id, payload).subscribe({
      next: (res) => {
        this.loadingService.hide();
        this.loadUsers();
      },
      error: (err) => {
        this.loadingService.hide();
        this.notificationService.error(err.error.error.title);
        this.fieldErrors = true;

        setTimeout(() => {
          const rows = [...this.ScreenRows];
          const name = row.university.trim().toLowerCase();
          const uniId = row.uniId.trim().toLowerCase();

          this.duplicateRowIndex = rows.findIndex(r =>
            r.id !== row.id && (
              r.university.trim().toLowerCase() === name ||
              r.uniId.trim().toLowerCase() === uniId
            )
          );
        }, 100);

        this.loadUsers();
      }
    });
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'add':
        this.isAddingRow = true;
        this.onAddInline()
        break;
    }
  }

  onAddInline() {
    this.tables.startInlineCreate({ activeStatus: false, status: 2 }, 'bottom');
  }

  onInlineSave(payload: any) {
    this.isAddingRow = false;
    payload.typeScore = this.mapGradeToScore(payload.typeScore)
    this.generalbenefitsService.createBenefit(payload).subscribe({
      next: (res) => {
        this.fieldErrors = false;
        this.loadingService.hide();
        this.loadUsers();

        const rows = [...this.rows()];
        const idx = rows.findIndex(r => r._isNew);
        if (idx >= 0) rows[idx] = { ...res.items };
        this.rowsData.set(rows);
        this.tables.editingRowId = null;
        this.tables.editRow = false;
      },
      error: (err) => {
        this.isAddingRow = true;
        this.notificationService.error(err.error.error.title);
        this.fieldErrors = true;

        const rows = [...this.ScreenRows];
        const inputUniversity = payload.university?.trim().toLowerCase() || '';
        const inputUniId = payload.uniId?.trim().toLowerCase() || '';

        this.duplicateRowIndex = rows.findIndex(row => {
          const rowUniversity = row.university?.trim().toLowerCase() || '';
          const rowUniId = row.uniId?.trim().toLowerCase() || '';

          return rowUniversity === inputUniversity || rowUniId === inputUniId;
        });
      }
    });
  }

  onInlineCancel() {
    this.isAddingRow = false;
    this.fieldErrors = false;
  }

  protected currentFilterParams: IBenefitsFilterRequest = {
    page: 1,
    pageSize: 30,
  };

  loadUsers() {
    this.generalBenefitsService
      .getBenefitsWeb<IApiResponse<IUniversityWithPositionsDto>>(this.currentFilterParams)
      .subscribe({
        next: (res) => {
          const items = Array.isArray(res) ? res : res?.items ?? [];
          const rows = this.transformApiDataToRows(items);
          this.rowsData.set(rows);
          setTimeout(() => this.measureOverflow());
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  // Abstract method implementations
  protected getStorageKeys() {
    return SCREENING_CONFIG.STORAGE_KEYS;
  }

  protected createInitialFilter(gradeScore?: number): IBenefitsFilterRequest {
    const base: IBenefitsFilterRequest = {
      page: 1,
      pageSize: 30,
      hasNextPage: false,
      hasPreviousPage: false
    };

    if (gradeScore && gradeScore !== 0) {
      base.TypeScoreMin = gradeScore;
      base.TypeScoreMax = gradeScore;
    }

    return base;
  }

  protected transformApiDataToRows(
    items: readonly IUniversityWithPositionsDto[]
  ): UniversityScreeningRow[] {
    return items.map((item) => this.transformSingleItem(item));
  }

  private transformSingleItem(
    item: IUniversityWithPositionsDto
  ): UniversityScreeningRow {
    return {
      id: item.id,
      uniId:  item.uniId,
      university: item.university,
      typeScore:  this.mapScoreToGrade(item.typeScore),
      status: item.status,
      statusText: item.statusText,
      canDelete: item.canDelete,
      activeStatus: item.status === 1
    };
  }

  private mapScoreToGrade(score: number | null | undefined): string {
    switch (score) {
      case 1: return 'A';
      case 2: return 'B';
      case 3: return 'C';
      case 4: return 'D';
      case 5: return 'E';
      case 6: return 'N/A';
      default: return '-';
    }
  }

  private mapGradeToScore(grade: string | null | undefined): number {
    switch ((grade || '').toUpperCase()) {
      case 'A': return 1;
      case 'B': return 2;
      case 'C': return 3;
      case 'D': return 4;
      case 'E': return 5;
      case 'N/A': return 6;
      default: return 0;
    }
  }

  onToggleChange(e: Event, row: any) {
    const next = (e.target as HTMLInputElement).checked;
    (e.target as HTMLInputElement).checked = !next;
    this.toggleRequested.emit({ row, next });
  }

  onUserToggleRequested({
    row,
    checked,
    checkbox
  }: {
    row: any;
    checked: boolean;
    checkbox: HTMLInputElement;
  }) {

    if (this.isAddingRow && !row.id) {
      checkbox.checked = checked;
      if ('isActive' in row) row.isActive = checked;
      if ('activeStatus' in row) row.activeStatus = checked;
    } else {
      this.generalBenefitsService.toggleStatus(row.id).subscribe({
        next: () => {
          checkbox.checked = checked;
          if ('isActive' in row) row.isActive = checked;
          if ('activeStatus' in row) row.activeStatus = checked;
        },
        error: () => {
          console.error('Toggle failed');
        }
      });
    }
  }

  onGradeSelected(grade: string) {
    this.isFiltering = true;
    this.gradeSelected = this.mapGradeToScore(grade)
    const storageKeys = this.getStorageKeys();

    if (this.gradeSelected !== 0) {
      this.currentFilterParams.page = 1;
      this.currentFilterParams.pageSize = 30;
      this.currentFilterParams.TypeScoreMin = this.mapGradeToScore(grade);
      this.currentFilterParams.TypeScoreMax = this.mapGradeToScore(grade);
      this.currentFilterParams.search = this.searchForm.searchValue
      
      this.saveToStorage(storageKeys.FILTER_SETTINGS + '_Grade', this.gradeSelected);
    } else {
      delete this.currentFilterParams.TypeScoreMin;
      delete this.currentFilterParams.TypeScoreMax;
      this.saveToStorage(storageKeys.FILTER_SETTINGS + '_Grade', 0);
    }

    this.scrollToTop();
    this.loadUsers()

    setTimeout(() => {
      this.isFiltering = false;
    }, 500);

  }

  override ngOnDestroy(): void {
    this.ro?.disconnect?.();

    super.ngOnDestroy();
  }
}
