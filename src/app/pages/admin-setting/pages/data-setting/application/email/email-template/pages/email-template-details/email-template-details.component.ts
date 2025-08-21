import { Component } from '@angular/core';
import { defaultColumns, defaultFilterButtonsDetails } from '../../../../../../../../../../app/constants/admin-setting/email-template.constants';
import { EmailTemplateService } from '../../../../../../../../../../app/services/admin-setting/email-template/email-template.service';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';

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

  EmailID: string = '';
  EmailSubject: string = '';
  questionSet: any[] = [];

  categoryRows: any[] = [];

  showHtml = false;

  modules = {
    toolbar: [
      ['bold','italic','underline'],
      [{ header: [1,2,3,false] }],
      [{ 'align': [] }],
      ['link', 'code-block'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['image']
    ]
  };

  formats = [
    'header', 'bold', 'italic', 'underline',
    'align',
    'list',
    'link', 'image', 'code-block',
    'color', 'background', 'font', 'size'
  ];

  constructor(
    private emailTemplateService: EmailTemplateService,
    private route: ActivatedRoute,
    private fb: FormBuilder,
  ) { }

  ngOnInit() {
    this.initializeForm();

    // this.route.queryParams.subscribe(params => {
    //   this.EmailID = params['id'] || '';
    //   this.EmailSubject = params['subject'] || '';

    //   if (this.EmailID) this.fetchEmailIDsDetails();
    // });

     this.route.queryParams.subscribe(params => {
      this.EmailID = params['id'] || '';      
      this.fetchEmailIDsDetails();
    });

    this.formDetails.disable({ emitEvent: false });
    this.setActionButtons('view');

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
    const ctrl = this.formDetails.get('activeStatus');
    const current = !!ctrl?.value;
    ctrl?.setValue(!current);
    ctrl?.markAsDirty();
    ctrl?.markAsTouched();
  }

  onAddClicked() {
    console.log('Add Category clicked');
  }

  fetchEmailIDsDetails() {
    this.emailTemplateService.getEmailTemplateById(this.EmailID).subscribe({
      next: (response) => {
        this.formDetails.patchValue({
          subject: response[0].subject,
          emailContent: response[0].message || ''
        }, { emitEvent: false });
        this.initialSnapshot = this.formDetails.getRawValue();
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
        this.formDetails.patchValue({
          subject: response[0].subject,
          emailContent: response[0].message || ''
        }, { emitEvent: false });
        this.initialSnapshot = this.formDetails.getRawValue();
        this.questionSet = response ?? [];
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit':
        this.setActionButtons('edit');
        this.onEditClicked();
        this.isEditing = true
        this.formDetails.enable();
        break;
      case 'save':
        this.onSaveClicked()
        break;
    }
  }

  onEditClicked() {
    console.log('Edit button clicked');
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
    const current = this.formDetails.getRawValue();
    return JSON.stringify(current) !== JSON.stringify(this.initialSnapshot);
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
      subject: value.subject,
      emailContent: value.emailContent
    };

    console.log('SAVE payload:', payload);
    // ปิดโหมดแก้ไข + รีเซ็ตสถานะปุ่ม
    this.isEditing = false;
    this.formDetails.disable({ emitEvent: false });

    // จับ snapshot ใหม่หลังเซฟสำเร็จ (ให้สถานะล่าสุดคือ baseline)
    this.initialSnapshot = this.formDetails.getRawValue();

    // กลับไปโหมด view: โชว์เฉพาะปุ่ม Edit
    this.setActionButtons('view');

    this.putEmailIDsDetails({
      subject: value.subject,
      message: value.emailContent
    })
  }

  getInlineStyledHtml() {
    const data = this.formDetails.get('emailContent')?.value;
    if (!data) return '';

    const container = document.createElement('div');
    container.innerHTML = data;

    container.querySelectorAll('[class*="ql-align-"]').forEach(el => {
      const element = el as HTMLElement;
      const classes = element.className.split(' ');
      classes.forEach(cls => {
        if (cls.startsWith('ql-align-')) {
          const align = cls.replace('ql-align-', '');
          element.style.textAlign = align;
          element.classList.remove(cls);
        }
      });
    });

    return container.innerHTML;
  }
}
