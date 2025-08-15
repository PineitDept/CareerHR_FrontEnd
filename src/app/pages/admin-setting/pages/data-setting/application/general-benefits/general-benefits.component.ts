import {
  Component,
  Output,
  EventEmitter,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { Columns } from '../../../../../../shared/interfaces/tables/column.interface';
import { BaseGeneralBenefitsComponent } from '../../../../../../shared/base/base-general-benefits.component';
import { GeneralBenefitsService } from '../../../../../../services/admin-setting/general-benefits/general-benefits.service'
import { LoadingService } from '../../../../../../shared/services/loading/loading.service';
import {
  IBenefitsFilterRequest, 
  IBenefitsWithPositionsDto,
  ScreeningRow,
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
  selector: 'app-general-benefits',
  templateUrl: './general-benefits.component.html',
  styleUrl: './general-benefits.component.scss'
})
export class GeneralBenefitsComponent extends BaseGeneralBenefitsComponent {

  // @Input() checkNewRow:boolean = false;
  @ViewChild('tables', { static: false }) tables!: TablesComponent;

  @Output() toggleRequested = new EventEmitter<{ row: any; next: boolean }>();

  hasMoreData = true;
  currentPage = 1;
  ScreenRows: ScreeningRow[] = [];
  isAddingRow = false;
  fieldErrors:boolean = false;

  constructor(
    private generalBenefitsService: GeneralBenefitsService,
    private loadingService: LoadingService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef ) {
    super();
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
      header: 'General Benefits',
      field: 'welfareBenefits',
      type: 'text'
    },
    {
      header: 'Status',
      field: 'status',
      type: 'toggle',
      align: 'center'
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
    this.loadUsers();
  }

  handleEditRow(row: ScreeningRow): void {
    const id = row.item;
    const payload: Partial<IBenefitsWithPositionsDto> = {
      welfareBenefits: row.welfareBenefits,
      status: row.activeStatus ? 1 : 2,
    };

    this.loadingService.show();

    this.generalBenefitsService.updateBenefit(id, payload).subscribe({
      next: (res) => {
        console.log('Update success', res);
        this.loadingService.hide();
        this.loadUsers();
      },
      error: (err) => {
        console.error('Update failed', err);
        this.loadingService.hide();
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
    this.generalBenefitsService.getBenefitsWeb(this.currentFilterParams).subscribe({
      next: (res) => {
        this.ScreenRows = this.transformApiDataToRows(res);
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
    items: readonly IBenefitsWithPositionsDto[]
  ): ScreeningRow[] {
    return items.map((item) => this.transformSingleItem(item));
  }

  private transformSingleItem(
    item: IBenefitsWithPositionsDto
  ): ScreeningRow {
    return {
      item: item.item,
      welfareBenefits: item.welfareBenefits,
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
    
    if (this.isAddingRow && !row.item) {
      checkbox.checked = checked;
      if ('isActive' in row) row.isActive = checked;
      if ('activeStatus' in row) row.activeStatus = checked;
    } else {
      this.generalBenefitsService.toggleStatus(row.item).subscribe({
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
}
