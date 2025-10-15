import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { defaultColumns, defaultFilterButtonsDetails } from '../../../../../../../../../../app/constants/admin-setting/email-template.constants';
import { EmailTemplateService } from '../../../../../../../../../../app/services/admin-setting/email-template/email-template.service';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { Columns } from '../../../../../../../../../shared/interfaces/tables/column.interface';
import { AlertDialogComponent } from '../../../../../../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { TablesComponent } from '../../../../../../../../../shared/components/tables/tables.component';
import { CaptchaDialogComponent } from '../../../../../../../../../shared/components/dialogs/captcha-dialog/captcha-dialog.component';
import { forkJoin } from 'rxjs';

type CategoryForm = {
  categoryId: number | string | null;
  categoryName: string;
  activeStatus: boolean;
};

type CategoryDetailForm = {
  id: number | string | null;
  subject: string;
  message: string;
  activeStatus: boolean;
};

@Component({
  selector: 'app-email-attribute-details',
  templateUrl: './email-attribute-details.component.html',
  styleUrl: './email-attribute-details.component.scss'
})
export class EmailAttributeDetailsComponent {
  @ViewChild('categoryTable') categoryTable!: TablesComponent;

  isEditing = false;
  private initialSnapshot: any = null;

  formDetails!: FormGroup;
  columns = defaultColumns();
  filterButtons = defaultFilterButtonsDetails();
  // categoryColumns =  defaultFilterButtonsDetails();
  disabledKeys: string[] = [];

  AttrID: string = '';
  EmailType: string = '';
  EmailSubject: string = '';
  questionSet: any[] = [];

  categoryRows: any[] = [];
  categoryDetailsRows: any[] = [];

  isEnabledCardDetails = false;

  isViewMode = false;
  isAddMode = false;
  isEditMode = false;
  isEditDetails = false;

  isAddingRow = false;
  fieldErrors = false;
  duplicateRowIndex: number | null = null;

  categoryColumns: Columns = [
    {
      header: 'No.',
      field: '__index',
      type: 'number',
      align: 'center',
      width: '4%'
    },
    {
      header: 'ID',
      field: 'subject',
      type: 'text',
      editing: false,
      width: '15%',
      wrapText: true,
    },
    {
      header: 'Description',
      field: 'message',
      type: 'text',
      width: '32%',
      wrapText: true,
    },
    {
      header: 'Action',
      field: 'textlink',
      type: 'textlink',
      align: 'center',
      width: '12%',
      textlinkActions: ['edit-inrow']
    }
  ];

  constructor(
    private emailTemplateService: EmailTemplateService,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.emailTemplateService.setEMailType('email-attribute');

    this.initializeForm();

    this.route.queryParams.subscribe(params => {
      this.EmailType = params['id'] || '';
      this.fetchEmailIDsDetails();
    });

    this.formDetails.disable({ emitEvent: false });
    // this.setActionButtons('view');
    this.setActionButtons('edit');
    this.isEditing = true
    this.formDetails.valueChanges.subscribe(() => {
      if (!this.isEditing) return;
      this.setButtonDisabled('save', !this.hasFormChanged());
    });
  }

  initializeForm() {
    this.formDetails = this.fb.group({
      subject: [''],
      activeStatus: [true],
      emailContent: new FormControl('')
    });
  }

  toggleActive(): void {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      width: '640px',
      panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
      autoFocus: false,
      disableClose: true,
      data: {
        title: 'Please contact the Human Resources Department',
        message: `For change the status of this category type, please contact our Human Resources Department for assistance.`,
        confirm: false
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');
    });
  }

  onAddClicked() {
    console.log('Add Category clicked');
  }

  onAddQuestionClicked() {
    console.log('Add button clicked');
    this.isAddingRow = true;
    this.categoryTable.startInlineCreate({ activeStatus: false, status: 0 }, 'bottom');
  }

  fetchEmailIDsDetails() {
    this.emailTemplateService.getAllEmailTemplates().subscribe({
      next: (response) => {
        this.categoryRows = [];
        response.forEach((item: { id: any, message: any, subject: any; }) => {
          const newRow = {
            id: item.id,
            subject: item.subject,
            message: item.message
          };

          if (!item.message.includes('http') && this.EmailType.toLowerCase() === 'location') {
            this.categoryRows.push(newRow);
          } else if (item.message.includes('http') && this.EmailType.toLowerCase() !== 'location') {
            this.categoryRows.push(newRow);
          }
        });

        this.cdr.detectChanges();

        this.formDetails.patchValue({ subject: this.EmailType }, { emitEvent: false });
        this.initialSnapshot = {
          // ...this.formDetails.getRawValue(),
          categoryRows: JSON.parse(JSON.stringify(this.categoryRows))
        };
        this.questionSet = response ?? [];
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }


  putEmailIDsDetails(id: number, payload: { message: string }) {
    this.emailTemplateService.updateEmailTemplate(id, payload).subscribe({
      next: (response) => {
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit':
        // this.setActionButtons('edit');
        this.onEditClicked();
        // this.isEditing = true
        // this.formDetails.enable();
        break;
      case 'save':
        this.onSaveClicked()
        break;
    }
  }

  handleEditRow(row: CategoryDetailForm): void {
    this.setButtonDisabled('save', !this.hasFormChanged());
  }

  onEditClicked() {
    console.log('Edit button clicked');

    // เข้าโหมดแก้ไข
    this.isEditing = true;
    this.formDetails.enable({ emitEvent: false });

    this.initialSnapshot = {
      // ...this.formDetails.getRawValue(),
      categoryRows: JSON.parse(JSON.stringify(this.categoryRows))
    };

    // สลับปุ่มเป็น Save และ disable ไว้ก่อนจนกว่าจะมีการแก้
    this.setActionButtons('edit');
  }

  private setActionButtons(mode: 'view' | 'edit') {
    if (mode === 'view') {
      this.filterButtons = [{ label: 'Edit', key: 'edit', color: '#000000' }];
      this.disabledKeys = [];
    } else {
      this.filterButtons = [{ label: 'Save', key: 'save', color: '#000055' }];
      this.disabledKeys = ['save'];
    }
  }

  private setButtonDisabled(key: string, disabled: boolean) {
    const set = new Set(this.disabledKeys);
    if (disabled) set.add(key);
    else set.delete(key);
    this.disabledKeys = Array.from(set);
  }

  private hasFormChanged(): boolean {
    if (!this.initialSnapshot) return false;

    const current = {
      // ...this.formDetails.getRawValue(),
      categoryRows: this.categoryRows
    };

    return JSON.stringify(current) !== JSON.stringify(this.initialSnapshot);
  }

  onSaveClicked() {
    if (!this.hasFormChanged()) return;

    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      width: '496px',
      panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
      autoFocus: false,
      disableClose: true,
      data: {
        title: 'Confirmation',
        message: 'Are you sure you want to save this data?',
        confirm: true
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (confirmed) {
        const changedRows = this.findChangedRows();

        if (changedRows.length === 0) {
          console.log('No changes detected in rows');
          return;
        }

        const updateCalls = changedRows.map(row => {
          const payload = { message: row.message };
          return this.emailTemplateService.updateEmailTemplate(row.id, payload);
        });

        forkJoin(updateCalls).subscribe({
          next: () => {
            console.log('All rows updated successfully');

            this.isEditing = false;
            this.formDetails.disable({ emitEvent: false });

            this.initialSnapshot = {
              categoryRows: JSON.parse(JSON.stringify(this.categoryRows))
            };

            // this.setActionButtons('view');
            this.setActionButtons('edit');
            this.isEditing = true

            // ✅ ค่อย fetch ใหม่ หลังทุก PUT เสร็จ
            this.fetchEmailIDsDetails();
          },
          error: (err) => {
            console.error('Error updating rows:', err);
          }
        });
      }
    });
  }

  private findChangedRows(): any[] {
    const current = this.categoryRows;
    const initial = this.initialSnapshot?.categoryRows ?? [];

    const changed: any[] = [];

    current.forEach((currRow, index) => {
      const initRow = initial.find((row: any) => row.id === currRow.id);

      if (!initRow) {
        // แถวใหม่
        changed.push(currRow);
      } else {
        // เช็คว่า field ไหนเปลี่ยน
        const hasChanged =
          currRow.subject !== initRow.subject ||
          currRow.message !== initRow.message ||
          currRow.activeStatus !== initRow.activeStatus;

        if (hasChanged) {
          changed.push(currRow);
        }
      }
    });

    return changed;
  }

  onRowClicked(row: any, action: 'view' | 'edit') {
    console.log('View row clicked:', row);
    this.isEnabledCardDetails = true;
    if (action === 'view') {
      this.isViewMode = true;
      this.isAddMode = false;
      this.isEditMode = false;
      this.isEditDetails = false;
    } else {
      this.isViewMode = false;
      this.isAddMode = false;
      this.isEditMode = true;
      this.isEditDetails = false;
    }

    this.formDetails.patchValue({
      selectedCategoryId: row?.categoryId ?? null,
      categoryDetails: { CategoryName: row?.categoryName ?? '' }
    });
  }

  onToggleChangeCategory(e: { row: any; checked: boolean; checkbox: HTMLInputElement }) {
    const row = e.row;
    const idx = this.categoriesFA.controls.findIndex((fg: FormGroup) => fg.value.categoryId === row.categoryId);
    if (idx > -1) {
      this.categoriesFA.at(idx).patchValue({ activeStatus: e.checked });
      e.checkbox.checked = e.checked; // sync ฝั่ง UI
      this.rebuildCategoryRowsFromForm();
    }
  }

  onToggleChangeDetails(e: { row: any; checked: boolean; checkbox: HTMLInputElement }) {
    const row = e.row;
    const idx = this.detailsFA.controls.findIndex((fg: FormGroup) => fg.value.id === row.id);
    if (idx > -1) {
      this.detailsFA.at(idx).patchValue({ activeStatus: e.checked });
      e.checkbox.checked = e.checked;
      this.rebuildDetailsRowsFromForm();
    }
  }

  private rebuildDetailsRowsFromForm() {
    // const arr = this.detailsFA.getRawValue() as CategoryDetailForm[];
    // this.categoryDetailsRows = arr.map((it, idx) => ({
    //   id: it.id,
    //   index: idx + 1,
    //   subject: it.subject,
    //   message: it.message,
    //   activeStatus: !!it.activeStatus,
    //   textlinkActions: ['edit-inrow','delete'], // อาจปรับตามสิทธิ์จาก API
    // }));
  }

  private rebuildCategoryRowsFromForm() {
    const arr = this.categoriesFA.getRawValue() as CategoryForm[];
    this.categoryRows = arr.map((it, idx) => ({
      categoryId: it.categoryId,
      index: idx + 1,
      categoryName: it.categoryName ?? '-',
      activeStatus: !!it.activeStatus,
      textlinkActions: ['view', 'edit-topopup'], // ปรับตามสิทธิ์ได้
    }));
  }

  get categoriesFA() {
    return this.formDetails.get('categories') as any; // FormArray<FormGroup<CategoryForm>>
  }

  get categoryDetailsFG() {
    return this.formDetails.get('categoryDetails') as FormGroup;
  }
  get detailsFA() {
    return this.categoryDetailsFG.get('items') as any; // FormArray<FormGroup<CategoryDetailForm>>
  }

  get isDisabled() {
    return !this.isEditing
  }


  onEditDetailsClicked() {
    console.log('Edit Details button clicked');
    this.categoryDetailsFG.enable();
    this.isEditDetails = true;
  }

  onInlineSave(payload: any) {
    this.isAddingRow = false;
    console.log('Inline save payload:', payload);

    const normalized = {
      id: payload.id ?? null,
      subject: payload.subject ?? '',
      message: payload.message ?? '',
      activeStatus: payload.activeStatus ?? (payload.status === 1),
    };

    this.categoryRows.push(normalized); // อัปเดตใน array ธรรมดา

    // ✅ บอก Angular ว่ามีการเปลี่ยนแปลง
    this.formDetails.markAsDirty();

    // ✅ ตรวจสอบใหม่ให้เปิดปุ่ม Save
    this.setButtonDisabled('save', !this.hasFormChanged());

    setTimeout(() => {
      try {
        this.categoryTable?.tableWrapperRef?.nativeElement?.scrollTo({
          top: this.categoryTable?.tableWrapperRef?.nativeElement?.scrollHeight ?? 0,
          behavior: 'smooth'
        });
      } catch { }
    }, 0);
  }

  onDeleteRowClicked(row: any) {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(CaptchaDialogComponent, {
      width: '520px',
      panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
      disableClose: true,
      data: {
        title: 'Delete',
        message: 'Are you sure you want to delete this item?',
        length: 6,
      }
    });

    dialogRef.afterClosed().subscribe(async (ok: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (!ok) return; // ยกเลิกถ้า CAPTCHA ไม่ผ่าน/กด Cancel

      // // --- หา index ของแถวใน FormArray ---
      // const id = row?.id ?? null;
      // const idx = this.detailsFA.controls.findIndex((fg: FormGroup) => {
      //   const v = fg.value as CategoryDetailForm;
      //   // ถ้ามี id ให้เทียบด้วย id ก่อน, ถ้าไม่มี ใช้ฟิลด์ประกอบ
      //   return id != null
      //     ? v.id === id
      //     : v.subject === row?.subject &&
      //       v.message === row?.message;
      // });

      // if (idx < 0) {
      //   console.warn('Row not found in FormArray, skip delete.');
      //   return;
      // }

      // // --- Optimistic update: ลบทันทีใน UI ---
      // const backup = this.detailsFA.at(idx).value as CategoryDetailForm;
      // this.detailsFA.removeAt(idx);
      // this.rebuildDetailsRowsFromForm();
      // this.categoryDetailsFG.markAsDirty();
      // this.formDetails.markAsDirty();
    });
  }

  onInlineCancel() {
    this.isAddingRow = false;
    this.fieldErrors = false;
  }

}

