import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { defaultColumns, defaultFilterButtons } from '../../../../../../../app/constants/admin-setting/job-position.constants';
import { JobPositionService } from '../../../../../../../app/services/admin-setting/job-position/job-position.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-job-position',
  templateUrl: './job-position.component.html',
  styleUrl: './job-position.component.scss'
})
export class JobPositionComponent {
  rows: any[] = [];
  columns = defaultColumns();
  filterButtons = defaultFilterButtons();
  isAddingRow = false;

  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  hasOverflowY = false;
  private ro?: ResizeObserver;
    
  @Output() toggleRequested = new EventEmitter<{ row: any; next: boolean }>();

  constructor(
    private jobPositionService: JobPositionService,
    private router: Router,
  ) { }

  ngOnInit() {
    this.jobPositionService.setEMailType('job-position');
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
    this.jobPositionService.getAllJobTemplates().subscribe({
      next: (response) => {
        this.rows = (response.items ?? []).map((item: any, idx: number) => ({
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
      idjobPst: row.idjobPst
    }
    this.router.navigate(['/admin-setting/data-setting/manpower/job-position/details'], { queryParams });
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
        this.router.navigate(['/admin-setting/data-setting/manpower/job-position/details']);
        break;
    }
  }

  onToggleChange(e: Event, row: any) {
    const next = (e.target as HTMLInputElement).checked;
    (e.target as HTMLInputElement).checked = !next;
    this.toggleRequested.emit({ row, next });
  }

  onUserToggleRequested({
    row,
    checked,
    checkbox
  }: {
    row: any;
    checked: boolean;
    checkbox: HTMLInputElement;
  }) {
    this.jobPositionService.toggleStatus(row.idjobPst).subscribe({
      next: () => {
        checkbox.checked = checked;
        if ('isActive' in row) row.isActive = checked;
        if ('activeStatus' in row) row.activeStatus = checked;
      },
      error: () => {
        console.error('Toggle failed');
      }
    });
  }
}
