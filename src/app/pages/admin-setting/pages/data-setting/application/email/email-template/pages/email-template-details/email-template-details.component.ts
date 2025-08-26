import { Component } from '@angular/core';
import { defaultColumns, defaultFilterButtonsDetails } from '../../../../../../../../../../app/constants/admin-setting/email-template.constants';
import { EmailTemplateService } from '../../../../../../../../../../app/services/admin-setting/email-template/email-template.service';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { AlertDialogComponent } from '../../../../../../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { NotificationService } from '../../../../../../../../../shared/services/notification/notification.service';
import { Subject, takeUntil, debounceTime } from 'rxjs';

@Component({
  selector: 'app-email-template-details',
  templateUrl: './email-template-details.component.html',
  styleUrls: ['./email-template-details.component.scss']
})
export class EmailTemplateDetailsComponent {
  isEditing = false;
  private initialSnapshot: any = null;

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

  // ===== Quill config =====
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

  // ===== Draft/dirty control =====
  private destroy$ = new Subject<void>();
  private isProgrammaticUpdate = false;
  private readyForDraft = false;
  private DRAFT_PREFIX = 'emailtpl:draft';
  private DIRTY_PREFIX = 'emailtpl:dirty';

  constructor(
    private emailTemplateService: EmailTemplateService,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private notificationService: NotificationService,
  ) { }

  ngOnInit() {
    this.initializeForm();

    this.emailTemplateService.setEMailType('email-template');
    this.route.queryParams.subscribe(params => {
      this.EmailID = params['id'] || '';
      this.fetchEmailIDsDetails();
    });

    this.formDetails.disable({ emitEvent: false });
    this.setActionButtons('view');

    // เขียน draft อัตโนมัติเมื่อแก้ไข (หลังโหลดเสร็จ/รู้ EmailID แล้วเท่านั้น)
    this.formDetails.valueChanges
      .pipe(takeUntil(this.destroy$), debounceTime(150))
      .subscribe(() => {
        if (this.isProgrammaticUpdate) return;
        if (!this.readyForDraft) return;
        if (!this.isEditing) return;

        const v = this.formDetails.getRawValue();
        if (!v.subject && !v.emailContent) return; // กันเขียนค่าว่างทับ

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

  // =================== Data Flow ===================
  fetchEmailIDsDetails() {
    this.emailTemplateService.getEmailTemplateById(this.EmailID).subscribe({
      next: (response) => {
        // รองรับ response เป็น array (ตามโค้ดเดิม)
        const item = Array.isArray(response) ? response[0] : response;
        this.isProgrammaticUpdate = true;
        this.formDetails.patchValue({
          subject: item?.subject ?? '',
          emailContent: item?.message || ''
        }, { emitEvent: false });
        this.isProgrammaticUpdate = false;

        // baseline (สำหรับ hasFormChanged)
        this.initialSnapshot = this.formDetails.getRawValue();

        // ถ้ามี draft ค้างของ EmailID นี้ → วางทับ
        const draft = this.readDraft();
        if (draft && (draft.subject || draft.emailContent)) {
          this.isProgrammaticUpdate = true;
          this.formDetails.patchValue({
            subject: draft.subject ?? this.formDetails.get('subject')?.value,
            emailContent: draft.emailContent ?? this.formDetails.get('emailContent')?.value  // ← inline
          }, { emitEvent: false });
          this.isProgrammaticUpdate = false;

          this.enterEditMode('draft');
          this.setActionButtons('edit');
          this.setButtonDisabled('save', false);
        } else {
          this.formDetails.disable({ emitEvent: false });
          this.setActionButtons('view');
        }

        // ตอนนี้ฟอร์มพร้อมแล้ว → เปิดให้เขียน draft ได้
        this.readyForDraft = true;

        this.questionSet = response ?? [];
      },
      error: (error) => {
        console.error('Error fetching email template details:', error);
      },
    });
  }

  putEmailIDsDetails(payload: {subject: string, message: string}) {
    this.emailTemplateService.updateEmailTemplate(this.EmailID, payload).subscribe({
      next: (response) => {
        this.setActionButtons('view');
        this.isEditing = false;
        this.formDetails.disable({ emitEvent: false });

        // snapshot ใหม่หลังเซฟ
        this.isProgrammaticUpdate = true;
        this.initialSnapshot = this.formDetails.getRawValue();
        this.isProgrammaticUpdate = false;

        // ล้าง draft/dirty
        this.clearDraftsForCurrentType();

        this.questionSet = response ?? [];
        this.notificationService?.success?.('Saved successfully');
      },
      error: (error) => {
        this.setActionButtons('edit');
        this.onEditClicked();
        this.isEditing = true;
        this.formDetails.enable();

        this.notificationService.error(error.error.error);
        // this.fieldErrors = true;

        // setTimeout(()=>{ this.fieldErrors = false; },3000);
      },
    });
  }

  // =================== Toolbar actions ===================
  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit':
        this.setActionButtons('edit');
        this.onEditClicked();
        this.isEditing = true;
        this.formDetails.enable();
        this.setButtonDisabled('save', !this.hasFormChanged() && !this.hasPendingDrafts());
        break;
      case 'save':
        this.onSaveClicked();
        break;
    }
  }

  onEditClicked() {
    // snapshot ตอนเริ่มแก้ไข (รองรับ hasFormChanged)
    this.initialSnapshot = this.formDetails.getRawValue();
  }

  onSaveClicked() {
    if (!this.hasFormChanged() && !this.hasPendingDrafts()) return;

    const value = this.formDetails.getRawValue();

    // กันเซฟ subject ว่างตั้งแต่ฝั่ง UI
    if (!String(value.subject || '').trim()) {
      this.notificationService.error('Subject is required');
      this.setButtonDisabled('save', true);
      return;
    }

    const payload = {
      subject: value.subject,
      emailContent: this.getInlineStyledHtml()
    };

    // optimistic UI
    this.isEditing = false;
    this.formDetails.disable({ emitEvent: false });
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

  // =================== Action Buttons & State ===================
  private setActionButtons(mode: 'view' | 'edit') {
    if (mode === 'view') {
      this.filterButtons = [{ label: 'Edit', key: 'edit', color: '#000000' }];
      this.disabledKeys = [];
    } else {
      this.filterButtons = [
        { label: 'Save', key: 'save', color: '#000055' },
      ];
      this.disabledKeys = ['save'];
    }
  }

  private setButtonDisabled(key: string, disabled: boolean) {
    const set = new Set(this.disabledKeys);
    if (disabled) set.add(key);
    else set.delete(key);
    this.disabledKeys = Array.from(set);
  }

  private enterEditMode(source: 'user' | 'draft' = 'user') {
    this.isEditing = true;
    this.formDetails.enable({ emitEvent: false });
    this.setActionButtons('edit');
    this.setButtonDisabled('save', source === 'user');
  }

  // =================== Change & Draft helpers ===================
  private hasFormChanged(): boolean {
    if (!this.initialSnapshot) return false;
    const cur = this.formDetails.getRawValue();
    const a = { subject: cur.subject, emailContent: cur.emailContent, activeStatus: cur.activeStatus };
    const b = {
      subject: this.initialSnapshot.subject,
      emailContent: this.initialSnapshot.emailContent,
      activeStatus: this.initialSnapshot.activeStatus
    };
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  public hasPendingDrafts(): boolean {
    const d = this.readDraft();
    if (d) {
      const v = this.formDetails.getRawValue();
      const inlineNow = this.getInlineStyledHtml(); // ← inline ปัจจุบันจาก editor

      if ((d.subject ?? '') !== (v.subject ?? '') || (d.emailContent ?? '') !== (inlineNow ?? '')) {
        return true;
      }
      if ((d.subject ?? '') || (d.emailContent ?? '')) return true;
    }
    const hasDirty = (this.readDirty()?.length ?? 0) > 0;
    return hasDirty;
  }

  public clearDraftsForCurrentType(): void {
    this.clearDraft();
    this.clearDirty();
  }

  // draft keys/ops
  private draftKey(): string {
    const id = this.EmailID || 'new';
    return `${this.DRAFT_PREFIX}:${id}`;
  }
  private readDraft(): { subject?: string; emailContent?: string } | null {
    try {
      const raw = sessionStorage.getItem(this.draftKey());
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  private writeDraft(obj: { subject?: string; emailContent?: string }) {
    try { sessionStorage.setItem(this.draftKey(), JSON.stringify(obj ?? {})); } catch {}
  }
  private clearDraft() {
    try { sessionStorage.removeItem(this.draftKey()); } catch {}
  }
  private writeDraftFromForm() {
    if (!this.EmailID) return; // ยังไม่รู้ key

    const v = this.formDetails.getRawValue();
    const inlineHtml = this.getInlineStyledHtml(); // ← ใช้ค่า inline แล้ว

    const draft = {
      subject: (v?.subject ?? '').trim(),
      emailContent: inlineHtml,                   // ← เก็บแบบ inline
    };

    // ไม่เขียนค่าว่างล้วน
    if (!draft.subject && !draft.emailContent) return;

    // กันการเขียนซ้ำ
    const old = this.readDraft();
    if (old && old.subject === draft.subject && old.emailContent === draft.emailContent) return;

    this.writeDraft(draft);
  }

  // dirty keys/ops (เผื่อในอนาคตจะมีส่วนอื่น ๆ)
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

  onAddClicked() {
    console.log('Add Category clicked');
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

    // รูปภาพที่ถูก resize → ย้าย width/height เป็น attribute
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

  // =================== Dialog (ตัวอย่างสถานะ) ===================
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

  // =================== Lifecycle ===================
  ngOnDestroy() {
    // ถ้าต้องการบันทึกครั้งสุดท้ายตอนออก ให้เปิด block นี้
    // if (this.isEditing && this.readyForDraft) {
    //   this.writeDraftFromForm();
    // }
    this.destroy$.next();
    this.destroy$.complete();
  }
}
