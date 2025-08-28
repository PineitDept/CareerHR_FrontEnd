import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef,
  ViewChild, TemplateRef, ViewContainerRef, forwardRef,
  HostListener
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
  @Input() options: Opt[] = [];
  @Input() placeholder = 'Select';
  @Input() panelMaxHeight = 240;

  // ❗อย่า bind [value] จากข้างนอกเมื่อใช้ formControlName
  value: any = null;
  disabledSelected = false;

  @Output() valueChange = new EventEmitter<any>();

  @ViewChild('panel', { static: true }) panelTpl!: TemplateRef<any>;

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

  @HostListener('window:resize')
  onWindowResize() {
    if (this.isOpen && this.overlayRef && this._triggerEl) {
      const w = this._triggerEl.getBoundingClientRect().width;
      this.overlayRef.updateSize({ width: w });
      this.overlayRef.updatePosition();
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
    this.value = obj;
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
    return this.options.map(o => typeof o === 'string' ? { label: o, value: o } : o);
  }

  get display(): string {
    const f = this.items.find(i => this.isEqual(i.value, this.value));
    return f ? String(f.label) : this.placeholder;
  }

  open(triggerEl: HTMLElement) {
    if (this.disabledSelected || this.isOpen) return;
    const w = triggerEl.getBoundingClientRect().width;
    this.positionStrategy = this.overlay.position()
      .flexibleConnectedTo(triggerEl)
      .withPositions(this.positions)
      .withFlexibleDimensions(false)
      .withPush(true)
      .withViewportMargin(8);

    // this.overlayRef = this.overlay.create({
    //   positionStrategy: this.positionStrategy,
    //   hasBackdrop: true,
    //   backdropClass: 'cdk-overlay-transparent-backdrop',
    //   // scrollStrategy: this.overlay.scrollStrategies.reposition(),
    //   width: w, // ✅ เท่าปุ่มตั้งแต่แรก
    // });

    this.overlayRef = this.overlay.create({
      positionStrategy: this.positionStrategy,
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      scrollStrategy: this.sso.reposition(),
      panelClass: 'tw-block',
    });

    const portal = new TemplatePortal(this.panelTpl, this.vcr);
    this.overlayRef.attach(portal);

    // ✅ sync ขนาดหลัง attach (ให้แน่ใจว่า layout เสร็จ)
    const sync = () => {
      const w = triggerEl.getBoundingClientRect().width;
      this.overlayRef!.updateSize({ width: w });   // หรือ { minWidth: w } ถ้าอยากให้ขยายได้
      this.overlayRef!.updatePosition();
    };
    // ทำทันที 1 ครั้ง + ถัดไปด้วย microtask เผื่อ style เพิ่งวิ่งเข้า
    sync();
    Promise.resolve().then(sync);

    // ✅ ติดตามการเปลี่ยนแปลงความกว้างปุ่มแบบเรียลไทม์
    this.ro = new ResizeObserver(sync);
    this.ro.observe(triggerEl);

    this.overlayRef.backdropClick().subscribe(() => this.close());
    this.overlayRef.detachments().subscribe(() => this.close());

    this.activeIndex = Math.max(0, this.items.findIndex(i => this.isEqual(i.value, this.value)));
    this.isOpen = true;
    this._triggerEl = triggerEl;
    this.cdr.markForCheck();
  }

  close() {
    if (!this.isOpen) return;
    this.ro?.disconnect();
    this.ro = undefined;
    this.overlayRef?.detach();
    this.isOpen = false;
    this.activeIndex = -1;
    this.onTouched();
    this.cdr.markForCheck();
  }

  selectAt(idx: number) {
    const it = this.items[idx];
    if (!it) return;
    this.value = it.value;

    // แจ้งทั้ง FormControl และ output เผื่อคนอยากฟัง event
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
    const max = this.items.length - 1;

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

  private scrollActiveIntoView() {
    const panel = document.querySelector('.cdk-dropdown-panel .dd-menu') as HTMLElement | null;
    const active = panel?.querySelector<HTMLElement>('[data-active="true"]');
    if (panel && active) {
      const aTop = active.offsetTop;
      const aBot = aTop + active.offsetHeight;
      if (aTop < panel.scrollTop) panel.scrollTop = aTop;
      else if (aBot > panel.scrollTop + panel.clientHeight) panel.scrollTop = aBot - panel.clientHeight;
    }
  }

  isEqual(a: any, b: any) { return String(a) === String(b); }
}
