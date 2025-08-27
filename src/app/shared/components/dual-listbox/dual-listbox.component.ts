import { CommonModule } from '@angular/common';
import {
  Component,
  forwardRef,
  Input,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type Item = Record<string, any>;

@Component({
  selector: 'app-dual-listbox',
  templateUrl: './dual-listbox.component.html',
  styleUrl: './dual-listbox.component.scss',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => DualListboxComponent),
    multi: true
  }],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DualListboxComponent implements ControlValueAccessor, OnChanges {
  /** รายการทั้งหมด */
  private _items: Item[] = [];
  @Input() set items(val: Item[] | null | undefined) {
    this._items = Array.isArray(val) ? val : [];
    this.syncChosenWithItems();
  }
  get items(): Item[] { return this._items; }

  /** คีย์ id และ display */
  @Input() valueField: string = 'value';
  @Input() displayField: string = 'label';

  /** ข้อความหัวข้อ */
  @Input() leftTitle = 'Available';
  @Input() rightTitle = 'Selected';

  /** placeholder ช่องค้นหา */
  @Input() leftFilterPlaceholder = 'Filter...';
  @Input() rightFilterPlaceholder = 'Filter...';

  /** ความสูง list */
  @Input() height = '260px';

  @Input() disabledBox = false;

  /** เก็บรายการที่เลือก (object เต็ม) */
  chosen: Item[] = [];

  /** ช่องค้นหา */
  leftQuery = '';
  rightQuery = '';

  selectedAvailValues = new Set<any>();
  selectedChosenValues = new Set<any>();

  constructor(private cdr: ChangeDetectorRef) { }

  private onChange: (val: any) => void = () => { };
  private onTouched: () => void = () => { };
  private pendingValues: any[] | null = null;

  private syncChosenWithItems() {
    const byValue = new Map<any, Item>(this._items.map(i => [i[this.valueField], i]));
    this.chosen = (this.chosen || [])
      .map(c => byValue.get(c?.[this.valueField]))
      .filter(Boolean) as Item[];
    this.emitValue();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.syncChosenWithItems();
      this.cdr.markForCheck();
    }
  }

  // ----- ControlValueAccessor -----

  writeValue(values: any[] | null): void {
    const set = new Set(values ?? []);
    this.chosen = this.items.filter(i => set.has(i[this.valueField]));
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    this.disabledBox = isDisabled;
    this.cdr.markForCheck();
  }

  // ----- Lists (available/chosen + filter) -----
  available(): Item[] {
    const chosenSet = new Set(this.chosen.map(c => c[this.valueField]));
    return this.items.filter(i => !chosenSet.has(i[this.valueField]));
  }

  filteredAvailable(): Item[] {
    const q = this.leftQuery.trim().toLowerCase();
    const base = this.available();
    return q ? base.filter(i => (i[this.displayField] + '').toLowerCase().includes(q)) : base;
  }

  filteredChosen(): Item[] {
    const q = this.rightQuery.trim().toLowerCase();
    return q ? this.chosen.filter(i => (i[this.displayField] + '').toLowerCase().includes(q)) : this.chosen;
  }

  trackByValue = (_: number, it: Item) => it[this.valueField];

  // ----- Move helpers -----
  private getSelectedValuesFromSelect(ev: Event): any[] {
    const sel = ev.target as HTMLSelectElement;
    return Array.from(sel.selectedOptions).map(o => o.value);
  }

  private toItems(values: any[], within: Item[]): Item[] {
    const map = new Map<any, Item>(within.map(i => [i[this.valueField], i]));
    return values.map(v => map.get(v)).filter(Boolean) as Item[];
  }

  moveRightFromDom(ev: Event) {
    if (this.disabledBox) return;
    const values = this.getSelectedValuesFromSelect(ev);
    const items = this.toItems(values, this.filteredAvailable());
    this.addToChosen(items);
  }

  moveLeftFromDom(ev: Event) {
    if (this.disabledBox) return;
    const values = this.getSelectedValuesFromSelect(ev);
    this.removeFromChosenByValue(values);
  }

  moveRight() {
    if (this.disabledBox) return;
    // ย้ายเฉพาะที่ “แสดงอยู่” (ผ่าน filter) และถูกเลือกใน DOM
    const leftSel = document.activeElement as HTMLSelectElement | null;
    console.log(leftSel, '=>leftSel')
    // const t = leftSel.classList.contains('dlb-select')
    if (leftSel && leftSel.classList.contains('dlb-select')) {
      const values = this.getSelectedValuesFromSelect({ target: leftSel } as any);
      const items = this.toItems(values, this.filteredAvailable());
      this.addToChosen(items);
      console.log(values, '=>values')
    }
  }

  moveLeft() {
    if (this.disabledBox) return;
    const rightSel = document.activeElement as HTMLSelectElement | null;
    if (rightSel && rightSel.classList.contains('dlb-select')) {
      const values = this.getSelectedValuesFromSelect({ target: rightSel } as any);
      this.removeFromChosenByValue(values);
    }
  }

  moveAllRight() {
    if (this.disabledBox) return;
    this.addToChosen(this.available());
    this.selectedAvailValues = new Set(); // <— สำคัญ
    this.cdr.markForCheck();
  }

  moveAllLeft() {
    if (this.disabledBox) return;
    this.chosen = [];
    this.emitValue();
    this.selectedChosenValues = new Set(); // <— สำคัญ
    this.cdr.markForCheck();
  }

  private addToChosen(items: Item[]) {
    if (!items.length) return;
    const existing = new Set(this.chosen.map(i => i[this.valueField]));
    const toAdd = items.filter(i => !existing.has(i[this.valueField]));
    this.chosen = [...this.chosen, ...toAdd];
    this.emitValue();
  }

  private removeFromChosenByValue(values: any[]) {
    if (!values.length) return;
    const removeSet = new Set(values);
    this.chosen = this.chosen.filter(i => !removeSet.has(i[this.valueField]));
    // sync selection ขวา
    const s = new Set(this.selectedChosenValues);
    values.forEach(v => s.delete(v));
    this.selectedChosenValues = s;

    this.emitValue();
  }

  private emitValue(touch = true) {
    const val = this.chosen.map(i => i[this.valueField]);
    this.onChange(val);
    if (touch) this.onTouched();
    this.cdr.markForCheck();           // <<< กันพลาด
  }

  private coerceVal(v: any): any {
    const sample = this.items?.[0]?.[this.valueField];
    switch (typeof sample) {
      case 'number': return Number(v);
      case 'boolean': return v === 'true';
      default: return String(v ?? '');
    }
  }

  private getSelectedValues(sel: HTMLSelectElement): any[] {
    const opts = sel?.selectedOptions ? Array.from(sel.selectedOptions) : [];
    return opts.map(o => this.coerceVal(o.value));
  }

  moveRightFromSelect(sel: HTMLSelectElement) {
    if (this.disabledBox || !sel) return;
    const values = this.getSelectedValues(sel);
    const items = this.toItems(values, this.filteredAvailable() || []);
    this.addToChosen(items);
  }

  moveLeftFromSelect(sel: HTMLSelectElement) {
    if (this.disabledBox || !sel) return;
    const values = this.getSelectedValues(sel);
    this.removeFromChosenByValue(values);
  }

  onAvailToggle(item: Item, checked: boolean) {
    const key = item[this.valueField];
    const s = new Set(this.selectedAvailValues);
    checked ? s.add(key) : s.delete(key);
    this.selectedAvailValues = s;
    this.cdr.markForCheck();
  }

  onChosenToggle(item: Item, checked: boolean) {
    const key = item[this.valueField];
    const s = new Set(this.selectedChosenValues);
    checked ? s.add(key) : s.delete(key);
    this.selectedChosenValues = s;
    this.cdr.markForCheck();
  }

  moveRightFromCheckboxes() {
    if (this.disabledBox) return;
    const toMove = this.available().filter(i => this.selectedAvailValues.has(i[this.valueField]));
    this.addToChosen(toMove);
    this.selectedAvailValues = new Set(); // <— สำคัญ
    this.cdr.markForCheck();
  }

  moveLeftFromCheckboxes() {
    if (this.disabledBox) return;
    const values = Array.from(this.selectedChosenValues);
    this.removeFromChosenByValue(values);
    this.selectedChosenValues = new Set(); // <— สำคัญ
    this.cdr.markForCheck();
  }

  // ใน DualListboxComponent
  get hasAvailSelection(): boolean {
    return this.selectedAvailValues.size > 0;
  }
  get hasChosenSelection(): boolean {
    return this.selectedChosenValues.size > 0;
  }
}