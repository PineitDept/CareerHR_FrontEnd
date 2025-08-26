import { Component } from '@angular/core';
import { defaultColumns, defaultFilterButtonsDetails } from '../../../../../../../../../app/constants/admin-setting/email-template.constants';
import { EmailTemplateService } from '../../../../../../../../../app/services/admin-setting/email-template/email-template.service';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { AlertDialogComponent } from '../../../../../../../../../app/shared/components/dialogs/alert-dialog/alert-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { NotificationService } from '../../../../../../../../shared/services/notification/notification.service';

@Component({
  selector: 'app-web-policy-details',
  templateUrl: './web-policy-details.component.html',
  styleUrl: './web-policy-details.component.scss'
})
export class WebPolicyDetailsComponent {
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

  fetchEmailIDsDetails() {
    this.emailTemplateService.getEmailTemplateById(this.EmailID).subscribe({
      next: (response) => {
        this.formDetails.patchValue({
          subject: response.subject,
          emailContent: response.message || ''
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
        // this.formDetails.patchValue({
        //   subject: response.subject,
        //   emailContent: response.message || ''
        // }, { emitEvent: false });
        this.setActionButtons('view');
        this.isEditing = false;
        this.formDetails.disable({ emitEvent: false });
        this.initialSnapshot = this.formDetails.getRawValue();

        this.questionSet = response ?? [];
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
        this.setActionButtons('edit');
        this.onEditClicked();
        this.isEditing = true;
        this.formDetails.enable();

        this.notificationService.error('Subject is required');
        this.fieldErrors = true;

        setTimeout(()=>{
          this.fieldErrors = false;
        },3000)
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
      emailContent: this.getInlineStyledHtml()
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
      message: this.getInlineStyledHtml()
    })
  }

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

    // ✅ FIX สำหรับรูปภาพที่ resize
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
}
