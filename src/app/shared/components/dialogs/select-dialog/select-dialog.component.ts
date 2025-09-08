import { Component, Inject, Input, Output } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AlertDialogData } from '../../../interfaces/dialog/dialog.interface';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select-dialog',
  templateUrl: './select-dialog.component.html',
  styleUrl: './select-dialog.component.scss'
})
export class SelectDialogComponent {
  form: FormGroup;
  titleHeader: string | undefined;
  selectedValues: string[] = [];

  @Input() dataOption: any[] | undefined;
  @Output() dataResult: any[] | undefined;

  @Input() dropdownConfigs: any[] | undefined;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<SelectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AlertDialogData
  ) {
    this.form = this.fb.group({
      position: [null],
      history: [[]]
    });

    this.titleHeader = data.title

    this.dataOption = data.options

    this.dropdownConfigs = data.dropdownConfigs
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    const selectedValues = this.dataResult?.map(item => item.value);
    this.dialogRef.close(selectedValues);
  }

  onSelectionChange(selectedOptions: SelectOption[]) {
    this.dataResult = selectedOptions
  }
}
