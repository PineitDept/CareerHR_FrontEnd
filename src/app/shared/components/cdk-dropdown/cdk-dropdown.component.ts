import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef,
  ViewChild, TemplateRef, ViewContainerRef, forwardRef,
  HostListener,
  ElementRef
} from '@angular/core';
import { Overlay, OverlayRef, FlexibleConnectedPositionStrategy, ConnectedPosition, ScrollStrategyOptions } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type DropdownOption = string | { label: string; value: any; disabledSelected?: boolean };
type Opt = string | { label: string; value: any };

@Component({
  selector: 'app-cdk-dropdown',
  templateUrl: './cdk-dropdown.component.html',
  styleUrls: ['./cdk-dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => CdkDropdownComponent),
    multi: true,
  }],
})
export class CdkDropdownComponent implements ControlValueAccessor {
  @Input() value: any;
  @Input() options: Opt[] = [];
  @Input() placeholder = 'Select';
  @Input() panelMaxHeight = 240;
  @Input() label: string = '';
  @Input() require: boolean = false;

  // value: any = null;
  @Input() disabledSelected = false;

  @Input() searchable = false;
  @Input() searchPlaceholder = 'Select';
  @Input() noMatchText = 'No results';
  searchTerm = '';

  @Output() valueChange = new EventEmitter<any>();

  @ViewChild('panel', { static: true }) panelTpl!: TemplateRef<any>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  isOpen = false;
  activeIndex = -1;

  private overlayRef?: OverlayRef;
  private positionStrategy!: FlexibleConnectedPositionStrategy;
  private onChange: (_: any) => void = () => { };
  private onTouched: () => void = () => { };

  private readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  private ro?: ResizeObserver;
  private _triggerEl?: HTMLElement;
  private _overlayEl?: HTMLElement;

  @HostListener('window:resize')
  onWindowResize() {
    if (this.isOpen && this.overlayRef && this._triggerEl) {
      const w = this._triggerEl.getBoundingClientRect().width;
      this.overlayRef.updateSize({ width: w });
      this.overlayRef.updatePosition();
    }
  }

  // ✅ Detect outside click
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const isInsideTrigger = this._triggerEl?.contains(target);
    const isInsideOverlay = this._overlayEl?.contains(target);
    if (!isInsideTrigger && !isInsideOverlay) {
      this.close();
    }
  }

  constructor(
    private overlay: Overlay,
    private vcr: ViewContainerRef,
    private cdr: ChangeDetectorRef,
    private sso: ScrollStrategyOptions,
  ) { }

  // ------------ CVA methods ------------
  writeValue(obj: any): void {
    this.value = obj ?? null;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledSelected = isDisabled;
    this.cdr.markForCheck();
  }
  // -------------------------------------

  get items() {
    return (this.options ?? []).map(o => typeof o === 'string' ? { label: o, value: o } : o);
  }

  get filteredItems() {
    if (!this.searchable) return this.items;
    const t = (this.searchTerm || '').trim().toLowerCase();
    if (!t) return this.items;
    return this.items.filter(i => String(i.label).toLowerCase().includes(t));
  }

  get display(): string {
    const f = this.items.find(i => this.isEqual(i.value, this.value));
    return f ? String(f.label) : this.placeholder;
  }

  open(triggerEl: HTMLElement) {
    if (this.disabledSelected) return;

    if (this.isOpen) {
      this.close();
      return;
    }

    window.addEventListener('wheel', this.preventScroll, { passive: false });
    window.addEventListener('touchmove', this.preventScroll, { passive: false });

    const w = triggerEl.getBoundingClientRect().width;
    this.positionStrategy = this.overlay.position()
      .flexibleConnectedTo(triggerEl)
      .withPositions(this.positions)
      .withFlexibleDimensions(false)
      .withPush(true)
      .withViewportMargin(8);

    this.overlayRef = this.overlay.create({
      positionStrategy: this.positionStrategy,
      hasBackdrop: false, // ❌ อย่าใช้ backdrop ถ้าอยู่ใน dialog เดี๋ยวซ้อนกัน
      scrollStrategy: this.sso.reposition(),
      panelClass: 'tw-block',
    });

    const portal = new TemplatePortal(this.panelTpl, this.vcr);
    this.overlayRef.attach(portal);

    const sync = () => {
      const width = triggerEl.getBoundingClientRect().width;
      this.overlayRef!.updateSize({ width });
      this.overlayRef!.updatePosition();
    };
    sync();
    Promise.resolve().then(sync);

    this.ro = new ResizeObserver(sync);
    this.ro.observe(triggerEl);

    if (this.searchable) {
      // this.searchTerm = this.display;
      setTimeout(() => {
        const el = this.searchInput?.nativeElement;
        if (el) {
          el.focus();
        }
      }, 0);
    }

    setTimeout(() => this.searchInput?.nativeElement?.focus(), 0);

    const idx = this.filteredItems.findIndex(i => this.isEqual(i.value, this.value));
    this.activeIndex = Math.max(0, idx);
    this.isOpen = true;
    this._triggerEl = triggerEl;
    this._overlayEl = this.overlayRef!.overlayElement;
    this.cdr.markForCheck();
  }

  close() {
    if (!this.isOpen) return;

    window.removeEventListener('wheel', this.preventScroll);
    window.removeEventListener('touchmove', this.preventScroll);

    this.ro?.disconnect();
    this.ro = undefined;
    this.overlayRef?.detach();
    this.isOpen = false;
    this.activeIndex = -1;
    this._triggerEl = undefined;
    this._overlayEl = undefined;

    this.onTouched();
    this.cdr.markForCheck();
  }

  private preventScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.closest('.cdk-overlay-pane')) {
      return;
    }

    e.preventDefault();
  };

  @Input() allowClear = true;

  clear(closePanel = false) {
    this.value = null;
    this.searchTerm = '';
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    if (closePanel) this.close();
    this.cdr.markForCheck();
  }

  selectAt(idx: number) {
    const it = this.filteredItems[idx];
    if (!it) return;
    this.value = it.value;
    this.searchTerm = it.label;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    this.close();
  }

  onTriggerKeydown(e: KeyboardEvent, triggerEl: HTMLElement) {
    if (this.disabledSelected) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        e.preventDefault();
        this.open(triggerEl);
        break;
    }
  }

  onPanelKeydown(e: KeyboardEvent) {
    if (!this.isOpen) return;
    const max = this.filteredItems.length - 1;

    if (e.key === 'Escape') { this.close(); return; }
    if (e.key === 'Enter') { this.selectAt(this.activeIndex); return; }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex = Math.min(max, this.activeIndex + 1);
      this.scrollActiveIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex = Math.max(0, this.activeIndex - 1);
      this.scrollActiveIntoView();
    }
  }

  onSearchInput(ev: Event) {
    this.searchTerm = (ev.target as HTMLInputElement).value || '';
    const len = this.filteredItems.length;
    if (len === 0) this.activeIndex = -1;
    else if (this.activeIndex < 0 || this.activeIndex >= len) this.activeIndex = 0;
    this.cdr.markForCheck();
  }

  // เรียกเมื่อคลิกที่ input
  onInputClick(triggerEl: HTMLElement) {
    // if (!this.isOpen && !this.disabledSelected) {
    //   this.open(triggerEl);
    // }

    if (this.disabledSelected) return;
    this.searchTerm = '';
    if (!this.isOpen) this.open(triggerEl);
  }

  // เรียกเมื่อ input ได้โฟกัส (เช่น tab เข้ามา)
  // onInputFocus(triggerEl: HTMLElement) {
  //   if (!this.isOpen && !this.disabledSelected) {
  //     this.open(triggerEl);
  //   }
  // }

  onInputFocus() {
    // ให้เป็นว่างเสมอ เพื่อให้ placeholder แสดง และไม่กาง
    this.searchTerm = '';
    this.cdr.markForCheck();
  }

  // กดคีย์บน input: เปิดด้วย ArrowDown/Enter
  onInputKeydown(e: KeyboardEvent, triggerEl: HTMLElement) {
    if (this.disabledSelected) return;
    if (!this.isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      this.open(triggerEl);
    }
  }

  private scrollActiveIntoView() {
    const panel = this._overlayEl?.querySelector('.dd-menu') as HTMLElement | null;
    const active = panel?.querySelector<HTMLElement>('[data-active="true"]');
    if (panel && active) {
      const aTop = active.offsetTop;
      const aBot = aTop + active.offsetHeight;
      if (aTop < panel.scrollTop) panel.scrollTop = aTop;
      else if (aBot > panel.scrollTop + panel.clientHeight) panel.scrollTop = aBot - panel.clientHeight;
    }
  }

  isEqual(a: any, b: any) {
    // ให้ null/undefined ถือว่าเท่ากัน (ยังไม่เลือก)
    if (a == null && b == null) return true;
    return String(a) === String(b);
  }
}
