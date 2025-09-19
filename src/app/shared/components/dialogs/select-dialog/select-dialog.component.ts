import { Component, Inject, Input, Output } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AlertDialogData } from '../../../interfaces/dialog/dialog.interface';

export interface SelectOption {
  value: string | number;
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
  singleSelectedValue: SelectOption | null = null;
  selectionMap: Record<string, any> = {};
  callMissed = false;
  statusValue: string | number | undefined;
  missCallCount = 0;
  lenOptions = 0;
  isNoShow: boolean = false;

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
    this.dropdownConfigs = data.dropdownConfigs

    this.dropdownConfigs?.forEach(config => {
      if (config.dynamicByToggle) {
        if (!this.callMissed) {
          config.options = config.optionsSecond
        } else {
          config.options = config.optionsFirst
        }
      }

      if (config.missCallCount) {
        this.missCallCount = config.missCallCount;
      }

      if (config.label === 'History') {
        this.lenOptions = config.options.length
      }
    });

    // this.missCallCount = data.dropdownConfigs?.find(c => c.missCallCount !== undefined)?.missCallCount || 0;

  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close({
      selectionMap: this.selectionMap,
      isNoShow: this.isNoShow
    });
  }


  onSelectionChange(selectedOptions: SelectOption[]) {
    this.dataResult = selectedOptions

    console.log(this.dataResult, '=>dataResult')
  }

  onSingleSelectChange(selectedValue: string | number, label: string, options: SelectOption[]) {
    const matched = options.find(o => o.value === selectedValue);
    this.selectionMap[label] = matched ?? { value: selectedValue, label: '' };

    this.statusValue = selectedValue;
  }

  onMultiSelectChange(selectedValues: SelectOption[], label: string) {
    this.selectionMap[label] = selectedValues;
  }

  toggleCheck(type: 'answered' | 'missed', event: Event) {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;

    this.callMissed = type === 'missed' ? input.checked : !input.checked;

    this.dropdownConfigs?.forEach(config => {
      if (config.dynamicByToggle) {
        if (!this.callMissed) {
          config.options = config.optionsSecond
        } else {
          config.options = config.optionsFirst
        }
      }
    });
  }

  toggleCheckNoshow(event: Event) {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    if (this.callMissed) {
      this.isNoShow = input.checked;
    } else {
      this.isNoShow = !input.checked;
    }
  }
}
