import { Component, ElementRef, ViewChild } from '@angular/core';
import { defaultColumns, defaultFilterButtons } from '../../../../../../../../app/constants/admin-setting/email-template.constants';
import { EmailTemplateService } from '../../../../../../../services/admin-setting/email-template/email-template.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-email-template',
  templateUrl: './email-template.component.html',
  styleUrls: ['./email-template.component.scss']
})
export class EmailTemplateComponent {
  rows: any[] = [];
  columns = defaultColumns();
  filterButtons = defaultFilterButtons();

  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  hasOverflowY = false;
  private ro?: ResizeObserver;

  constructor(
    private emailTemplateService: EmailTemplateService,
    private router: Router,
  ) { }

  ngOnInit() {
    this.fetchEmailID();
  }

  ngAfterViewInit(): void {
    this.measureOverflow();

    this.ro = new ResizeObserver(() => this.measureOverflow());
    this.ro.observe(this.scrollArea.nativeElement);
  }

  measureOverflow(): void {
    const el = this.scrollArea.nativeElement;
    this.hasOverflowY = el.scrollHeight > el.clientHeight;
  }

  fetchEmailID() {
    this.emailTemplateService.getAllEmailTemplates().subscribe({
      next: (response) => {
        this.rows = (response ?? []).map((item: any, idx: number) => ({
          ...item,
          activeStatus: true,
          no: idx + 1
        }));
        queueMicrotask(() => this.measureOverflow());
      },
      error: (error) => {
        console.error('Error fetching category types:', error);
      }
    });
  }

  onViewRowClicked(row: any) {
    const queryParams = {
      id: row.id
    }
    this.router.navigate(['/admin-setting/data-setting/application/email/email-template/details'], { queryParams });
  }

  
  onRowClick(row: any): void {
    console.log('Row clicked:', row);
  }

  ngOnDestroy() {
    this.ro?.disconnect?.();
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'add':
        this.router.navigate(['/admin-setting/data-setting/application/email/email-template/details']);
        break;
    }
  }
}
