import { Component, ElementRef, ViewChild } from '@angular/core';
import { defaultColumns } from '../../../../../../constants/admin-setting/application-question.constants';
import { ApplicationQuestionService } from '../../../../../../services/admin-setting/application-question/application-question.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-application-question',
  templateUrl: './application-question.component.html',
  styleUrl: './application-question.component.scss'
})
export class ApplicationQuestionComponent {

  rows: any[] = [];
  columns = defaultColumns();

  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  hasOverflowY = false;
  private ro?: ResizeObserver;

  constructor(
    private applicationQuestionService: ApplicationQuestionService,
    private router: Router,
  ) { }

  ngOnInit() {
    // Initialization logic can go here
    this.fetchCategoryTypes();
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

  fetchCategoryTypes() {
    this.applicationQuestionService.getCategoryTypesInfoQuestion().subscribe({
      next: (response) => {
        console.log('Category types fetched successfully:', response);
        this.rows = (response ?? []).map((item: any, idx: number) => ({
          ...item,
          activeStatus: true,
          no: idx + 1
        }));
        console.log('Processed rows:', this.rows);
        queueMicrotask(() => this.measureOverflow());
      },
      error: (error) => {
        console.error('Error fetching category types:', error);
      }
    });
  }

  onViewRowClicked(row: any) {
    console.log('View row clicked:', row);
    const queryParams = {
      categoryType: row.categoryType
    }
    console.log('Navigating to details with params:', queryParams);
    this.router.navigate(['/admin-setting/data-setting/application/application-question/details'], { queryParams });
  }

  ngOnDestroy() {
    this.ro?.disconnect?.();
  }
}
