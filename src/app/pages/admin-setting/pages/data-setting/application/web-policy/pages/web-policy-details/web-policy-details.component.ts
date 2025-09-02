import { Component } from '@angular/core';
import { defaultColumns, defaultFilterButtonsDetails } from '../../../../../../../../../app/constants/admin-setting/email-template.constants';
import { EmailTemplateService } from '../../../../../../../../../app/services/admin-setting/email-template/email-template.service';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { AlertDialogComponent } from '../../../../../../../../../app/shared/components/dialogs/alert-dialog/alert-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { NotificationService } from '../../../../../../../../shared/services/notification/notification.service';
// 🔹 NEW: rxjs สำหรับจัดการ subscription + valueChanges
import { Subject, takeUntil, debounceTime } from 'rxjs';

@Component({
  selector: 'app-web-policy-details',
  templateUrl: './web-policy-details.component.html',
  styleUrl: './web-policy-details.component.scss'
})
export class WebPolicyDetailsComponent {
  isEditing = false;
  private initialSnapshot: any = null;

  // 🔹 หมายเหตุ: categoryType มีไว้ให้คีย์รูปแบบเดียวกับคอมโพเนนต์ก่อนหน้าได้
  categoryType: string = '';

  // ====== Draft / Dirty Keys (ปรับให้เฉพาะหน้า Email นี้) ======
  // ใช้ EmailID เป็นส่วนประกอบคีย์ เพื่อแยก draft ต่อเทมเพลต
  private DRAFT_PREFIX = 'webpolicy:draft';            // 🔹 NEW
  private DIRTY_PREFIX = 'webpolicy:dirty';            // 🔹 NEW

  formDetails!: FormGroup;
  columns = defaultColumns();
  filterButtons = defaultFilterButtonsDetails();
  disabledKeys: string[] = [];
  fieldErrors:boolean = false;

  EmailID: string = '';
  EmailSubject: string = '';
  questionSet: any[] = [];

  categoryRows: any[] = [];
  showHtml = false;

  // 🔹 NEW: จัดการ lifecycle ของ subscription + กัน loop valueChanges
  private destroy$ = new Subject<void>();
  private isProgrammaticUpdate = false;
  private readyForDraft = false;

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

  constructor(
    private emailTemplateService: EmailTemplateService,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private notificationService: NotificationService,
  ) { }

  ngOnInit() {
    this.initializeForm();

    this.emailTemplateService.setEMailType('content-policy');
    this.route.queryParams.subscribe(params => {
      this.EmailID = params['id'] || '';
      this.fetchEmailIDsDetails();
    });

    this.formDetails.disable({ emitEvent: false });
    this.setActionButtons('view');

    // 🔹 NEW: บันทึก draft ทุกครั้งที่ผู้ใช้แก้ค่า (ระหว่างโหมดแก้ไข)
    this.formDetails.valueChanges
    .pipe(takeUntil(this.destroy$), debounceTime(150))
    .subscribe(() => {
      if (this.isProgrammaticUpdate) return;
      if (!this.readyForDraft) return;             // ✅ รอให้โหลดข้อมูล/ตั้ง EmailID ก่อน
      if (!this.isEditing) return;                 // ✅ เขียน draft เฉพาะตอนแก้ไข
      const v = this.formDetails.getRawValue();
      if (!v.subject && !v.emailContent) return;   // ✅ กันเขียนค่าว่างทับ

      this.writeDraftFromForm();
      const enable = this.hasPendingDrafts() || this.hasFormChanged();
      this.setButtonDisabled('save', !enable);
    });
  }

  initializeForm() {
    this.formDetails = this.fb.group({
      subject: [''],
      activeStatus: [true],
      emailContent: new FormControl('')
    });
  }

  // ============== Draft / Dirty Helpers (แพทเทิร์นที่ต้องการ) ==============

  // 🔹 คีย์ draft ต่อ EmailID
  private draftKey(): string {
    const id = this.EmailID || 'new';
    return `${this.DRAFT_PREFIX}:${id}`;
  }

  // 🔹 อ่าน/เขียน/ลบ draft
  private readDraft(): { subject?: string; emailContent?: string } | null {
    try {
      const raw = sessionStorage.getItem(this.draftKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  private writeDraft(obj: { subject?: string; emailContent?: string }) {
    try {
      sessionStorage.setItem(this.draftKey(), JSON.stringify(obj ?? {}));
    } catch {}
  }
  private clearDraft() {
    try { sessionStorage.removeItem(this.draftKey()); } catch {}
  }

  private writeDraftFromForm() {
    if (!this.EmailID) return; // ✅ ยังไม่รู้ key อย่างเป็นทางการ
    const v = this.formDetails.getRawValue();
    const draft = {
      subject: (v?.subject ?? '').trim(),
      emailContent: (v?.emailContent ?? '')
    };

    // ✅ กันเคสเขียน {} หรือค่าว่างล้วนๆ ทับของเดิม
    if (!draft.subject && !draft.emailContent) return;

    // ✅ กันการเขียนซ้ำกับของเดิมใน storage โดยไม่จำเป็น
    const old = this.readDraft();
    if (old && old.subject === draft.subject && old.emailContent === draft.emailContent) {
      return;
    }

    this.writeDraft(draft);
  }

  // 🔹 hasFormChanged: เทียบกับ snapshot ล่าสุดจากเซิร์ฟเวอร์/หลังบันทึก
  private hasFormChanged(): boolean {
    if (!this.initialSnapshot) return false;
    const current = this.formDetails.getRawValue();
    return JSON.stringify(current) !== JSON.stringify(this.initialSnapshot);
  }

  // 🔹 hasPendingDrafts: มี draft เก็บไว้ หรือ dirty IDs (เผื่อขยายในอนาคต)
  public hasPendingDrafts(): boolean {
    const d = this.readDraft();
    // ถ้ามีค่าบางอย่างใน draft และมันต่างจาก snapshot → ถือว่ามี draft
    if (d) {
      const curr = this.formDetails.getRawValue();
      if ((d.subject ?? '') !== (curr.subject ?? '') || (d.emailContent ?? '') !== (curr.emailContent ?? '')) {
        return true;
      }
      // กรณี user reload หน้าและยังมี draft ค้าง → ก็ถือว่ามี pending
      if ((d.subject ?? '') || (d.emailContent ?? '')) return true;
    }
    const hasDirty = (this.readDirty()?.length ?? 0) > 0;
    return hasDirty;
  }

  // 🔹 clearDraftsForCurrentType: เคลียร์ draft/dirty สำหรับ EmailID ปัจจุบัน
  public clearDraftsForCurrentType(): void {
    this.clearDraft();              // ลบ draft เนื้อหาอีเมลของ EmailID นี้
    this.clearDirty();              // ลบรายการ dirty (ถ้ามี)
  }

  // 🔹 ส่วน dirty (เผื่อรองรับหลายส่วนในอนาคต)
  private dirtyKey(): string {
    const id = this.EmailID || 'new';
    return `${this.DIRTY_PREFIX}:${id}`;
  }
  private readDirty(): string[] {
    try {
      const raw = sessionStorage.getItem(this.dirtyKey());
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  private writeDirty(ids: string[]) {
    try { sessionStorage.setItem(this.dirtyKey(), JSON.stringify(Array.from(new Set(ids.map(String))))); } catch {}
  }
  private clearDirty() {
    try { sessionStorage.removeItem(this.dirtyKey()); } catch {}
  }

  // 🔹 สะท้อนสถานะปุ่มตาม draft/changed
  private reflectPendingDraftsUI() {
    const pending = this.hasPendingDrafts();
    if (this.isEditing) {
      this.setActionButtons('edit');
      const enable = pending || this.hasFormChanged();
      this.setButtonDisabled('save', !enable);
      return;
    }
    if (pending) {
      this.enterEditMode('draft');
      this.setActionButtons('edit');
      this.setButtonDisabled('save', false);
    } else {
      this.setActionButtons('view');
    }
  }

  private enterEditMode(source: 'user' | 'draft' = 'user') {
    this.isEditing = true;
    this.formDetails.enable({ emitEvent: false });
    this.setActionButtons('edit');
    this.setButtonDisabled('save', source === 'user'); // user ต้องแก้อะไรก่อนจึงค่อย enable
  }

  // =================== UI / Dialog ===================
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
  }

  onAddClicked() {
    console.log('Add Category clicked');
  }

  // =================== Data Flow ===================
  fetchEmailIDsDetails() {
    this.emailTemplateService.getEmailTemplateById(this.EmailID).subscribe({
      next: (response) => {
        // เติมค่าจาก API
        this.isProgrammaticUpdate = true;
        this.formDetails.patchValue({
          subject: response.subject,
          emailContent: response.message || ''
        }, { emitEvent: false });
        this.isProgrammaticUpdate = false;

        // baseline (สำหรับ hasFormChanged)
        this.initialSnapshot = this.formDetails.getRawValue();

        /// ... patch จาก API → set initialSnapshot → (ถ้ามี) วาง draft
        const draft = this.readDraft();
        if (draft && (draft.subject || draft.emailContent)) {
          this.isProgrammaticUpdate = true;
          this.formDetails.patchValue({
            subject: draft.subject ?? this.formDetails.get('subject')?.value,
            emailContent: draft.emailContent ?? this.formDetails.get('emailContent')?.value
          }, { emitEvent: false });
          this.isProgrammaticUpdate = false;

          this.enterEditMode('draft');
          this.setActionButtons('edit');
          this.setButtonDisabled('save', false);
        } else {
          this.formDetails.disable({ emitEvent: false });
          this.setActionButtons('view');
        }

        // ✅ ตอนนี้ฟอร์มพร้อมแล้ว ค่อยอนุญาตให้เขียน draft
        this.readyForDraft = true;

        this.questionSet = response ?? [];
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  putEmailIDsDetails(payload: {subject: string, message: string}) {
    this.emailTemplateService.updateEmailTemplate(this.EmailID, payload).subscribe({
      next: (response) => {
        // ปิดโหมดแก้ไข
        this.setActionButtons('view');
        this.isEditing = false;
        this.formDetails.disable({ emitEvent: false });

        // อัปเดต snapshot ใหม่ (state ล่าสุดหลังเซฟ)
        this.isProgrammaticUpdate = true;
        this.initialSnapshot = this.formDetails.getRawValue();
        this.isProgrammaticUpdate = false;

        // ล้าง draft/dirty หลังบันทึกสำเร็จ
        this.clearDraftsForCurrentType();

        this.questionSet = response ?? [];
      },
      error: (error) => {
        // เปิดโหมดแก้ไขต่อ
        this.setActionButtons('edit');
        this.onEditClicked();
        this.isEditing = true;
        this.formDetails.enable();

        this.notificationService.error(error.error.error);
        // this.fieldErrors = true;

        // setTimeout(()=>{
        //   this.fieldErrors = false;
        // },3000)
      },
    });
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit':
        this.setActionButtons('edit');
        this.onEditClicked();
        this.isEditing = true;
        this.formDetails.enable();
        // เข้าสู่โหมดแก้ไขด้วยมือ → Save จะ disabled จนกว่าจะมีการแก้
        this.setButtonDisabled('save', !this.hasFormChanged() && !this.hasPendingDrafts());
        break;
      case 'save':
        this.onSaveClicked();
        break;
    }
  }

  onEditClicked() {
    // จับ snapshot ตอนเริ่มแก้ไข (รองรับ hasFormChanged)
    this.initialSnapshot = this.formDetails.getRawValue();
  }

  onSaveClicked() {
    console.log('Save button clicked');

    if (!this.hasFormChanged() && !this.hasPendingDrafts()) {
      return; // ไม่มีอะไรเปลี่ยน หรือไม่มี draft
    }

    const value = this.formDetails.getRawValue();
    const payload = {
      subject: value.subject,
      emailContent: this.getInlineStyledHtml()
    };

    // ปิดโหมดแก้ไขชั่วคราว (optimistic)
    this.isEditing = false;
    this.formDetails.disable({ emitEvent: false });

    // จับ snapshot ใหม่ (optimistic) เพื่อให้ UI มองว่าเท่ากับ baseline
    this.initialSnapshot = this.formDetails.getRawValue();
    this.setActionButtons('view');

    // เคลียร์ draft ไว้ก่อน (จะถูกล้างซ้ำใน next: ของ API อีกที)
    this.clearDraftsForCurrentType();

    // ยิงอัปเดตจริง
    this.putEmailIDsDetails({
      subject: value.subject,
      message: this.getInlineStyledHtml()
    });
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

  // =================== Inline Style Extractor ===================
  getInlineStyledHtml() {
    const data = this.formDetails.get('emailContent')?.value;
    if (!data) return '';

    const container = document.createElement('div');
    container.innerHTML = data;

    const elements = container.querySelectorAll('[class]');
    elements.forEach(el => {
      const element = el as HTMLElement;
      const classes = element.className.split(' ');

      classes.forEach(cls => {
        if (cls.startsWith('ql-align-')) {
          const align = cls.replace('ql-align-', '');
          element.style.textAlign = align;
          element.classList.remove(cls);
        }

        if (cls.startsWith('ql-font-')) {
          const font = cls.replace('ql-font-', '');
          element.style.fontFamily = font;
          element.classList.remove(cls);
        }

        if (cls.startsWith('ql-size-')) {
          const size = cls.replace('ql-size-', '');
          const sizeMap: Record<string, string> = {
            small: '0.75em',
            normal: '1em',
            large: '1.5em',
            huge: '2.5em'
          };
          element.style.fontSize = sizeMap[size] || size;
          element.classList.remove(cls);
        }

        if (cls.startsWith('ql-color-')) {
          const color = cls.replace('ql-color-', '');
          element.style.color = `#${color}`;
          element.classList.remove(cls);
        }

        if (cls.startsWith('ql-background-')) {
          const bg = cls.replace('ql-background-', '');
          element.style.backgroundColor = `#${bg}`;
          element.classList.remove(cls);
        }

        if (cls === 'ql-direction-rtl') {
          element.style.direction = 'rtl';
          element.classList.remove(cls);
        }

        if (cls.startsWith('ql-indent-')) {
          const indent = parseInt(cls.replace('ql-indent-', ''), 10);
          element.style.marginLeft = `${indent * 3}em`;
          element.classList.remove(cls);
        }
      });

      if (!element.className.trim()) {
        element.removeAttribute('class');
      }
    });

    // ✅ รูปภาพที่ resize ให้ embed width/height เป็นแอตทริบิวต์
    const images = container.querySelectorAll('img');
    images.forEach(img => {
      const image = img as HTMLImageElement;
      if (image.style.width) {
        image.setAttribute('width', image.style.width);
        image.style.width = '';
      }
      if (image.style.height) {
        image.setAttribute('height', image.style.height);
        image.style.height = '';
      }
    });

    return container.innerHTML;
  }

  // =================== Lifecycle ===================
  ngOnDestroy() {
    // if (this.isEditing && this.readyForDraft) {
    //   this.writeDraftFromForm();
    // }
    this.destroy$.next();
    this.destroy$.complete();
  }
}
