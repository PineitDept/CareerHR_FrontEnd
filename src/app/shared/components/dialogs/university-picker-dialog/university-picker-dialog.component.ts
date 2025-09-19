import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConnectedPosition } from '@angular/cdk/overlay';

type DialogData = { universities: string[] };

@Component({
  selector: 'app-university-picker-dialog',
  templateUrl: './university-picker-dialog.component.html',
  styleUrl: './university-picker-dialog.component.scss'
})
export class UniversityPickerDialogComponent {

  universities: string[] = [];
  isOpen = false;
  activeIndex = 0;
  selected: string | null = null;
  overlayWidth = 260;

  overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top',    overlayX: 'start', overlayY: 'bottom' },
  ];

  @ViewChild('uniBtn') uniBtn!: ElementRef<HTMLButtonElement>;

  constructor(
    @Inject(MAT_DIALOG_DATA) data: DialogData,
    private dialogRef: MatDialogRef<UniversityPickerDialogComponent>,
  ) {
    this.universities = (data?.universities ?? []).slice();
  }

  // overlay controls
  toggleOverlay() { this.isOpen ? this.closeOverlay() : this.openOverlay(); }
  openOverlay()  { this.updateOverlayWidth(); this.isOpen = true; }
  closeOverlay() { this.isOpen = false; }

  private updateOverlayWidth() {
    try {
      const el = this.uniBtn?.nativeElement;
      const rect = el?.getBoundingClientRect?.();
      const w = Math.round(rect?.width ?? el?.offsetWidth ?? 260);
      this.overlayWidth = Math.max(240, w);
    } catch { this.overlayWidth = 260; }
  }

  moveActive(delta: number) {
    if (!this.isOpen) this.openOverlay();
    const max = this.universities.length - 1;
    this.activeIndex = Math.max(0, Math.min(max, this.activeIndex + delta));
  }

  confirmActive() {
    const v = this.universities[this.activeIndex];
    if (v) { this.selected = v; this.closeOverlay(); }
  }

  onMouseDownSelect(v: string, ev: MouseEvent) {
    ev.preventDefault();
    this.selected = v;
    this.closeOverlay();
  }

  onCancel() { this.dialogRef.close(null); }
  onConfirm() { this.dialogRef.close(this.selected); }
}
