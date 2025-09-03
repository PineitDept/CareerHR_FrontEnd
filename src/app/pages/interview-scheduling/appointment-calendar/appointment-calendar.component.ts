import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { defaultColumns, defaultFilterButtons } from '../../../constants/admin-setting/interviewer.constants';
import { InterviewerService } from '../../../services/admin-setting/interviewer/interviewer.service';
import { Router } from '@angular/router';
import { DateRange, SearchForm } from '../../../interfaces/interview-scheduling/interview.interface';
import { FilterConfig, GroupedCheckboxOption } from '../../../shared/components/filter-check-box/filter-check-box.component';
import { CalendarOptions } from '@fullcalendar/core/index.js';

const SEARCH_OPTIONS: string[] = [
  'University',
  'University ID'
] as const;

@Component({
  selector: 'app-appointment-calendar',
  templateUrl: './appointment-calendar.component.html',
  styleUrl: './appointment-calendar.component.scss'
})
export class AppointmentCalendarComponent {
  searchByOptions = SEARCH_OPTIONS;
  searchForm: SearchForm = { searchBy: '', searchValue: '' };

  filterDateRange: DateRange = { month: '', year: '' };
  startDate = '';
  endDate = '';
  dateRangeInitialized = false;

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
  ) { }

  ngOnInit() {
    // this.fetchTeamID();
  }

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
  
}
