import { Component, ElementRef, ViewChild } from '@angular/core';
import { Columns } from '../../../../../../shared/interfaces/tables/column.interface';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reason',
  templateUrl: './reason.component.html',
  styleUrl: './reason.component.scss'
})
export class ReasonComponent {
  recruitmentStagesRows: any[] = [];
  recruitmentStagesColumns: Columns = [
    {
      header: 'No.',
      field: '__index',
      type: 'text',
      align: 'center',
      width: '10%',
    },
    {
      header: 'Category Type',
      field: 'categoryType',
      type: 'text',
      width: '60%',
    },
    {
      header: 'Status',
      field: 'activeStatus',
      type: 'toggle',
      align: 'center',
      width: '15%',
    },
    {
      header: 'Action',
      field: 'textlink',
      type: 'textlink',
      align: 'center',
      width: '15%',
      textlinkActions: ['view'],
    }
  ];

  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  hasOverflowY = false;
  private ro?: ResizeObserver;

  constructor(
    // private applicationQuestionService: ApplicationQuestionService,
    private router: Router,
  ) { }

  ngOnInit() {
    // Initialization logic can go here
    // this.fetchCategoryTypes();
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

  onViewRowClicked(row: any) {
    console.log('View row clicked:', row);
    // const queryParams = {
    //   categoryType: row.categoryType
    // }
    // console.log('Navigating to details with params:', queryParams);
    // this.router.navigate(['/admin-setting/data-setting/application/application-question/details'], { queryParams });
  }

  ngOnDestroy() {
    this.ro?.disconnect?.();
  }
}
