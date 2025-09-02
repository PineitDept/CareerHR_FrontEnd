import { Component, ElementRef, ViewChild } from '@angular/core';
import { Columns } from '../../../../../../shared/interfaces/tables/column.interface';
import { Router } from '@angular/router';
import { ReasonService } from '../../../../../../services/admin-setting/reason/reason.service';

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
      header: 'Process Name',
      field: 'stageName',
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
    private reasonService: ReasonService,
    private router: Router,
  ) { }

  ngOnInit() {
    // Initialization logic can go here
    this.fetchRecruitmentStages();
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

  fetchRecruitmentStages() {
    this.reasonService.getRecruitmentStages().subscribe({
      next: (response) => {
        console.log('RecruitmentStages fetched successfully:', response);
        this.recruitmentStagesRows = (response ?? []).map((item: any, idx: number) => ({
          ...item,
          activeStatus: item.isActive,
          no: idx + 1
        }));
        console.log('Processed recruitmentStagesRows:', this.recruitmentStagesRows);
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
      processName: row.stageName.split(' ').join('-'),
      processId: row.stageId
    }
    console.log('Navigating to details with params:', queryParams);
    this.router.navigate(['/admin-setting/data-setting/application/reason/details'], { queryParams });
  }

  ngOnDestroy() {
    this.ro?.disconnect?.();
  }
}
