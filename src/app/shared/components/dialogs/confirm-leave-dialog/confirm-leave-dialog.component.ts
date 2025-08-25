import { Component, HostListener, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export type ConfirmLeaveDialogResult = 'stay' | 'keep' | 'discard';

export interface ConfirmLeaveDialogData {
  title?: string;
  message?: string;
}

@Component({
  selector: 'app-confirm-leave-dialog',
  templateUrl: './confirm-leave-dialog.component.html',
  styleUrl: './confirm-leave-dialog.component.scss'
})
export class ConfirmLeaveDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ConfirmLeaveDialogComponent, ConfirmLeaveDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmLeaveDialogData
  ) {}

  onStay(): void {
    this.dialogRef.close('stay');
  }

  onKeep(): void {
    this.dialogRef.close('keep');
  }

  onDiscard(): void {
    this.dialogRef.close('discard');
  }

  // ให้ปุ่ม Esc เทียบเท่า Stay (ยกเลิกการนำทาง)
  @HostListener('document:keydown.escape')
  onEsc() {
    this.onStay();
  }
}
