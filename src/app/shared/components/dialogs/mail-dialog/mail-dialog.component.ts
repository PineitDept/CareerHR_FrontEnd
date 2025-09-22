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

  modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ color: [] }, { background: [] }],
      [{ align: [] }],
      ['link'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['image']
    ],
    imageResize: {}
  };

  formats = [
    'header', 'bold', 'italic', 'underline',
    'align', 'list', 'link', 'image',
    'color', 'background', 'font', 'size'
  ];

  @Input() dataOption: any[] | undefined;
  @Output() dataResult: any[] | undefined;

  @Input() dropdownConfigs: any[] | undefined;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<MailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AlertDialogData
  ) {
    this.emailForm = this.fb.group({
      from: [data.dataMail.formMail, [Validators.required, Validators.email]],
      to: [data.dataMail.to, [Validators.required, Validators.email]],
      subject: [data.dataMail.subject, Validators.required],
      message: [data.dataMail.body, Validators.required],
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

    const EmailMessage = this.emailForm.value.message;
    const formData = new FormData();

    formData.append('from', this.emailForm.value.from);
    formData.append('to', this.emailForm.value.to);
    formData.append('subject', this.emailForm.value.subject);
    formData.append('message', EmailMessage);

    this.selectedFiles.forEach((file) => {
      formData.append('attachments', file);
    });

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