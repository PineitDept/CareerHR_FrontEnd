import { ChangeDetectorRef, Component, computed, ElementRef, EventEmitter, Output, signal, ViewChild } from '@angular/core';
import { defaultColumns, defaultFilterButtons } from '../../../constants/admin-setting/interviewer.constants';
import { InterviewerService } from '../../../services/admin-setting/interviewer/interviewer.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DateRange, SearchForm } from '../../../interfaces/interview-scheduling/interview.interface';
import { FilterConfig, GroupedCheckboxOption } from '../../../shared/components/filter-check-box/filter-check-box.component';
import { CalendarOptions } from '@fullcalendar/core/index.js';
import { defaultColumnsPolicy } from '../../../constants/admin-setting/email-template.constants';
import { TabMenu } from '../../../interfaces/Application/application.interface';
import { DropdownOption } from '../../../shared/components/cdk-dropdown/cdk-dropdown.component';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogComponent } from '../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { forkJoin } from 'rxjs';
import { SelectDialogComponent } from '../../../shared/components/dialogs/select-dialog/select-dialog.component';

const SEARCH_OPTIONS: string[] = [
  'Applicant ID',
  'Applicant Name'
] as const;

@Component({
  selector: 'app-interview-round-1',
  templateUrl: './interview-round-1.component.html',
  styleUrl: './interview-round-1.component.scss'
})

export class InterviewRound1Component {
  slideConfig = {
    variableWidth: true,
    slidesPerView: 'auto',
    spaceBetween: 16,
    freeMode: true,
    infinite: false,
    arrows: true
  };

  educationOptions: DropdownOption[] = [
    { label: "Bachelor's Degree or Higher", value: 'BD' },
    { label: "Master's Degree or Higher", value: 'MD' },
    { label: "High School or Higher", value: 'HS' },
  ];

  workingOptions: DropdownOption[] = [
    { label: 'Full Time', value: 61 },
    { label: 'Part Time', value: 62 },
    { label: 'Contract', value: 63 },
  ];

  searchByOptions = SEARCH_OPTIONS;
  searchForm: SearchForm = { searchBy: '', searchValue: '' };

  filterDateRange: DateRange = { month: '', year: '' };
  startDate = '';
  endDate = '';
  dateRangeInitialized = false;

  tabMenus = computed(() => this.tabMenusData());
  tabMenusData = signal<TabMenu[]>(this.createInitialTabs());

  protected createInitialTabs(): TabMenu[] {
    return [
      { key: 'total', label: 'All Status', count: 0 },
      { key: 'pending', label: 'Pending', count: 0 },
      { key: 'scheduled', label: 'Scheduled', count: 0 },
      { key: 'no-show', label: 'No-Show', count: 0 },
      { key: 'accept', label: 'Accept', count: 0 },
      { key: 'decline', label: 'Decline', count: 0 },
    ];
  }

  rows: any[] = [];
  columns = defaultColumnsPolicy();
  hasOverflowY = false;

  filterItems: GroupedCheckboxOption[] = [
    {
      groupKey: 'ScheduledType',
      groupLabel: 'Scheduled Type',
      options: [
        { key: 'all', label: 'All' },
        { key: 'interview1', label: 'Interview 1' },
        { key: 'interview2', label: 'Interview 2' },
        { key: 'onboarded', label: 'Onboarded' }
      ],
    },
    {
      groupKey: 'InterviewTeam',
      groupLabel: 'Interview Team',
      options: [
        { key: 'all', label: 'All' },
        { key: 'Team A', label: 'Team A' },
        { key: 'Team B', label: 'Team B' },
        { key: 'Team C', label: 'Team C' }
      ],
    }
  ];

  filterConfig: FilterConfig = {
    expandAllByDefault: true,
    animationDuration: 300,
  };

  calendarOptions: CalendarOptions | undefined;
  eventDate = [
    {
      user: 'Kitti Wiratgate',
      teaminterview: 'Team A',
      time: '10:00',
      date: '2025-09-01',
      interview: 'interview1',
      status: 'pending'
    },
    {
      user: 'Poschanan Thongsri',
      teaminterview: 'Team B',
      time: '14:00',
      date: '2025-09-03',
      interview: 'interview2',
      status: 'rescheduled'
    },
    {
      user: 'Pattanan Chongsermklang',
      teaminterview: 'Team C',
      time: '10:00',
      date: '2025-09-03',
      interview: 'interview2',
      status: 'pending'
    },
    {
      user: 'Nanthiya Kiattiphongwiriya',
      teaminterview: 'Team A',
      time: '10:30',
      date: '2025-09-04',
      interview: 'onboarded',
      status: 'interviewed'
    }
  ]
  filteredEvents = this.eventDate;

  constructor(
    private interviewerService: InterviewerService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) { }

  // fetchTeamID() {
  //   this.interviewerService.getAllTeams().subscribe({
  //     next: (response) => {
  //       this.rows = (response.items ?? []).map((item: any, idx: number) => ({
  //         ...item,
  //         activeStatus: item.isActive,
  //         no: idx + 1
  //       }));
  //       queueMicrotask(() => this.measureOverflow());
  //     },
  //     error: (error) => {
  //       console.error('Error fetching category types:', error);
  //     }
  //   });
  // }

  // onSearch(form: SearchForm): void {
  //   // this.searchSubject.next(form);
  //   this.searchForm = form;
  //   this.persistSearchForm(this.searchForm);
  //   this.searchSubject.next({
  //     ...form,
  //     __marker: Date.now()
  //   } as any);
  // }

  onDateRangeSelected(range: { startDate: string; endDate: string }) {
    this.startDate = range.startDate;
    this.endDate = range.endDate;
  }

  onFilterChange(event: Event) {
    const selectedValue = (event.target as HTMLSelectElement).value;

    if (selectedValue === 'all') {
      this.filteredEvents = this.eventDate;
    } else {
      this.filteredEvents = this.eventDate.filter(
        (event) => event.interview === selectedValue
      );
    }
  }

  onFiltersSelected(filters: Record<string, string[]>): void {
    let tempFilteredEvents = [...this.eventDate];
    const scheduledTypeFilter = filters['ScheduledType'];
    const interviewTeamFilter = filters['InterviewTeam'];

    this.filteredEvents = tempFilteredEvents.filter(event => {
      let scheduledTypeMatch = true;
      let interviewTeamMatch = true;

      if (scheduledTypeFilter && scheduledTypeFilter.length > 0 && !scheduledTypeFilter.includes('all')) {
        scheduledTypeMatch = scheduledTypeFilter.includes(event.interview);
      }

      if (interviewTeamFilter && interviewTeamFilter.length > 0 && !interviewTeamFilter.includes('all')) {
        interviewTeamMatch = interviewTeamFilter.includes(event.teaminterview);
      }

      return scheduledTypeMatch && interviewTeamMatch;
    });
  }

























  formDetails!: FormGroup;
  dataOptions = [
    { value: 1, label: 'AAAAA' },
    { value: 2, label: 'BBBBB' },
    { value: 3, label: 'CCCCC' },
    { value: 4, label: 'DDDDD' },
  ]
  dropdownConfigs: any[] = []

  ngOnInit() {
    // this.fetchTeamID();
    this.dropdownConfigs = [
      {
        type: 'single',
        label: 'Position',
        placeholder: 'Position',
        options: this.dataOptions,
      },
      {
        type: 'multi',
        label: 'History',
        options: this.dataOptions,
      }
    ];
  }

  onAdPoscitionClick() {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(SelectDialogComponent, {
      width: '480px',
      data: {
        title: 'Job Position',
        quality: 0,
        confirm: true,
        options: this.dataOptions,
        dropdownConfigs: this.dropdownConfigs
      }
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (result) {
        console.log('Selected values from dialog:', result);
      }
    });
  }

}
