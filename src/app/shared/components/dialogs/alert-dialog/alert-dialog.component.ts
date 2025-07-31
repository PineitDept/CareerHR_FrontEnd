import {
  Component,
  ElementRef,
  HostListener,
  Inject,
  ViewChild,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AlertDialogData } from '../../../interfaces/dialog/dialog.interface';

@Component({
  selector: 'app-alert-dialog',
  templateUrl: './alert-dialog.component.html', 
  styleUrl: './alert-dialog.component.scss',
})
export class AlertDialogComponent {
  selectedPOType: string | null = null;
  isDropdownOpenPO: boolean = false;

  dropdownTop: number = 0;
  dropdownLeft: number = 0;
  dropdownWidth: number = 0;

  @ViewChild('poDropdownButton', { static: false })
  poDropdownButton!: ElementRef;
  @ViewChild('poDropdownContainer', { static: false })
  poDropdownContainer!: ElementRef;

  constructor(
    private dialogRef: MatDialogRef<AlertDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AlertDialogData
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    const result = this.data.confirm
      ? this.data.poType
        ? { selectedRows: this.data.selectedRows, poType: this.selectedPOType }
        : { selectedRows: this.data.selectedRows }
      : true;

    this.dialogRef.close(result);
  }

  toggleDropdown(type: 'po') {
    if (type === 'po') {
      this.isDropdownOpenPO = !this.isDropdownOpenPO;

      if (this.isDropdownOpenPO && this.poDropdownButton) {
        const rect =
          this.poDropdownButton.nativeElement.getBoundingClientRect();
        this.dropdownTop = rect.bottom + window.scrollY;
        this.dropdownLeft = rect.left + window.scrollX;
        this.dropdownWidth = rect.width;
      }
    }
  }

  selectOption(type: 'po', value: string) {
    if (type === 'po') {
      this.selectedPOType = value;
      this.isDropdownOpenPO = false;
    }
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent) {
    const clickedInside =
      this.poDropdownButton?.nativeElement.contains(event.target) ||
      this.poDropdownContainer?.nativeElement.contains(event.target);

    if (!clickedInside && this.isDropdownOpenPO) {
      this.isDropdownOpenPO = false;
    }
  }
}
