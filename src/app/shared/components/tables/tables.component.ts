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
} from '@angular/core';
import { Column } from '../../interfaces/tables/column.interface';

export type SortState = {
  [field: string]: 'asc' | 'desc' | null;
};

interface DropdownOverlay {
  visible: boolean;
  rowIndex: number;
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
  implements OnInit, OnChanges, AfterViewInit, AfterViewChecked, OnDestroy
{
  rows = input<any[]>([]);  
  resetKey = input<number>(0);
  preClickedRowIds = input<string[]>([]);
  sortStates = input<SortState>({});

 @Input() showCheckbox: boolean = true;
  @Input() splitRows: boolean = true;
  @Input() columns: Column[] = [];

  @Output() selectionChanged = new EventEmitter<any[]>();
  @Output() rowClicked = new EventEmitter<any>();
  @Output() listClickedRows = new EventEmitter<Set<string>>();
  @Output() columnClicked = new EventEmitter<SortState>();

  sortedColumns: string[] = [];
  clickedRows: Set<string> = new Set();
  selectedRows: Set<number> = new Set();
  allSelected: boolean = false;
  expandedMainColumns = new Set<string>();
  dropdownOverlay: DropdownOverlay | null = null;

  @ViewChild('selectAllCheckbox')
  selectAllCheckbox!: ElementRef<HTMLInputElement>;
  @ViewChild('tableWrapper', { static: true })
  tableWrapperRef!: ElementRef<HTMLDivElement>;

  private destroyRef = inject(DestroyRef);

  constructor(private cdr: ChangeDetectorRef) {
    // ใช้ effect เพื่อ watch การเปลี่ยนแปลงของ rows signal
    effect(() => {
      const currentRows = this.rows();

      // อัพเดต selection state เมื่อ rows เปลี่ยน
      this.updateAllSelectedState();

      // ถ้า selectedRows มีค่าที่เกินจำนวน rows ปัจจุบัน ให้ลบออก
      if (currentRows && currentRows.length > 0) {
        const validIndices = new Set<number>();
        this.selectedRows.forEach((index) => {
          if (index < currentRows.length) {
            validIndices.add(index);
          }
        });
        this.selectedRows = validIndices;
      }

      this.cdr.detectChanges();
    });
  }

  ngOnInit() {
    this.preClickedRowIds().forEach((id) => this.clickedRows.add(id));
    this.updateAllSelectedState();
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
      this.cdr.detectChanges();
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

    this.columnClicked.emit(this.sortStateValue);
  }

  // Event Handlers
  onRowClick(row: any, event: MouseEvent) {
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
      this.clickedRows.add(String(row.id)); // ป้องกันไว้เป็น string
      this.listClickedRows.emit(this.clickedRows);
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

  // FIXED: Dropdown Management
  toggleDropdown(rowIndex: number, field: string, event?: Event) {
    event?.stopPropagation();

    if (this.isDropdownOpen(rowIndex, field)) {
      this.dropdownOverlay = null;
      return;
    }

    const buttonEl = document.getElementById(
      `dropdown-button-${rowIndex}-${field}`
    );
    const wrapperEl = this.tableWrapperRef?.nativeElement;

    if (!buttonEl || !wrapperEl) return;

    const buttonRect = buttonEl.getBoundingClientRect();
    const wrapperRect = wrapperEl.getBoundingClientRect();

    const column = this.columns.find((c) => c.field === field);
    if (!column?.options) return;

    this.dropdownOverlay = {
      visible: true,
      rowIndex,
      field,
      x: buttonRect.left - wrapperRect.left,
      y: buttonRect.bottom - wrapperRect.top + 4,
      width: buttonRect.width,
      options: column.options,
    };

    this.cdr.detectChanges();
  }

  isDropdownOpen(rowIndex: number, field: string): boolean {
    return (
      this.dropdownOverlay?.rowIndex === rowIndex &&
      this.dropdownOverlay?.field === field
    );
  }

  selectDropdownOption(rowIndex: number, field: string, value: string) {
    const currentRows = this.rowsValue;
    if (currentRows[rowIndex]) {
      currentRows[rowIndex][field] = value;
    }
    this.dropdownOverlay = null;
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onOutsideClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (
      !target.closest('.dropdown-button') &&
      !target.closest('.dropdown-overlay')
    ) {
      this.dropdownOverlay = null;
      this.cdr.detectChanges();
    }
  }

  // Utility Methods
  getCellValue(row: any, field: string): any {
    return field.split('.').reduce((obj, key) => obj?.[key], row);
  }

  getVisibleColumnCount(): number {
    let count = this.columns.filter(
      (col) => !col.subColumn || this.isSubColumnVisible(col)
    ).length;

    if (this.showCheckbox) count += 1;
    return count;
  }

  // TrackBy Functions for Performance
  trackByColumn: TrackByFunction<Column> = (index, column) => column.field;
  trackByRow: TrackByFunction<any> = (index, row) => row.id || index;
  trackByOption: TrackByFunction<string> = (index, option) => option;
}
