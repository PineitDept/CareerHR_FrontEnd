import { Overlay, OverlayRef, OverlayConfig, ConnectedPosition, FlexibleConnectedPositionStrategy, ScrollStrategyOptions } from '@angular/cdk/overlay';
import { Component, ElementRef, EventEmitter, HostListener, Input, Output, SimpleChanges, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { ControlValueAccessor } from '@angular/forms';
import { TemplatePortal } from '@angular/cdk/portal';

export interface SelectOption { value: string | number; label: string; }

@Component({
  selector: 'app-multi-select-dropdown',
  templateUrl: './multi-select-dropdown.component.html',
  styleUrl: './multi-select-dropdown.component.scss'
})
export class MultiSelectDropdownComponent implements ControlValueAccessor {
  @Input() options: any[] = [];
  @Input() placeholder: string = 'Select options';
  @Input() label?: string;
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;
  @Input() defaultSelected: Array<string | number> = [];
  @Input() isHistory: boolean = false;
  @Input() inTable: boolean = false;

  @Output() selectionChange = new EventEmitter<SelectOption[]>();

  @ViewChild('triggerEl') triggerElRef!: ElementRef<HTMLElement>;
  @ViewChild('dropdownTpl', { static: true }) dropdownTpl!: TemplateRef<any>;

  selectedOptions: SelectOption[] = [];
  searchTerm: string = '';
  isOpen: boolean = false;
  highlightedIndex: number = -1;
  dropdownStyles: Record<string, string> = {};

  private onChange = (value: any) => { };
  private onTouched = () => { };
  private overlayRef: OverlayRef | null = null;
  private positionStrategy!: FlexibleConnectedPositionStrategy;
  overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
  ];

  private eq(a: string | number, b: string | number) { return String(a) === String(b); }

  constructor(
    private elementRef: ElementRef,
    private overlay: Overlay,
    private vcr: ViewContainerRef,
    private sso: ScrollStrategyOptions,
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.defaultSelected && this.options?.length) {
      const next = new Set((this.defaultSelected || []).map(String));
      const curr = new Set(this.selectedOptions.map(o => String(o.value)));

      const same =
        next.size === curr.size && [...next].every(v => curr.has(v));

      if (!same) {
        this.selectedOptions = this.options.filter(o => next.has(String(o.value)));
      }
    }
  }

  // writeValue ก็รองรับ number/string
  writeValue(value: Array<string | number> | null): void {
    if (Array.isArray(value)) {
      const vals = value.map(String);
      this.selectedOptions = this.options.filter(opt => vals.includes(String(opt.value)));
    } else {
      this.selectedOptions = [];
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // Dropdown functionality
  get filteredOptions(): SelectOption[] {
    if (!this.searchTerm) {
      return this.options;
    }

    return this.options.filter(option =>
      option.label.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  openDropdown(): void {
    if (this.disabled) return;

    const origin = this.triggerElRef?.nativeElement;
    if (!origin) return;

    if (!this.overlayRef) {
      this.positionStrategy = this.overlay.position()
        .flexibleConnectedTo(origin)
        .withPositions(this.overlayPositions)
        .withFlexibleDimensions(false)
        .withPush(true)
        .withViewportMargin(8);

      this.overlayRef = this.overlay.create({
        positionStrategy: this.positionStrategy,
        hasBackdrop: true,
        backdropClass: 'cdk-overlay-transparent-backdrop',
        scrollStrategy: this.sso.reposition(), // auto-reposition on scroll
        panelClass: 'tw-z-[9999]',
        width: origin.getBoundingClientRect().width, // ให้ความกว้างเท่ากับ trigger
      });

      this.overlayRef.backdropClick().subscribe(() => this.closeDropdown());
      this.overlayRef.detachments().subscribe(() => this.isOpen = false);
    } else {
      this.positionStrategy.setOrigin(origin);
      this.overlayRef.updatePosition();
    }

    if (!this.overlayRef.hasAttached()) {
      const portal = new TemplatePortal(this.dropdownTpl, this.vcr);
      this.overlayRef.attach(portal);
    }

    this.isOpen = true;
    this.highlightedIndex = -1;
  }

  closeDropdown(): void {
    this.isOpen = false;
    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.onTouched();
  }

  toggleDropdown(): void {
    this.isOpen ? this.closeDropdown() : this.openDropdown();
  }

  toggleOption(option: SelectOption): void {
    if (this.isSelected(option)) {
      this.removeOption(option);
    } else {
      this.addOption(option);
    }
  }

  addOption(option: SelectOption): void {
    if (!this.isSelected(option)) {
      this.selectedOptions = [...this.selectedOptions, option];
      this.emitChange();
      this.updateDropdownPosition();
    }
  }

  removeOption(option: SelectOption): void {
    this.selectedOptions = this.selectedOptions.filter(
      selected => selected.value !== option.value
    );
    this.emitChange();
    this.updateDropdownPosition();
  }

  // updateDropdownPosition(): void {
  //   const triggerEl = this.triggerElRef?.nativeElement;
  //   if (triggerEl) {
  //     const rect = triggerEl.getBoundingClientRect();
  //     this.dropdownStyles = {
  //       top: `${rect.bottom + 8}px`,
  //       left: `${rect.left}px`,
  //       width: `${rect.width}px`,
  //     };
  //   }
  // }

  private updateDropdownPosition(): void {
    this.overlayRef?.updatePosition();
  }

  isSelected(option: SelectOption): boolean {
    return this.selectedOptions.some(s => this.eq(s.value, option.value));
  }

  onSearchChange(): void {
    this.highlightedIndex = -1;
    if (!this.isOpen) {
      this.openDropdown();
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.navigateOptions(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.navigateOptions(-1);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredOptions.length) {
          this.toggleOption(this.filteredOptions[this.highlightedIndex]);
        }
        break;
      case 'Escape':
        this.closeDropdown();
        break;
    }
  }

  private navigateOptions(direction: number): void {
    if (!this.isOpen) {
      this.openDropdown();
      return;
    }

    const maxIndex = this.filteredOptions.length - 1;

    if (direction > 0) {
      this.highlightedIndex = this.highlightedIndex < maxIndex ? this.highlightedIndex + 1 : 0;
    } else {
      this.highlightedIndex = this.highlightedIndex > 0 ? this.highlightedIndex - 1 : maxIndex;
    }
  }

  private emitChange(): void {
    const values = this.selectedOptions.map(option => option.value);
    this.onChange(values);
    this.selectionChange.emit([...this.selectedOptions]);
  }

  getPlaceholder(): string {
    return this.selectedOptions.length === 0 ? this.placeholder : '';
  }

  highlightSearchTerm(text: string): string {
    if (!this.searchTerm) {
      return text;
    }

    const regex = new RegExp(`(${this.searchTerm})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  }

  trackByValue(index: number, option: SelectOption): string | number {
    return option.value;
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as Node;

    // ถ้าคลิกภายในแผง overlay ของตัวเอง -> อย่าปิด
    if (this.overlayRef?.hasAttached() && this.overlayRef.overlayElement.contains(target)) {
      return;
    }

    // ถ้าคลิกอยู่นอกคอมโพเนนต์ และอยู่นอก overlay -> ปิด
    if (!this.elementRef.nativeElement.contains(target)) {
      this.closeDropdown();
    }
  }

}