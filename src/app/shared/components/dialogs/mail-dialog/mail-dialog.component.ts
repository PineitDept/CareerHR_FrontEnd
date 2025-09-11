import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Component, Inject, Input, Output } from '@angular/core';
import { AlertDialogData } from '../../../interfaces/dialog/dialog.interface';

export interface SelectOption {
  value: string | number;
  label: string;
}
@Component({
  selector: 'app-mail-dialog',
  templateUrl: './mail-dialog.component.html',
  styleUrl: './mail-dialog.component.scss'
})
export class MailDialogComponent {
  emailForm: FormGroup;
  titleHeader: string | undefined;
  selectedValues: string[] = [];
  singleSelectedValue: SelectOption | null = null;
  selectionMap: Record<string, any> = {};
  selectedFiles: File[] = [];

  @Input() dataOption: any[] | undefined;
  @Output() dataResult: any[] | undefined;

  @Input() dropdownConfigs: any[] | undefined;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<MailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AlertDialogData
  ) {
    this.emailForm = this.fb.group({
      from: ['', [Validators.required, Validators.email]],
      to: ['', [Validators.required, Validators.email]],
      subject: ['', Validators.required],
      message: ['', Validators.required],
    });

    this.titleHeader = data.title

    this.dropdownConfigs = data.dropdownConfigs
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    formData.append('from', this.emailForm.value.from);
    formData.append('to', this.emailForm.value.to);
    formData.append('subject', this.emailForm.value.subject);
    formData.append('message', this.emailForm.value.message);

    this.selectedFiles.forEach((file) => {
      formData.append('attachments', file); 
    });

    console.log(this.selectedFiles);

    // ✅ ส่งค่ากลับ
    this.dialogRef.close({
      selectionMap: this.selectionMap,
      formData: formData
    });
  }


  onSelectionChange(selectedOptions: SelectOption[]) {
    this.dataResult = selectedOptions
  }

  onSingleSelectChange(selectedValue: string | number, label: string, options: SelectOption[]) {
    const matched = options.find(o => o.value === selectedValue);
    this.selectionMap[label] = matched ?? { value: selectedValue, label: '' };
  }

  onMultiSelectChange(selectedValues: SelectOption[], label: string) {
    this.selectionMap[label] = selectedValues;
  }

  onFilesSelected(event: Event, fileInput: HTMLInputElement): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const filesArray = Array.from(input.files);
      filesArray.forEach(file => {
        const alreadyExists = this.selectedFiles.some(f =>
          f.name === file.name && f.size === file.size && f.type === file.type
        );

        if (!alreadyExists) {
          this.selectedFiles.push(file);
        }
      });
      fileInput.value = '';
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }
}