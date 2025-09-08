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
      case 'Unmatch': return 'Unmatch';
      case 'activeStatus': return 'Status';
      case 'categoryName':
      case 'CategoryName': return 'Category Name';

      // ===== ป้ายเหตุผลแบบใหม่ =====
      case 'New Reason': return 'New Reason';
      case 'Edit Reason': return 'Edit Reason';
      case 'Delete Reason': return 'Delete Reason';

      // (ของเดิมที่ใช้ในหน้าก่อน ๆ — คงไว้เพื่อ backward compatibility)
      case 'NEW': return 'New Row';
      case 'DELETE': return 'Delete Row';
      case 'reasonText': return 'Reason';
      case '__index': return 'Order';
      case 'questionTH': return 'Question (TH)';
      case 'questionEN': return 'Question (EN)';
      case 'scoringMethod': return 'Scoring Method';
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
