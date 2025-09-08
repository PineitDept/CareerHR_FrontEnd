import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { defaultColumns, defaultFilterButtons } from '../../../../../../../app/constants/admin-setting/interviewer.constants';
import { InterviewerService } from '../../../../../../../app/services/admin-setting/interviewer/interviewer.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-interviewer-teams',
  templateUrl: './interviewer-teams.component.html',
  styleUrl: './interviewer-teams.component.scss'
})
export class InterviewerTeamsComponent {
  rows: any[] = [];
  columns = defaultColumns();
  filterButtons = defaultFilterButtons();
  isAddingRow = false;

  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  hasOverflowY = false;
  private ro?: ResizeObserver;
    
  @Output() toggleRequested = new EventEmitter<{ row: any; next: boolean }>();

  constructor(
    private interviewerService: InterviewerService,
    private router: Router,
  ) { }

  ngOnInit() {
    this.fetchTeamID();
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

  fetchTeamID() {
    this.interviewerService.getAllTeams().subscribe({
      next: (response) => {
        this.rows = (response.items ?? []).map((item: any, idx: number) => ({
          ...item,
          activeStatus: item.isActive,
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
      teamId: row.teamId
    }
    this.router.navigate(['/admin-setting/data-setting/interviewer/interviewer-teams/details'], { queryParams });
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
        this.router.navigate(['/admin-setting/data-setting/interviewer/interviewer-teams/details']);
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
    const payload = {teamName: row.teamName, isActive: checked}
    this.interviewerService.updateTeam(row.teamId, payload).subscribe({
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