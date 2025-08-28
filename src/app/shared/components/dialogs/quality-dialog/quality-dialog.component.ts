import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AlertDialogData } from '../../../interfaces/dialog/dialog.interface';

@Component({
  selector: 'app-quality-dialog',
  templateUrl: './quality-dialog.component.html',
  styleUrl: './quality-dialog.component.scss'
})
export class QualityDialogComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<QualityDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AlertDialogData
  ) {

    console.log(data.quality, '=>data.quality')
    this.form = this.fb.group({
      qualityDialog: [data.quality ?? 0]
    });
  }

  increase() {
    const value = this.form.get('qualityDialog')?.value || 0;
    this.form.patchValue({ qualityDialog: value + 1 });
  }

  decrease() {
    const value = this.form.get('qualityDialog')?.value || 0;
    this.form.patchValue({ qualityDialog: value > 0 ? value - 1 : 0 });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(this.form.value.qualityDialog);
  }
}
