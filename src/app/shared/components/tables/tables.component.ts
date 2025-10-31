// IMPROVED TypeScript Component Logic
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  SimpleChanges,
  HostListener,
  TrackByFunction,
  OnInit,
  AfterViewInit,
  AfterViewChecked,
  OnChanges,
  ChangeDetectionStrategy,
  Signal,
  effect,
  DestroyRef,
  inject,
  OnDestroy,
  signal,
  input,
  ViewContainerRef,
  TemplateRef,
} from '@angular/core';
import { Column } from '../../interfaces/tables/column.interface';
import { MatDialog } from '@angular/material/dialog';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Overlay, OverlayRef, FlexibleConnectedPositionStrategy, ConnectedPosition, ScrollStrategyOptions, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { AlertDialogComponent } from '../dialogs/alert-dialog/alert-dialog.component';
import { FormDialogComponent } from '../dialogs/form-dialog/form-dialog.component';
import { ApplicationService } from '../../../services/application/application.service';
import { FormDialogData } from '../../interfaces/dialog/dialog.interface';
import { SelectOption } from '../multi-select-dropdown/multi-select-dropdown.component';

export type SortState = {
  [field: string]: 'asc' | 'desc' | null;
};

type MultiOption = { label: string; value: any };

interface DropdownOverlay {
  visible: boolean;
  rowIndex: number | null; // null = footer
  field: string;
  x: number;
  y: number;
  width: number;
  options: string[];
}

@Component({
  selector: 'app-tables',
  templateUrl: './tables.component.html',
  styleUrls: ['./tables.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablesComponent
  implements OnInit, OnChanges, AfterViewInit, AfterViewChecked, OnDestroy {
  rows = input<any[]>([]);
  resetKey = input<number>(0);
  preClickedRowIds = input<string[]>([]);
  sortStates = input<SortState>({});

  @Input() showCheckbox: boolean = true;
  @Input() splitRows: boolean = true;
  @Input() columns: Column[] = [];
  @Input() enableRowClick: boolean = true;
  @Input() isAddMode: boolean = false;
  @Input() fieldErrors: boolean = false;
  @Input() highlightRowIndex: number | null = null;
  @Input() hasOverflowY = false;
  @Input() withinCard: boolean = false;
  @Input() isToggleAlert: boolean = false;
  @Input() isDisabledForm: boolean = false;
  @Input() isZeroOneStatus: boolean = false;
  @Input() isOnlineStatus: boolean = false;
  @Input() allowViewWhenDisabled: boolean = false;
  @Input() requiredFooterFields: string[] = [];
  @Input() draggableRows: boolean = false;
  @Input() isConfirmDialogToggleRequired: boolean = true;
  @Input() isConfirmDialogSaveRequired: boolean = true;
  @Input() tableFixed: boolean = true;
  @Input() isReasonSave: boolean = false;
  @Input() lockedPrefixConfig: { field: string; prefix: string } | null = null;
  @Input() mergeByFields: string[] = [];
  @Input() inlineFieldErrors: Record<string, boolean> = {};
  @Input() useExternalInlineSaveFlow: boolean = false;
  @Input() scoreMax: number = 1;
  @Input() valueSelected: any;
  @Input() preferIdForSelect: boolean = false;
  @Input() stickyHeader: boolean = false;
  @Input() IconHasDes: boolean = false;
  @Input() rememberClick = true;
  @Input() highlightOnInit = true;
  @Input() singleUseHighlight = false;
  @Input() idField: string = 'id';
  @Input() storageNamespace = 'tables';
  @Input() tableId = 'default';
  @Input() highlightTTLms: number = 3 * 1000;
  @Input() noOuterPaddingBottom: boolean = false;

  @Output() selectionChanged = new EventEmitter<any[]>();
  @Output() rowClicked = new EventEmitter<any>();
  @Output() listClickedRows = new EventEmitter<Set<string>>();
  @Output() columnClicked = new EventEmitter<{ state: SortState; order: string[] }>();
  // @Output() toggleChange = new EventEmitter<{ row: any, checked: boolean, confirm: boolean  }>();
  @Output() toggleChange = new EventEmitter<{ row: any; checked: boolean; checkbox: HTMLInputElement }>();
  @Output() editClicked = new EventEmitter<any>();
  @Output() editCardClicked = new EventEmitter<any>();
  @Output() viewRowClicked = new EventEmitter<any>();
  @Output() columnRowClicked = new EventEmitter<{ column: Column; row: any }>();
  @Output() createInlineSave = new EventEmitter<any>();
  @Output() createInlineCancel = new EventEmitter<void>();
  @Output() deleteRowClicked = new EventEmitter<any>();
  @Output() selectChanged = new EventEmitter<{ rowIndex: number; field: string; value: string }>();
  @Output() rowsReordered = new EventEmitter<{ previousIndex: number; currentIndex: number }>();
  @Output() inlineSaveAttempt = new EventEmitter<{ draft: any; original: any }>();
  @Output() inlineCancel = new EventEmitter<any>();
  @Output() inlineFieldCommit = new EventEmitter<{ rowIndex: number; field: string; value: any }>();

  sortedColumns: string[] = [];
  clickedRows: Set<string> = new Set();
  selectedRows: Set<number> = new Set();
  allSelected: boolean = false;
  expandedMainColumns = new Set<string>();
  dropdownOverlay: DropdownOverlay | null = null;
  activeStatus: boolean = false;
  colField: string = '';
  editingRowId: string | number | null = null;
  editedValue: string = '';
  editRow: boolean = false;
  rowValidationErrors: { [rowId: string]: boolean } = {};
  ishighlightRow: boolean = false;
  editingBuffer: any | null = null;

  @ViewChild('selectAllCheckbox')
  selectAllCheckbox!: ElementRef<HTMLInputElement>;
  @ViewChild('tableWrapper', { static: true })
  tableWrapperRef!: ElementRef<HTMLDivElement>;

  @Input() createDefaults: any = {};
  footerRow: any = {};
  indexAdd: number = 0;

  footerErrors: Record<string, boolean> = {};

  private destroyRef = inject(DestroyRef);

  @ViewChild('dropdownOverlayTpl', { static: true }) dropdownOverlayTpl!: TemplateRef<any>;

  private overlayRef: OverlayRef | null = null;
  private positionStrategy!: FlexibleConnectedPositionStrategy;

  overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  constructor(
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private overlay: Overlay,
    private vcr: ViewContainerRef,
    private sso: ScrollStrategyOptions,
  ) {
    // ใช้ effect เพื่อ watch การเปลี่ยนแปลงของ rows signal
    effect(() => {
      const currentRows = this.rows();
      this.updateAllSelectedState();
      if (currentRows && currentRows.length > 0) {
        const validIndices = new Set<number>();
        this.selectedRows.forEach((index) => {
          if (index < currentRows.length) validIndices.add(index);
        });
        if (validIndices.size !== this.selectedRows.size) {
          this.selectedRows = validIndices;
        }
      }
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    this.preClickedRowIds().forEach((id) => this.clickedRows.add(id));
    this.updateAllSelectedState();

    if (this.enableRowClick && this.highlightOnInit) {
      this.loadLastClickedFromStorage();
    }
  }

  ngAfterViewInit() {
    this.updateIndeterminateState();
  }

  ngAfterViewChecked() {
    this.updateIndeterminateState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resetKey'] && !changes['resetKey'].firstChange) {
      this.selectedRows.clear();
      this.allSelected = false;
      this.updateIndeterminateState();
      this.emitSelection();

      this.sortedColumns = [];
      const s = this.sortStateValue;
      Object.keys(s).forEach(k => (s[k] = null));
      this.columnClicked.emit({ state: s, order: [] });

      this.cdr.detectChanges();
    }

    if (changes['isAddMode']) {
      if (this.isAddMode) {
        this.footerRow = {
          ...this.createDefaults,
          activeStatus: this.createDefaults.activeStatus ?? false,
          status: this.createDefaults.status ?? 2,
        };
        this.indexAdd = this.rowsValue.length + 1
        this.footerErrors = {};
      } else {
        this.footerRow = {};
        this.footerErrors = {};
      }
      this.cdr.detectChanges();
    }

    if (changes['highlightRowIndex'] && !changes['highlightRowIndex'].firstChange) {
      this.ishighlightRow = true
    }

    if (changes['rows']) {
      this.indexAdd = this.rowsValue.length + 1
    }
  }

  ngOnDestroy() {
    // cleanup จะถูกจัดการโดย DestroyRef อัตโนมัติ
  }

  // Helper method สำหรับเข้าถึง rows signal
  get rowsValue(): any[] {
    return this.rows();
  }

  get sortStateValue(): SortState {
    return this.sortStates();
  }

  // FIXED: Column Management with Proper Width Calculation
  toggleExpandRow(mainColumn: string, event?: Event): void {
    event?.stopPropagation();

    if (this.expandedMainColumns.has(mainColumn)) {
      this.expandedMainColumns.delete(mainColumn);
    } else {
      this.expandedMainColumns.add(mainColumn);
    }

    // Force change detection for smooth animation
    this.cdr.detectChanges();
  }

  isSubColumnVisible(column: Column): boolean {
    return column.subColumn
      ? this.expandedMainColumns.has(column.subColumn)
      : true;
  }

  hasSubColumns(mainColumn: string): boolean {
    return this.columns.some((col) => col.subColumn === mainColumn);
  }

  // FIXED: Improved Column Width Calculation
  getColumnWidth(column: Column): string {
    if (column.subColumn && !this.isSubColumnVisible(column)) {
      return '0px';
    }
    return column.width || (column.subColumn ? '150px' : 'auto');
  }

  getColumnMinWidth(column: Column): string {
    if (column.subColumn && !this.isSubColumnVisible(column)) {
      return '0px';
    }
    return column.minWidth || (column.subColumn ? '120px' : '100px');
  }

  getColumnMaxWidth(column: Column): string {
    if (column.subColumn && !this.isSubColumnVisible(column)) {
      return '0px';
    }
    return column.maxWidth || (column.subColumn ? '200px' : 'none');
  }

  // Selection Management
  private updateAllSelectedState(): void {
    const currentRows = this.rowsValue;
    this.allSelected =
      currentRows.length > 0 && this.selectedRows.size === currentRows.length;
  }

  onHeaderCheckboxClick(event: MouseEvent) {
    const checkbox = this.selectAllCheckbox.nativeElement;
    const total = this.rowsValue.length;
    const selected = this.selectedRows.size;

    if (checkbox.indeterminate || selected < total) {
      this.toggleSelectAll(true);
    } else {
      this.toggleSelectAll(false);
    }

    event.preventDefault();
  }

  private toggleSelectAll(select: boolean): void {
    this.allSelected = select;
    this.selectedRows.clear();

    if (select) {
      this.rowsValue.forEach((_, i) => this.selectedRows.add(i));
    }

    this.emitSelection();
    this.cdr.detectChanges();
  }

  toggleSelectRow(index: number) {
    if (this.selectedRows.has(index)) {
      this.selectedRows.delete(index);
    } else {
      this.selectedRows.add(index);
    }

    this.allSelected = this.selectedRows.size === this.rowsValue.length;
    this.emitSelection();
    this.cdr.detectChanges();
  }

  emitSelection() {
    const currentRows = this.rowsValue;
    const selected = Array.from(this.selectedRows).map((i) => currentRows[i]);
    this.selectionChanged.emit(selected);
  }

  updateIndeterminateState() {
    if (this.selectAllCheckbox) {
      const checkbox = this.selectAllCheckbox.nativeElement;
      const total = this.rowsValue.length;
      const selected = this.selectedRows.size;

      checkbox.indeterminate = selected > 0 && selected < total;
    }
  }

  onColumnClick(column: any): void {
    if (!column.sortable) return;

    const field = column.field;
    const current = this.sortStateValue[field];

    // วนค่าจาก null -> asc -> desc -> null
    const next: 'asc' | 'desc' | null =
      current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc';
    this.sortStateValue[field] = next;

    if (next === null) {
      // ลบ field ออกจากลำดับการ sort
      this.sortedColumns = this.sortedColumns.filter((f) => f !== field);
    } else {
      if (!this.sortedColumns.includes(field)) {
        this.sortedColumns.push(field);
      }
    }

    console.log('Sort state updated:', { state: this.sortStateValue, order: [...this.sortedColumns] });
    this.columnClicked.emit({ state: this.sortStateValue, order: [...this.sortedColumns] });
  }

  // Event Handlers
  onRowClick(row: any, event: MouseEvent) {
    if (!this.enableRowClick) return;

    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();

    if (
      (tagName === 'input' && target.getAttribute('type') === 'checkbox') ||
      tagName === 'button' ||
      target.closest('.dropdown-button') ||
      target.closest('.dropdown-overlay')
    ) {
      return;
    }

    if (row?.id) {
      this.clickedRows.add(String(row.id));
      this.listClickedRows.emit(this.clickedRows);
    }

    const idVal = row?.[this.idField];
    if (idVal != null) {
      const idStr = String(idVal);
      this.clickedRows.add(idStr);
      this.listClickedRows.emit(this.clickedRows);

      if (this.rememberClick) {
        this.saveLastClickedToStorage(idStr);
      }
    }

    this.rowClicked.emit(row);
    this.cdr.detectChanges();
  }

  onButtonClick(column: Column, row: any, event: Event): void {
    event.stopPropagation();
    if (column.onClick) {
      column.onClick(row);
    }
  }

  private resolveOptionsFrom(
    src: string | string[] | ((row: any) => any[]) | undefined,
    row: any
  ): any[] {
    if (Array.isArray(src)) return src;
    if (typeof src === 'function') {
      const out = src(row);
      return Array.isArray(out) ? out : [];
    }
    if (typeof src === 'string') {
      const out = row?.[src];
      return Array.isArray(out) ? out : [];
    }
    return [];
  }

  private toDisplayLabels(arr: any[]): string[] {
    return (arr ?? []).map((o: any) =>
      typeof o === 'string'
        ? o
        : (o?.label ?? o?.name ?? o?.text ?? String(o?.value ?? o?.id ?? o))
    );
  }

  public resolveMultiOptions(row: any, column: any): { label: string; value: any }[] {
    const src = column?.options as string | any[] | ((row: any) => any[]) | undefined;

    let arr: any[] = [];
    if (Array.isArray(src)) arr = src;
    else if (typeof src === 'function') arr = Array.isArray(src(row)) ? src(row) : [];
    else if (typeof src === 'string') arr = Array.isArray(row?.[src]) ? row[src] : [];

    return (arr ?? []).map((o: any) => {
      if (typeof o === 'string' || typeof o === 'number') {
        return { label: String(o), value: o };
      }
      const label = o?.label ?? o?.name ?? o?.text ?? String(o?.value ?? o?.id ?? o?.key ?? o);
      const value = o?.value ?? o?.id ?? o?.key ?? label;
      return { label, value };
    });
  }

  onMultiSelectSelectionChange(
    rowIndex: number,
    field: string,
    selected: SelectOption[]
  ) {
    const values = (selected || []).map(o => String(o.value));
    this.inlineFieldCommit.emit({ rowIndex, field, value: values });
  }

  // FIXED: Dropdown Management
  toggleDropdown(i: number, field: string, origin: CdkOverlayOrigin, e?: Event) {
    const row = this.rowsValue[i];
    if (this.isCellDisabled(row, field)) return;
    e?.stopPropagation();
    const column = this.columns.find(c => c.field === field);
    if (!column) return;
    const opts = this.resolveMultiOptions(row, column);
    this.openOverlay(origin, { rowIndex: i, field, options: opts });
  }

  private openOverlay(
    origin: CdkOverlayOrigin,
    ctx: { rowIndex: number | null; field: string; options: any[] }
  ) {
    const width = origin.elementRef.nativeElement.offsetWidth ?? 180;

    if (!this.overlayRef) {
      this.positionStrategy = this.overlay.position()
        .flexibleConnectedTo(origin.elementRef)
        .withPositions(this.overlayPositions)
        .withFlexibleDimensions(false)
        .withPush(true)
        .withViewportMargin(8);

      this.overlayRef = this.overlay.create({
        positionStrategy: this.positionStrategy,
        hasBackdrop: true,
        backdropClass: 'cdk-overlay-transparent-backdrop',
        scrollStrategy: this.sso.reposition(),
        panelClass: 'tw-z-[9999]',
      });

      this.overlayRef.backdropClick().subscribe(() => this.closeOverlay());
      this.overlayRef.detachments().subscribe(() => this.closeOverlay());
    } else {

      this.positionStrategy.setOrigin(origin.elementRef);
      this.overlayRef.updatePosition();
    }

    const portal = new TemplatePortal(this.dropdownOverlayTpl, this.vcr, { $implicit: null, ctx, width } as any);
    if (this.overlayRef.hasAttached()) this.overlayRef.detach();
    this.overlayRef.attach(portal);
  }

  isDropdownOpen(rowIndex: number, field: string): boolean {
    return (
      this.dropdownOverlay?.rowIndex === rowIndex &&
      this.dropdownOverlay?.field === field
    );
  }

  selectDropdownOption(rowIndex: number, field: string, opt: { label: string; value: any }) {
    const r = this.rowsValue[rowIndex];
    if (r) {
      if (this.preferIdForSelect) {
        r[field + 'Id'] = String(opt.value);
        if (!r[field]) r[field] = opt.label;
      } else {
        r[field] = opt.label;
      }
    }
    this.selectChanged.emit({ rowIndex, field, value: String(opt.value) }); // << บังคับเป็น string
    this.closeOverlay();
    this.cdr.detectChanges();
  }

  toggleFooterDropdown(field: string, origin: CdkOverlayOrigin, e?: Event) {
    if (this.isDisabledForm) return;       // ✅ กันคลิก
    e?.stopPropagation();
    const column = this.columns.find(c => c.field === field);
    if (!column) return;

    const opts = this.resolveMultiOptions(this.footerRow ?? {}, column);
    this.openOverlay(origin, { rowIndex: null, field, options: opts });
  }

  isFooterDropdownOpen(field: string): boolean {
    return this.dropdownOverlay?.rowIndex === null && this.dropdownOverlay?.field === field;
  }

  selectFooterDropdownOption(field: string, opt: { label: string; value: any }) {
    if (this.preferIdForSelect) {
      this.footerRow[field + 'Id'] = String(opt.value);
      if (!this.footerRow[field]) this.footerRow[field] = opt.label;
    } else {
      this.footerRow[field] = opt.label;
    }
    if (this.isRequired(field)) this.validateFooterField(field);
    this.closeOverlay();
    this.cdr.detectChanges();
  }

  getSelectDisplay(row: any, column: any): string {
    if (!this.preferIdForSelect) {
      const v = this.getCellValue(row, column.field);
      return v == null ? '' : String(v);
    }

    const id = row?.[column.field + 'Id'];
    if (id == null || id === '') {
      const v = this.getCellValue(row, column.field);
      return v == null ? '' : String(v);
    }
    const opts = this.resolveMultiOptions(row, column);
    const found = (opts || []).find(o => String(o?.value) === String(id));
    return found?.label ?? (row?.[column.field] ?? '');
  }

  isCellDisabled(row: any, field: string): boolean {
    return !!this.isDisabledForm || !!row?.[field + 'Readonly'];
  }

  private closeOverlay() {
    if (this.overlayRef?.hasAttached()) this.overlayRef.detach();
  }

  @HostListener('document:click', ['$event'])
  onOutsideClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-button') &&
      !target.closest('.dropdown-overlay')) {
      this.dropdownOverlay = null;
      this.closeOverlay();
      this.cdr.detectChanges();
    }
  }

  // Utility Methods
  getCellValue(row: any, field: string): any {
    if (field === '__index') {
      const index = this.rowsValue.findIndex(r => r === row);
      return index >= 0 ? index + 1 : '';
    }

    return field.split('.').reduce((obj, key) => obj?.[key], row);
  }

  dynamicClassBtn(value: string): string {
    const val = value?.toLowerCase().trim();

    switch (val) {
      case 'pending':
        return 'tw-text-[#FFAA00] hover:tw-text-[#D5920A]';
      case 'inprocess':
      case 'in process':
        return 'tw-text-[#5500FF] hover:tw-text-[#5f31bb]';
      case 'scheduled':
        return 'tw-text-indigo-400 hover:tw-text-indigo-500';
      case 'complete':
      case 'offer':
      case 'onboarded':
        return 'tw-text-[#00AA00] hover:tw-text-[#068506]';
      case 'not offer job':
      case 'decline offer':
      case 'not offer':
        return 'tw-text-[#FF0000] hover:tw-text-[#cb0b0b]';
      default:
        return 'tw-text-[#919191] hover:tw-text-[#656161]';
    }
  }



  getVisibleColumnCount(): number {
    let count = this.columns.filter(
      (col) => !col.subColumn || this.isSubColumnVisible(col)
    ).length;

    if (this.showCheckbox) count += 1;
    return count;

    // return this.columns.length;
  }

  getBackgroundClass(fill?: string): string {
    const classMap: Record<string, string> = {
      red: 'tw-bg-red-500/10',
      green: 'tw-bg-green-500/10',
      orange: 'tw-bg-orange-500/10',
      purple: 'tw-bg-purple-500/10',
      lime: 'tw-bg-lime-500/10',
      skyblue: 'tw-bg-sky-500/10',
      pink: 'tw-bg-pink-500/10',
    };

    return classMap[fill?.toLowerCase() ?? ''] || 'tw-bg-[#e5e7eb66]';
  }

  onToggleChange(event: Event, row: any): void {
    event.stopPropagation();

    const checkbox = event.target as HTMLInputElement;
    const targetStatus = checkbox.checked;

    checkbox.checked = !targetStatus;

    if (!row._isNew && !this.isToggleAlert && this.isConfirmDialogToggleRequired) {
      Promise.resolve().then(() => {
        const container = document.querySelector('.cdk-overlay-container');
        container?.classList.add('dimmed-overlay');
      });

      const dialogRef = this.dialog.open(AlertDialogComponent, {
        width: '496px',
        panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
        autoFocus: false,
        disableClose: true,
        data: {
          title: 'Confirmation',
          message: 'Are you sure you want to change the status of this item?',
          confirm: true
        }
      });

      dialogRef.afterClosed().subscribe((confirmed: boolean) => {
        const container = document.querySelector('.cdk-overlay-container');
        container?.classList.remove('dimmed-overlay');

        if (confirmed) {
          this.toggleChange.emit({ row, checked: targetStatus, checkbox });
        }
      });
    } else {
      if (this.isToggleAlert) {
        Promise.resolve().then(() => {
          const container = document.querySelector('.cdk-overlay-container');
          container?.classList.add('dimmed-overlay');
        });

        const dialogRef = this.dialog.open(AlertDialogComponent, {
          width: '640px',
          panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
          autoFocus: false,
          disableClose: true,
          data: {
            title: 'Please contact the Information Technology Department',
            message: `For change the status of this item, please contact our Information Technology Department for assistance.`,
            confirm: false
          }
        });

        dialogRef.afterClosed().subscribe(() => {
          const container = document.querySelector('.cdk-overlay-container');
          container?.classList.remove('dimmed-overlay');
        });
      } else {
        this.toggleChange.emit({ row, checked: targetStatus, checkbox });
      }
      console.log('Toggle change', { row, checked: targetStatus, checkbox });
    }
  }

  getCellType(row: any, column: any): string {
    const rowType = row?.[`${column.field}Type`];
    if (rowType) return rowType;
    return column.type || 'text';
  }

  // textlin on click
  onClickView(event: Event, row: any, column?: any): void {
    event.stopPropagation();
    console.log('View', row);
    this.viewRowClicked.emit(row);
    this.columnRowClicked.emit({ column, row });
  }

  onClickEditDialog(event: Event, row: any): void {
    event.stopPropagation();
    this.editClicked.emit(row);
  }

  onClickEditCard(event: Event, row: any): void {
    event.stopPropagation();
    this.editCardClicked.emit(row);
  }

  onClickEdit(event: Event, row: any, index: number): void {
    event.stopPropagation();
    this.editingRowId = index;
    this.editRow = true;

    this.editingBuffer = typeof structuredClone === 'function'
      ? structuredClone(row)
      : JSON.parse(JSON.stringify(row));

    if (this.highlightRowIndex && this.ishighlightRow) {
      this.ishighlightRow = false
      this.fieldErrors = false
    }

    this.cdr.detectChanges();
  }

  onClickSave(event: Event, row: any): void {
    event.stopPropagation();

    const doEmitAttempt = () => {
      // รวมร่าง draft = row ปัจจุบัน + editingBuffer (ค่าที่ผู้ใช้แก้)
      const draft = this.editingBuffer ? { ...row, ...this.editingBuffer } : { ...row };
      this.inlineSaveAttempt.emit({ draft, original: row });
      // ❗ ไม่ปิดโหมดแก้ไข ปล่อยให้ parent ตัดสินใจ
    };

    if (this.useExternalInlineSaveFlow) {
      doEmitAttempt();
      return;
    }

    if (this.isConfirmDialogSaveRequired) {
      Promise.resolve().then(() => {
        const container = document.querySelector('.cdk-overlay-container');
        container?.classList.add('dimmed-overlay');
      });

      const dialogRef = this.dialog.open(AlertDialogComponent, {
        width: '496px',
        panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
        autoFocus: false,
        disableClose: true,
        data: {
          title: 'Confirmation',
          message: 'Are you sure you want to save this data?',
          confirm: true
        }
      });

      dialogRef.afterClosed().subscribe((confirmed: boolean) => {
        const container = document.querySelector('.cdk-overlay-container');
        container?.classList.remove('dimmed-overlay');

        if (confirmed) {
          if (this.editingBuffer) Object.assign(row, this.editingBuffer);

          this.editingRowId = null;
          this.editRow = false;
          this.editingBuffer = null;
          this.cdr.detectChanges();

          this.editClicked.emit(row);
        }
      });
    } else {
      if (this.editingBuffer) Object.assign(row, this.editingBuffer);

      this.editingRowId = null;
      this.editRow = false;
      this.editingBuffer = null;
      this.cdr.detectChanges();

      this.editClicked.emit(row);
      console.log('SaveInline', row);
    }
  }

  onClickCancel(event: Event, row: any): void {
    event.stopPropagation();
    this.editingRowId = null;
    // this.editedValue = '';
    this.editRow = false;
    this.editingBuffer = null;
    this.inlineCancel.emit(row);
    console.log('Cancelled edit');
  }

  onClickDelete(event: Event, row: any): void {
    event.stopPropagation();
    console.log('Delete', row);
    this.deleteRowClicked.emit(row);
  }

  // TrackBy Functions for Performance
  trackByColumn: TrackByFunction<Column> = (index, column) => column.field;
  trackByRow: TrackByFunction<any> = (index, row) => row._tempId ?? row.id ?? index;
  trackByOption: TrackByFunction<any> = (index, option) => String(option?.value ?? option);

  startInlineCreate(defaults: any = {}, position: 'top' | 'bottom' = 'top') {
    const newRow = { _tempId: `__new__${Date.now()}`, _isNew: true, ...defaults };
    const snapshot = this.rowsValue as any[];

    // if (position === 'bottom') {
    //   snapshot.push(newRow);
    //   requestAnimationFrame(() => {
    //     this.tableWrapperRef?.nativeElement?.scrollTo({
    //       top: this.tableWrapperRef.nativeElement.scrollHeight,
    //       behavior: 'smooth'
    //     });
    //   });
    // } else {
    //   snapshot.unshift(newRow);
    // }

    this.editingRowId = newRow._tempId;
    this.editRow = true;
    this.cdr.detectChanges();
  }

  saveInlineCreate(row: any) {
    if (!this.validateFooter()) {
      this.cdr.detectChanges();
      return; // ไม่ emit ออกไป
    }

    let payload: any;

    if (this.isReasonSave) {
      const reason = (row?.reasonText ?? '').trim();
      payload = {
        reasonText: reason,
        isActive: true,
      };
    } else {
      payload = { ...row };
      if (!this.isZeroOneStatus) {
        payload.status = payload.activeStatus ? 1 : 2;
      } else {
        payload.status = payload.activeStatus ? 1 : 0;
      }
    }

    delete payload._tempId;
    delete payload._isNew;
    this.createInlineSave.emit(payload);
  }

  cancelInlineCreate(row?: any) {
    if (row?._isNew) {
      const idx = this.rowsValue.findIndex(r => r === row);
      if (idx >= 0) {
        this.rowsValue.splice(idx, 1);
      }
    }
    this.editingRowId = null;
    this.editRow = false;
    this.createInlineCancel.emit();
    this.footerErrors = {};
    this.cdr.detectChanges();

    if (this.highlightRowIndex && this.ishighlightRow) {
      this.ishighlightRow = false
    }
  }

  onNumberKeydown(e: KeyboardEvent, field: string) {
    if (field !== 'sort' && field !== 'scoringMethod') return;
    const blocked = ['e', 'E', '+', '-', '.'];
    if (blocked.includes(e.key)) e.preventDefault();
  }

  onNumberTyping(e: Event, field: string) {
    if (field !== 'sort' && field !== 'scoringMethod') return;
    const el = e.target as HTMLInputElement;
    const onlyDigits = el.value.replace(/[^\d]/g, '');
    if (onlyDigits !== el.value) el.value = onlyDigits;
    this.footerRow[field] = onlyDigits === '' ? undefined : Number(onlyDigits);
  }

  onNumberBlur(e: Event, field: string) {
    if (field !== 'sort' && field !== 'scoringMethod') return;
    const el = e.target as HTMLInputElement;
    const n = Number(el.value || 0);
    if (!Number.isFinite(n) || n < 1) {
      el.value = '1';
      this.footerRow[field] = 1;
    }
  }

  onFooterInputChange() {
    if (Object.keys(this.footerErrors).length) {
      this.validateFooter(); // re-validate
      this.cdr.detectChanges();
    }
  }

  private validateFooter(): boolean {
    const err: Record<string, boolean> = {};
    for (const f of this.requiredFooterFields || []) {
      const v = this.footerRow?.[f];

      if (this.hasLockedPrefix(f)) {
        const suffix = this.extractLockedSuffix(String(v ?? ''));
        if (suffix === '') err[f] = true;
        continue;
      }

      if (f === 'score') {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > this.scoreMax) err[f] = true;
        continue;
      }

      if (f === 'sort' || f === 'scoringMethod') {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 1) err[f] = true;
      } else if (typeof v === 'string') {
        if (!v || v.trim() === '') err[f] = true;
      } else if (v === undefined || v === null) {
        err[f] = true;
      }
    }
    this.footerErrors = err;
    return Object.keys(err).length === 0;
  }

  onFooterInput(field: string, e: Event) {
    if (field === 'sort' || field === 'scoringMethod') {
      this.onNumberTyping(e, field);
    } else if (field === 'score') {
      const el = e.target as HTMLInputElement;
      const sanitized = this.sanitizeDecimalNonNegative(el.value);
      if (sanitized !== el.value) el.value = sanitized;

      let n = sanitized === '' ? undefined : Number(sanitized);
      if (n !== undefined) {
        if (n < 0) { n = 0; el.value = '0'; }
        if (n > this.scoreMax) { n = this.scoreMax; el.value = String(this.scoreMax); }
      }
      this.footerRow[field] = n;
    }
    if (this.isRequired(field)) this.validateFooterField(field);
    this.cdr.detectChanges();
  }

  onFooterKeydown(field: string, e: KeyboardEvent) {
    if (field === 'sort' || field === 'scoringMethod') {
      const blocked = ['e', 'E', '+', '-', '.'];
      if (blocked.includes(e.key)) e.preventDefault();
    } else if (field === 'score') {
      const blocked = ['e', 'E', '+', '-']; // อนุญาต '.'
      if (blocked.includes(e.key)) e.preventDefault();
    }
  }

  onFooterBlur(field: string, e: Event) {
    if (field === 'sort' || field === 'scoringMethod') {
      this.onNumberBlur(e, field);
    } else if (field === 'score') {
      const el = e.target as HTMLInputElement;
      let n = Number(el.value);
      if (!Number.isFinite(n)) n = 0;
      if (n < 0) n = 0;
      if (n > this.scoreMax) n = this.scoreMax;
      el.value = String(n);
      this.footerRow[field] = n;
    }
    if (this.isRequired(field)) this.validateFooterField(field);
    this.cdr.detectChanges();
  }

  private isRequired(field: string): boolean {
    return (this.requiredFooterFields || []).includes(field);
  }

  private validateFooterField(field: string): void {
    const v = this.footerRow?.[field];
    const next = { ...this.footerErrors };
    delete next[field];

    if (this.hasLockedPrefix(field)) {
      const suffix = this.extractLockedSuffix(String(v ?? ''));
      if (suffix === '') next[field] = true;
    } else if (field === 'score') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > this.scoreMax) next[field] = true;
    } else if (field === 'sort' || field === 'scoringMethod') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1) next[field] = true;
    } else {
      if (typeof v === 'string') {
        if (!v || v.trim() === '') next[field] = true;
      } else if (v === undefined || v === null) {
        next[field] = true;
      }
    }
    this.footerErrors = next;
  }

  onDrop(event: CdkDragDrop<any[]>) {
    if (!this.draggableRows || this.isDisabledForm) return;

    // 1) rearrange อาร์เรย์ที่โชว์ในตาราง
    moveItemInArray(this.rowsValue, event.previousIndex, event.currentIndex);

    // 2) อัปเดตฟิลด์ sort ให้ทุกแถวเท่ากับตำแหน่งใหม่ (i+1)
    this.rowsValue.forEach((r, i) => (r.sort = i + 1));

    // 3) แจ้ง parent เพื่อ sync แหล่งข้อมูลจริง (FormArray)
    this.rowsReordered.emit({
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
    });

    this.cdr.detectChanges();
  }

  onInlineNumberKeydown(field: string, e: KeyboardEvent) {
    if (field === 'sort' || field === 'scoringMethod') {
      const blocked = ['e', 'E', '+', '-', '.'];
      if (blocked.includes(e.key)) e.preventDefault();
    } else if (field === 'score') {
      const blocked = ['e', 'E', '+', '-']; // อนุญาต '.'
      if (blocked.includes(e.key)) e.preventDefault();

      if (e.key === 'Enter') {
        // อ่านค่าปัจจุบันจาก input แล้ว emit commit
        const el = e.target as HTMLInputElement;
        const sanitized = this.sanitizeDecimalNonNegative(el.value);
        const n = sanitized === '' ? undefined : Number(sanitized);
        const rowIndex = this.getEditingRowIndex();
        if (rowIndex >= 0) {
          this.inlineFieldCommit.emit({ rowIndex, field, value: n });
        }
        // กัน Enter ไป trigger อื่น
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  onInlineNumberInput(field: string, e: Event) {
    if (field === 'sort' || field === 'scoringMethod') {
      const el = e.target as HTMLInputElement;
      const onlyDigits = el.value.replace(/[^\d]/g, '');
      if (onlyDigits !== el.value) el.value = onlyDigits;
      if (this.editingBuffer) {
        this.editingBuffer[field] = onlyDigits === '' ? undefined : Number(onlyDigits);
      }
    } else if (field === 'score') {
      const el = e.target as HTMLInputElement;
      const sanitized = this.sanitizeDecimalNonNegative(el.value);
      if (sanitized !== el.value) el.value = sanitized;

      let n = sanitized === '' ? undefined : Number(sanitized);
      if (n !== undefined) {
        if (n < 0) n = 0;
        if (n > this.scoreMax) { n = this.scoreMax; el.value = String(this.scoreMax); }
      }
      if (this.editingBuffer) this.editingBuffer[field] = n;
    }
  }

  onInlineNumberBlur(field: string, e: Event) {
    if (field === 'sort' || field === 'scoringMethod') {
      const el = e.target as HTMLInputElement;
      let n = Number(el.value || 0);
      if (!Number.isFinite(n) || n < 1) n = 1;
      el.value = String(n);
      if (this.editingBuffer) this.editingBuffer[field] = n;
    } else if (field === 'score') {
      const el = e.target as HTMLInputElement;
      let n = Number(el.value);
      if (!Number.isFinite(n)) n = 0;
      if (n < 0) n = 0;
      if (n > this.scoreMax) n = this.scoreMax;
      el.value = String(n);
      if (this.editingBuffer) this.editingBuffer[field] = n;

      // แจ้ง parent ว่ามีการ commit ค่านี้แล้ว (ให้ parent ไปแมพ dropdown ต่อ)
      const rowIndex = this.getEditingRowIndex();
      if (rowIndex >= 0) {
        this.inlineFieldCommit.emit({ rowIndex, field, value: n });
      }
    }
  }

  // onInlineKeydown(e: KeyboardEvent, row: any) {
  //   if (e.key === 'Enter') { e.preventDefault(); this.saveInlineCreate(row); }
  //   if (e.key === 'Escape') { e.preventDefault(); this.cancelInlineCreate(row); }
  // }

  getRowTextlinkActions(column: Column, row: any): string[] {
    // เคารพ row override เสมอ แม้จะเป็น []
    if (column?.useRowTextlinkActions) {
      return Array.isArray(row?.textlinkActions) ? row.textlinkActions : [];
    }
    // ถ้าไม่ได้ใช้ row override ค่อย fallback ไปที่คอลัมน์
    return Array.isArray(column?.textlinkActions) ? column.textlinkActions! : [];
  }

  private sanitizeDecimalNonNegative(value: string): string {
    // เอาเฉพาะตัวเลขและจุดทศนิยม
    let s = value.replace(/[^0-9.]/g, '');
    // ให้มีจุดได้แค่ 1 จุด
    const parts = s.split('.');
    if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
    return s;
  }

  private hasLockedPrefix(field: string): boolean {
    return !!this.lockedPrefixConfig && this.lockedPrefixConfig.field === field;
  }

  extractLockedSuffix(value: string): string {
    const prefix = this.lockedPrefixConfig?.prefix ?? '';
    if (typeof value !== 'string') return '';
    const s = value.startsWith(prefix) ? value.slice(prefix.length) : value;
    return s.trim();
  }

  onLockedPrefixEditingInput(field: string, e: Event) {
    const el = e.target as HTMLInputElement;
    const sanitized = this.sanitizeDecimalNonNegative(el.value);
    if (sanitized !== el.value) el.value = sanitized;
    const prefix = this.lockedPrefixConfig?.prefix ?? '';
    if (this.editingBuffer) this.editingBuffer[field] = prefix + sanitized;
  }

  onLockedPrefixFooterInput(field: string, e: Event) {
    const el = e.target as HTMLInputElement;
    const sanitized = this.sanitizeDecimalNonNegative(el.value);
    if (sanitized !== el.value) el.value = sanitized;
    const prefix = this.lockedPrefixConfig?.prefix ?? '';
    this.footerRow[field] = prefix + sanitized;
  }

  // ---------- Helpers: merge row ----------
  isMergeField(field: string): boolean {
    return Array.isArray(this.mergeByFields) && this.mergeByFields.includes(field);
  }

  /** เรนเดอร์เซลล์เฉพาะ "หัวกลุ่ม" (แถวแรกของค่าซ้ำ) */
  shouldRenderMergedCell(rowIndex: number, field: string): boolean {
    if (!this.isMergeField(field)) return true;
    if (rowIndex === 0) return true;
    const curr = this.getCellValue(this.rowsValue[rowIndex], field);
    const prev = this.getCellValue(this.rowsValue[rowIndex - 1], field);
    return curr !== prev;
  }

  /** คำนวณ rowspan ของหัวกลุ่ม */
  getRowspan(rowIndex: number, field: string): number {
    if (!this.isMergeField(field)) return 1;
    const rows = this.rowsValue;
    if (rowIndex >= rows.length) return 1;
    const val = this.getCellValue(rows[rowIndex], field);
    let span = 1;
    for (let i = rowIndex + 1; i < rows.length; i++) {
      if (this.getCellValue(rows[i], field) === val) span++;
      else break;
    }
    return span;
  }

  public commitInlineSave() {
    // เอา buffer -> ผสานเข้า row แล้วปิดโหมดแก้ไข เหมือนเดิม
    if (this.editingBuffer && this.editingRowId != null) {
      const index = typeof this.editingRowId === 'number'
        ? this.editingRowId - 1
        : this.rowsValue.findIndex(r => r._tempId === this.editingRowId);

      const row = index >= 0 ? this.rowsValue[index] : null;
      if (row) Object.assign(row, this.editingBuffer);
    }
    this.editingRowId = null;
    this.editRow = false;
    const committed = this.editingBuffer;
    this.editingBuffer = null;
    this.cdr.detectChanges();

    // คงปล่อยอีเวนต์เดิมไว้เพื่อความเข้ากันได้
    if (committed) this.editClicked.emit(committed);
  }

  public openInlineEditAt(rowIndex: number): void {
    if (rowIndex == null || rowIndex < 0 || rowIndex >= this.rowsValue.length) return;

    const row = this.rowsValue[rowIndex];

    // สำหรับแถวปกติ component ใช้ index+1 เป็น editingRowId
    this.editingRowId = (row?._tempId ?? (rowIndex + 1));
    this.editRow = true;

    // clone ค่าปัจจุบันเข้าบัฟเฟอร์แก้ไข
    this.editingBuffer = typeof structuredClone === 'function'
      ? structuredClone(row)
      : JSON.parse(JSON.stringify(row));

    this.cdr.detectChanges();
  }

  /** true เมื่อเซลล์ merge (เริ่มที่ rowIndex) ครอบคลุมจนถึงแถวสุดท้ายของตาราง */
  isEndOfMergedGroup(rowIndex: number, field: string): boolean {
    const span = this.getRowspan(rowIndex, field);
    return rowIndex + span >= this.rowsValue.length;
  }

  // --- helper หาตำแหน่งแถวที่กำลังแก้ไขอยู่ ---
  private getEditingRowIndex(): number {
    // ถ้า editingRowId เป็นหมายเลข index จะเป็นลำดับแถว (เริ่ม 1) -> ต้องลบ 1
    if (typeof this.editingRowId === 'number') return this.editingRowId - 1;
    // ถ้าเป็น tempId: หา index จาก _tempId
    const idx = this.rowsValue.findIndex(r => r._tempId === this.editingRowId);
    return idx >= 0 ? idx : -1;
  }

  private getStorageKey(): string {
    return `${this.storageNamespace}:lastClicked:${this.tableId}`;
  }

  private loadLastClickedFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(this.getStorageKey());
      if (!raw) return;
      const obj = JSON.parse(raw) as { id: string; ts?: number };
      if (!obj?.id) return;

      // TTL
      if (this.highlightTTLms > 0 && obj.ts && Date.now() - obj.ts > this.highlightTTLms) {
        sessionStorage.removeItem(this.getStorageKey());
        return;
      }

      // เติมเข้า clickedRows -> template คุณจะไฮไลท์ให้เอง
      this.clickedRows.add(String(obj.id));
      this.listClickedRows.emit(this.clickedRows);

      if (this.singleUseHighlight) {
        // ใช้ครั้งเดียวลบทิ้ง
        sessionStorage.removeItem(this.getStorageKey());
      }

      this.cdr.markForCheck();
    } catch { /* ignore */ }
  }

  private saveLastClickedToStorage(id: string | number) {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        this.getStorageKey(),
        JSON.stringify({ id: String(id), ts: Date.now() })
      );
    } catch { /* ignore */ }
  }

}
