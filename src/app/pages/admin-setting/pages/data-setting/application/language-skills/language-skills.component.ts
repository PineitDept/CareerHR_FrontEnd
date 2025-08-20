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
  IBenefitsFilterRequest,
  ILanguageWithPositionsDto,
  LanguageScreeningRow,
} from '../../../../../../interfaces/admin-setting/general-benefits.interface';
import { catchError, EMPTY, tap } from 'rxjs';
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
  selector: 'app-language-skills',
  templateUrl: './language-skills.component.html',
  styleUrl: './language-skills.component.scss'
})
export class LanguageSkillsComponent extends BaseGeneralBenefitsComponent<ILanguageWithPositionsDto> {
  @ViewChild('tables', { static: false }) tables!: TablesComponent;
  @Output() toggleRequested = new EventEmitter<{ row: any; next: boolean }>();

  hasMoreData = true;
  currentPage = 1;
  ScreenRows: LanguageScreeningRow[] = [];
  isAddingRow = false;
  fieldErrors:boolean = false;
  duplicateRowIndex: number | null = null;

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
      width: '40px',
    },
    {
      header: 'Language Skills',
      field: 'language',
      type: 'text'
    },
    {
      header: 'Status',
      field: 'status',
      type: 'toggle',
      align: 'center',
      width: '15%'
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
    this.generalBenefitsService.setBenefitType('langauge-skills');
    this.loadUsers();
    // super.ngOnInit();
  }

  handleEditRow(row: LanguageScreeningRow): void {
    const id = row.idlanguage;
    const payload: Partial<ILanguageWithPositionsDto> = {
      language: row.language,
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
        this.notificationService.error('A benefit with this name already exists.');
        this.fieldErrors = true;

        setTimeout(() => {
          const rows = [...this.ScreenRows];
          const name = row.language;
          this.duplicateRowIndex = rows.findIndex(row => row.language.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
        },100)

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
    this.generalbenefitsService.createBenefit(payload).subscribe({
      next: (res) => {
        this.fieldErrors = false;
        this.loadingService.hide();
        this.loadUsers();

        const rows = [...this.rows()];
        const idx = rows.findIndex(r => r._isNew);
        if (idx >= 0) rows[idx] = { ...res };
        this.rowsData.set(rows);
        this.tables.editingRowId = null;
        this.tables.editRow = false;
      },
      error: (err) => {
        this.isAddingRow = true;
        this.notificationService.error('A benefit with this name already exists.');
        this.fieldErrors = true;

        const rows = [...this.ScreenRows];
        this.duplicateRowIndex = rows.findIndex(row => row.language.trim().toLocaleLowerCase() === payload.language.trim().toLocaleLowerCase());
      }
    });
  }

  onInlineCancel() {
    this.isAddingRow = false;
    this.fieldErrors = false;
  }

  protected currentFilterParams: IBenefitsFilterRequest = {
    page: 1,
    pageSize: 30
  };

  loadUsers() {
    this.generalBenefitsService.getBenefitsWeb<ILanguageWithPositionsDto[]>(this.currentFilterParams).subscribe({
      next: (res) => {
        this.ScreenRows = this.transformApiDataToRows(res);
        setTimeout(() => this.measureOverflow());
        this.cdr.detectChanges();
      },
      error: (err) => console.error(err),
    });
  }

  // Abstract method implementations
  protected getStorageKeys() {
    return SCREENING_CONFIG.STORAGE_KEYS;
  }

  protected createInitialFilter(): IBenefitsFilterRequest {
    return {
      page: 1,
      pageSize: 30
    };
  }

  protected transformApiDataToRows(
    items: readonly ILanguageWithPositionsDto[]
  ): LanguageScreeningRow[] {
    return items.map((item) => this.transformSingleItem(item));
  }

  private transformSingleItem(
    item: ILanguageWithPositionsDto
  ): LanguageScreeningRow {
    return {
      idlanguage: item.idlanguage,
      language: item.language,
      status: item.status,
      statusText: item.statusText,
      canDelete: item.canDelete,
      activeStatus: item.status === 1
    };
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

    if (this.isAddingRow && !row.idlanguage) {
      checkbox.checked = checked;
      if ('isActive' in row) row.isActive = checked;
      if ('activeStatus' in row) row.activeStatus = checked;
    } else {
      this.generalBenefitsService.toggleStatus(row.idlanguage).subscribe({
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

  override ngOnDestroy(): void {
    this.ro?.disconnect?.();

    super.ngOnDestroy();
  }
}
