import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmChangesData } from '../../../interfaces/dialog/dialog.interface';

@Component({
  selector: 'app-confirm-changes-dialog',
  templateUrl: './confirm-changes-dialog.component.html',
  styleUrl: './confirm-changes-dialog.component.scss'
})
export class ConfirmChangesDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ConfirmChangesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmChangesData
  ) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }
  onConfirm(): void {
    this.dialogRef.close(true);
  }

  prettyField(field: string): string {
    switch (field) {
      case 'CREATE': return 'Create';
      case 'NEW': return 'New Row';
      case '__index': return 'Order';
      case 'questionTH': return 'Question (TH)';
      case 'questionEN': return 'Question (EN)';
      case 'activeStatus': return 'Status';
      case 'scoringMethod': return 'Scoring Method';
      case 'CategoryName':
      case 'categoryName': return 'Category Name';
      default: return field;
    }
  }

  prettyValue(field: string, v: any): string {
    if (field === 'activeStatus') return v ? 'Active' : 'Inactive';
    if (field === 'scoringMethod') {
      if (v === 1 || String(v) === '1') return 'Normal';
      if (v === 2 || String(v) === '2') return 'Reverse';
    }
    if (field === '__index') return String(v ?? '');
    return (v === undefined || v === null || v === '') ? '-' : String(v);
  }
}
