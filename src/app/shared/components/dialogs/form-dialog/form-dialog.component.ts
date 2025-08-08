import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormDialogData } from '../../../interfaces/dialog/dialog.interface';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';

@Component({
  selector: 'app-form-dialog',
  templateUrl: './form-dialog.component.html',
  styleUrls: ['./form-dialog.component.scss']
})
export class FormDialogComponent implements OnInit {
  inputForm!: FormGroup;
  passwordVisibleMap: Record<number, boolean> = {};
  enablePasswordFields = false;

  constructor(
    private dialogRef: MatDialogRef<FormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FormDialogData,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    const controls = (this.data.valInput || []).map((val, i) => {
      const label = this.data.labelInput?.[i]?.toLowerCase() || '';
      const isPasswordField = label.includes('password') || label.includes('confirm');
      const control = this.fb.control(val || '', Validators.required);
      if (this.data.isEditMode && isPasswordField && !this.enablePasswordFields) control.disable();
      return control;
    });

    this.inputForm = this.fb.group(
      { inputs: this.fb.array(controls) },
      { validators: this.passwordsMatchValidator.bind(this) }
    );
  }

  get inputControls(): FormArray {
    return this.inputForm.get('inputs') as FormArray;
  }

  isInvalid(i: number): boolean {
    const control = this.inputControls.at(i);
    return control.invalid && (control.dirty || control.touched);
  }

  isPasswordVisible(i: number): boolean {
    return !!this.passwordVisibleMap[i];
  }

  togglePasswordVisibility(i: number): void {
    if (!this.inputControls.at(i).disabled) {
      this.passwordVisibleMap[i] = !this.passwordVisibleMap[i];
    }
  }

  getInputType(i: number, label: string): string {
    return !this.isPasswordVisible(i) && label.toLowerCase().includes('password') ? 'password' : 'text';
  }

  getInputClass(i: number): Record<string, boolean> {
    return {
      'tw-border-red-600 focus:tw-ring-red-500': this.isInvalid(i),
      'tw-border-[#ADB5BD] focus:tw-border-[#00AAFF]': !this.isInvalid(i)
    };
  }

  isDisabled(i: number, label: string): boolean {
    return !!this.data.isEditMode &&
      (label.toLowerCase().includes('password') || label.toLowerCase().includes('confirm')) &&
      !this.enablePasswordFields;
  }

  isRequired(i: number): boolean {
    return this.inputControls.at(i)?.hasValidator?.(Validators.required) ?? true;
  }

  shouldShowResetPassword(label: string): boolean {
    return label.toLowerCase().includes('username') && !!this.data.isEditMode;
  }

  onResetPassword(): void {
    this.enablePasswordFields = true;
    this.data.labelInput?.forEach((label, i) => {
      const lower = label.toLowerCase();
      if (lower.includes('password') || lower.includes('confirm')) {
        this.inputControls.at(i)?.enable();
      }
    });
  }

  onConfirm(): void {
    if (this.inputForm.invalid) {
      this.inputControls.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.inputControls.value);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  passwordsMatchValidator(form: FormGroup): null | object {
    const inputs = form.get('inputs') as FormArray;
    const labels = this.data.labelInput || [];

    const passwordIndex = labels.findIndex(lbl => lbl.toLowerCase().includes('password') && !lbl.toLowerCase().includes('confirm'));
    const confirmIndex = labels.findIndex(lbl => lbl.toLowerCase().includes('confirm'));

    if (passwordIndex === -1 || confirmIndex === -1) return null;

    const password = inputs.at(passwordIndex)?.value;
    const confirm = inputs.at(confirmIndex)?.value;

    if (!confirm) return null;

    if (password !== confirm) {
      inputs.at(confirmIndex)?.setErrors({ ...inputs.at(confirmIndex)?.errors, notMatch: true });
      return { notMatch: true };
    } else {
      const errors = inputs.at(confirmIndex)?.errors || {};
      delete errors['notMatch'];
      inputs.at(confirmIndex)?.setErrors(Object.keys(errors).length ? errors : null);
      return null;
    }
  }
  
  isPasswordField(index: number): boolean {
    const label = this.data.labelInput?.[index]?.toLowerCase() || '';
    return label === 'password' || label === 'confirm password';
  }

}

