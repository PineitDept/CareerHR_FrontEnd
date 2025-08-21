import { Component, ViewChild } from '@angular/core';
import { defaultDetailsFilterButtons } from '../../../../../../../../constants/admin-setting/application-question.constants';
import { ActivatedRoute } from '@angular/router';
import { ApplicationQuestionService } from '../../../../../../../../services/admin-setting/application-question/application-question.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Columns } from '../../../../../../../../shared/interfaces/tables/column.interface';
import { TablesComponent } from '../../../../../../../../shared/components/tables/tables.component';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogComponent } from '../../../../../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { CaptchaDialogComponent } from '../../../../../../../../shared/components/dialogs/captcha-dialog/captcha-dialog.component';

type CategoryForm = {
  categoryId: number | string | null;
  categoryName: string;
  activeStatus: boolean;
};

type CategoryDetailForm = {
  id: number | string | null;
  questionTH: string;
  questionEN: string;
  sort: number | null;
  activeStatus: boolean;
};

@Component({
  selector: 'app-application-question-details',
  templateUrl: './application-question-details.component.html',
  styleUrl: './application-question-details.component.scss',
  animations: [
    trigger('fadeInOutAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class ApplicationQuestionDetailsComponent {
  @ViewChild('categoryTable') categoryTable!: TablesComponent;
  @ViewChild('categoryDetailsTable') categoryDetailsTable!: TablesComponent;

  filterButtons = defaultDetailsFilterButtons();
  disabledKeys: string[] = [];

  categoryType: string = '';

  formDetails!: FormGroup;

  categoryColumns: Columns = [
    {
      header: 'No.',
      field: 'index',
      type: 'text',
      align: 'center',
      width: '4%'
    },
    {
      header: 'Category Name',
      field: 'categoryName',
      type: 'text',
      width: '71%'
    },
    {
      header: 'Status',
      field: 'activeStatus',
      type: 'toggle',
      align: 'center',
      width: '7%'
    },
    {
      header: 'Action',
      field: 'textlink',
      type: 'textlink',
      align: 'center',
      width: '18%',
      textlinkActions: ['view','edit-card']
    }
  ];

  categoryDetailsColumns: Columns = [
    {
      header: 'No.',
      field: '__index',
      type: 'number',
      align: 'center',
      width: '4%'
    },
    {
      header: 'Question (TH)',
      field: 'questionTH',
      type: 'text',
      width: '32%',
      wrapText: true,
    },
    {
      header: 'Question (EN)',
      field: 'questionEN',
      type: 'text',
      width: '32%',
      wrapText: true,
    },
    {
      header: 'Row Answer',
      field: 'sort',
      type: 'number',
      align: 'center',
      width: '13%'
    },
    {
      header: 'Status',
      field: 'activeStatus',
      type: 'toggle',
      align: 'center',
      width: '7%'
    },
    {
      header: 'Action',
      field: 'textlink',
      type: 'textlink',
      align: 'center',
      width: '12%',
      textlinkActions: ['edit-inrow','delete']
    }
  ];

  categoryRows: any[] = [];
  categoryDetailsRows: any[] = [];

  isEnabledCardDetails = false;

  isEditing = false;
  private initialSnapshot: any = null;

  isViewMode = false;
  isAddMode = false;
  isEditMode = false;
  isEditDetails = false;

  isAddingRow = false;
  fieldErrors = false;
  duplicateRowIndex: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private applicationQuestionService: ApplicationQuestionService,
    private fb: FormBuilder,
    private dialog: MatDialog,
  ) { }

  ngOnInit() {
    this.initializeForm();

    // เริ่มด้วย view-mode: ปิดการแก้ไขทั้งฟอร์ม
    this.formDetails.disable({ emitEvent: false });
    this.setActionButtons('view');

    // subscribe เปลี่ยน enable/disable ปุ่ม Save แบบเรียลไทม์ **เฉพาะตอนอยู่โหมดแก้ไข**
    this.formDetails.valueChanges.subscribe(() => {
      if (!this.isEditing) return;
      this.setButtonDisabled('save', !this.hasFormChanged());
    });

    this.route.queryParams.subscribe(params => {
      this.categoryType = params['categoryType'] || '';
      this.formDetails.patchValue({
        categoryType: {
          CategoryTypeName: this.categoryType,
          activeStatus: true
        }
      }, { emitEvent: false });
      // หลังดึงข้อมูลเสร็จ ให้ snapshot ค่าเริ่มต้นไว้ใช้เทียบภายหลัง
      this.fetchCategoryTypesDetails();
    });
  }

  initializeForm() {
    this.formDetails = this.fb.group({
      // ส่วนหัว (ซ้าย/ขวา)
      categoryType: this.fb.group({
        CategoryTypeName: [''],
        activeStatus: [true],
      }),

      // ตาราง Category (FormArray)
      categories: this.fb.array<FormGroup>([]),

      // ส่วน "Category Details" ของ Category ที่เลือก
      selectedCategoryId: [null],
      categoryDetails: this.fb.group({
        CategoryName: [''],
        items: this.fb.array<FormGroup>([]), // ตาราง details
      }),
    });
  }

  // ===== Helpers =====
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
    return this.categoryDetailsFG.disabled;
  }

  private buildCategoryFG(c: any) {
    return this.fb.group<CategoryForm>({
      categoryId: c?.categoryId ?? null,
      categoryName: c?.categoryName ?? '-',
      activeStatus: !!c?.isActive,
    } as any);
  }
  private buildDetailFG(d: any) {
    return this.fb.group<CategoryDetailForm>({
      id: d?.id ?? null,
      questionTH: d?.questionTH ?? '',
      questionEN: d?.questionEN ?? '',
      sort: d?.sort ?? null,
      activeStatus: d?.status === 1 ? true : false,
    } as any);
  }

  private setActionButtons(mode: 'view' | 'edit') {
    if (mode === 'view') {
      this.filterButtons = [{ label: 'Edit', key: 'edit', color: '#000000' }];
      this.disabledKeys = []; // ไม่มีอะไรให้ disable
    } else {
      this.filterButtons = [{ label: 'Save', key: 'save', color: '#000055' }];
      // ตอนเข้าโหมดแก้ไขใหม่ ๆ ยังไม่เปลี่ยนค่า -> disable Save ไว้ก่อน
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
    const current = this.formDetails.getRawValue();
    return JSON.stringify(current) !== JSON.stringify(this.initialSnapshot);
  }

  toggleActive(): void {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      width: '640px',
      panelClass: 'custom-dialog-container',
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

    // const categoryTypeCtrl = this.formDetails.get('categoryType')?.get('activeStatus');
    // const currentStatus = !!categoryTypeCtrl?.value;
    // categoryTypeCtrl?.setValue(!currentStatus);
    // categoryTypeCtrl?.markAsDirty();
    // categoryTypeCtrl?.markAsTouched();
  }

  onAddClicked() {
    console.log('Add Category clicked');
    // เปิด Card Details
    this.isEnabledCardDetails = true;
    this.isAddMode = true;
    this.isViewMode = false;
    this.isEditMode = false;
    this.categoryDetailsFG.enable();

    // รีเซ็ต FormGroup สำหรับ categoryDetails
    this.categoryDetailsFG.reset({
      CategoryName: '',
    });

    // เคลียร์ FormArray ของ categoryDetails (ข้อมูลที่กรอกในตาราง)
    this.detailsFA.clear();
    this.categoryDetailsRows = [];

    // ปิดปุ่ม Save จนกว่าจะกรอกข้อมูล
    // this.onSaveDetailsEnabled(false);
  }

  checkFormDetailsChanged(): boolean {
    const formValue = this.formDetails.getRawValue();
    const initialValue = this.formDetails.get('categoryDetails')?.value;

    // ตรวจสอบว่า categoryDetails ไม่ได้ว่างเปล่าและข้อมูลต่างจากค่าเดิม
    if (!formValue.categoryDetails.CategoryName ||
        JSON.stringify(formValue.categoryDetails) === JSON.stringify(initialValue)) {
      return false;
    }
    return true;
  }

  fetchCategoryTypesDetails() {
    this.applicationQuestionService.getCategoryTypesInfoQuestionDetails(this.categoryType).subscribe({
      next: (response) => {
        console.log('Category types details fetched successfully:', response);
        // สร้าง FormArray ของ categories
        this.categoriesFA.clear();
        (response ?? []).forEach((c: any) => this.categoriesFA.push(this.buildCategoryFG(c)));

        // สร้าง rows จากฟอร์ม (เพื่อแสดงในตาราง)
        this.rebuildCategoryRowsFromForm();
        this.formDetails.disable({ emitEvent: false });
        this.initialSnapshot = this.formDetails.getRawValue();
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
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

  private rebuildDetailsRowsFromForm() {
    const arr = this.detailsFA.getRawValue() as CategoryDetailForm[];
    this.categoryDetailsRows = arr.map((it, idx) => ({
      id: it.id,
      index: idx + 1,
      questionTH: it.questionTH,
      questionEN: it.questionEN,
      sort: it.sort,
      activeStatus: !!it.activeStatus,
      textlinkActions: ['edit-inrow','delete'], // อาจปรับตามสิทธิ์จาก API
    }));
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit':
        this.onEditClicked();
        break;
      case 'save':
        this.onSaveClicked();
        break;
    }
  }

  onEditClicked() {
    console.log('Edit button clicked');
    // เข้าโหมดแก้ไข
    this.isEditing = true;
    this.formDetails.enable({ emitEvent: false });

    // เก็บ snapshot ตอนเริ่มแก้ไข
    this.initialSnapshot = this.formDetails.getRawValue();

    // สลับปุ่มเป็น Save และ disable ไว้ก่อนจนกว่าจะมีการแก้
    this.setActionButtons('edit');
  }

  onSaveClicked() {
    console.log('Save button clicked');
    // ไม่ให้กดถ้าไม่มีการเปลี่ยน
    if (!this.hasFormChanged()) {
      // กันเคสเผลอคลิกจากคีย์ลัดหรืออื่น ๆ
      return;
    }

    const value = this.formDetails.getRawValue();
    const payload = {
      categoryType: {
        name: value.categoryType.CategoryTypeName,
        isActive: !!value.categoryType.activeStatus,
      },
      categories: (value.categories ?? []).map((c: CategoryForm) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        isActive: !!c.activeStatus,
      })),
      selectedCategoryId: value.selectedCategoryId,
      categoryDetails: {
        CategoryName: value.categoryDetails?.CategoryName ?? '',
        items: (value.categoryDetails?.items ?? []).map((d: CategoryDetailForm) => ({
          id: d.id,
          questionTH: d.questionTH,
          questionEN: d.questionEN,
          sort: d.sort,
          status: d.activeStatus ? 1 : 2,
        })),
      }
    };

    console.log('SAVE payload:', payload);
    // ปิดโหมดแก้ไข + รีเซ็ตสถานะปุ่ม
    this.isEditing = false;
    this.formDetails.disable({ emitEvent: false });

    // จับ snapshot ใหม่หลังเซฟสำเร็จ (ให้สถานะล่าสุดคือ baseline)
    this.initialSnapshot = this.formDetails.getRawValue();

    // กลับไปโหมด view: โชว์เฉพาะปุ่ม Edit
    this.setActionButtons('view');
  }

  onSaveDetailsClicked() {
    console.log('Save Details button clicked');
    if (!this.checkFormDetailsChanged()) {
      // ถ้าฟอร์มไม่เปลี่ยนแปลงหรือไม่มีข้อมูล
      alert("No changes to save");
      return;
    }

    // ถ้ามีการเปลี่ยนแปลง ให้บันทึกข้อมูล
    console.log('Saving data...');
    // เพิ่มการบันทึกข้อมูลที่นี่
  }

  onAddQuestionClicked() {
    console.log('Add button clicked');
    this.isAddingRow = true;
    this.categoryDetailsTable.startInlineCreate({ activeStatus: false, status: 0 }, 'bottom');
  }

  onToggleChange(event: Event): void {
    console.log('Toggle change event:', event);
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

    this.applicationQuestionService.getQuestionsByCategory(row.categoryId).subscribe({
      next: (response) => {
        console.log('Questions fetched successfully:', response);
        // Handle the response as needed, e.g., navigate to a details page or display in a modal
        this.detailsFA.clear();
        (response ?? []).forEach((d: any) => this.detailsFA.push(this.buildDetailFG(d)));
        this.rebuildDetailsRowsFromForm();
        this.categoryDetailsFG.disable();
        },
      error: (error) => {
        console.error('Error fetching questions:', error);
      }
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

  // toggle ในตาราง Category Details
  onToggleChangeDetails(e: { row: any; checked: boolean; checkbox: HTMLInputElement }) {
    const row = e.row;
    const idx = this.detailsFA.controls.findIndex((fg: FormGroup) => fg.value.id === row.id);
    if (idx > -1) {
      this.detailsFA.at(idx).patchValue({ activeStatus: e.checked });
      e.checkbox.checked = e.checked;
      this.rebuildDetailsRowsFromForm();
    }
  }

  onEditDetailsClicked() {
    console.log('Edit Details button clicked');
    this.categoryDetailsFG.enable();
    this.isEditDetails = true;
  }

  onInlineSave(payload: any) {
    this.isAddingRow = false;
    console.log('Inline save payload:', payload);

    // 1) แปลงค่าจาก payload ให้ตรงกับโครงสร้างฟอร์ม
    const normalized = {
      id: payload.id ?? null,
      questionTH: (payload.questionTH ?? '').trim(),
      questionEN: (payload.questionEN ?? '').trim(),
      sort: payload.sort !== undefined && payload.sort !== null ? Number(payload.sort) : null,
      // รองรับทั้ง activeStatus แบบ boolean และ status แบบ 1/2
      activeStatus: payload.activeStatus ?? (payload.status === 1),
    };

    // 2) push เข้า FormArray (source of truth)
    this.detailsFA.push(
      this.fb.group<CategoryDetailForm>(normalized as any)
      // หรือใช้ this.buildDetailFG({ ...normalized, status: normalized.activeStatus ? 1 : 2 })
    );

    // 3) rebuild rows ให้ตารางอัปเดต
    this.rebuildDetailsRowsFromForm();

    // 4) ทำให้ฟอร์มรู้ว่ามีการเปลี่ยน (ปุ่ม Save จะ enabled)
    this.categoryDetailsFG.markAsDirty();
    this.formDetails.markAsDirty();

    // 5) (ออปชัน) เลื่อนลงล่างให้เห็นแถวใหม่ทันที
    setTimeout(() => {
      try {
        this.categoryDetailsTable?.tableWrapperRef?.nativeElement?.scrollTo({
          top: this.categoryDetailsTable?.tableWrapperRef?.nativeElement?.scrollHeight ?? 0,
          behavior: 'smooth'
        });
      } catch {}
    }, 0);

    console.log('Inline save payload:', payload, '→ added:', normalized);
  }

  onDeleteRowClicked(row: any) {
    console.log('Delete row clicked:', row);
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(CaptchaDialogComponent, {
      width: '520px',
      panelClass: 'custom-dialog-container',
      disableClose: true,
      data: {
        title: 'Delete',
        message: 'Are you sure you want to delete this item?',
        length: 6,
        caseSensitive: false
      }
    });

    dialogRef.afterClosed().subscribe(async (ok: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (!ok) return; // ยกเลิกถ้า CAPTCHA ไม่ผ่าน/กด Cancel

    // --- หา index ของแถวใน FormArray ---
    const id = row?.id ?? null;
    const idx = this.detailsFA.controls.findIndex((fg: FormGroup) => {
      const v = fg.value as CategoryDetailForm;
      // ถ้ามี id ให้เทียบด้วย id ก่อน, ถ้าไม่มี ใช้ฟิลด์ประกอบ
      return id != null
        ? v.id === id
        : v.questionTH === row?.questionTH &&
          v.questionEN === row?.questionEN &&
          v.sort === row?.sort;
    });

    if (idx < 0) {
      console.warn('Row not found in FormArray, skip delete.');
      return;
    }

    // --- Optimistic update: ลบทันทีใน UI ---
    const backup = this.detailsFA.at(idx).value as CategoryDetailForm;
    this.detailsFA.removeAt(idx);
    this.rebuildDetailsRowsFromForm();
    this.categoryDetailsFG.markAsDirty();
    this.formDetails.markAsDirty();
    });
  }

  onInlineCancel() {
    this.isAddingRow = false;
    this.fieldErrors = false;
  }
}
