import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
}

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
  @Input() defaultSelected: string[] = [];
  @Input() isHistory: boolean = false;
  @Input() inTable:  boolean = false;

  @Output() selectionChange = new EventEmitter<SelectOption[]>();

  @ViewChild('triggerEl') triggerElRef!: ElementRef<HTMLElement>;

  selectedOptions: SelectOption[] = [];
  searchTerm: string = '';
  isOpen: boolean = false;
  highlightedIndex: number = -1;
  dropdownStyles: Record<string, string> = {};

  private onChange = (value: any) => { };
  private onTouched = () => { };

  constructor(private elementRef: ElementRef) { }

  ngOnChanges(): void {
    if (this.defaultSelected?.length && this.options?.length) {
      this.selectedOptions = this.options.filter(option =>
        this.defaultSelected.includes(option.value)
      );
    }
  }

  // ControlValueAccessor implementation
  writeValue(value: string[] | null): void {
    if (value && Array.isArray(value)) {
      this.selectedOptions = this.options.filter(option =>
        value.includes(option.value)
      );
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

    const triggerEl = this.triggerElRef?.nativeElement;
    if (triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      this.dropdownStyles = {
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      };
    }

    this.isOpen = true;
    this.highlightedIndex = -1;
  }

  closeDropdown(): void {
    this.isOpen = false;
    this.dropdownStyles = {};
    this.highlightedIndex = -1;
    this.onTouched();
  }

  toggleDropdown(): void {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
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

  updateDropdownPosition(): void {
    const triggerEl = this.triggerElRef?.nativeElement;
    if (triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      this.dropdownStyles = {
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      };
    }
  }

  isSelected(option: SelectOption): boolean {
    return this.selectedOptions.some(selected => selected.value === option.value);
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

  trackByValue(index: number, option: SelectOption): string {
    return option.value;
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }
}