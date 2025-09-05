import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { defaultColumns, defaultFilterButtons } from '../../../constants/admin-setting/interviewer.constants';
import { InterviewerService } from '../../../services/admin-setting/interviewer/interviewer.service';
import { Router } from '@angular/router';
import { AppointmentEvent, DateRange, SearchForm } from '../../../interfaces/interview-scheduling/interview.interface';
import { FilterConfig, GroupedCheckboxOption } from '../../../shared/components/filter-check-box/filter-check-box.component';
import { CalendarOptions } from '@fullcalendar/core/index.js';
import { AppointmentCalendarService } from '../../../services/interview-scheduling/appointment-calendar/appointment-calendar.service';

@Component({
  selector: 'app-appointment-calendar',
  templateUrl: './appointment-calendar.component.html',
  styleUrl: './appointment-calendar.component.scss'
})
export class AppointmentCalendarComponent {
  filterDateRange: DateRange = { month: '', year: '' };
  startDate = '';
  endDate = '';
  dateRangeInitialized = false;

  lastSelectedFilters: Record<string, string[]> = {};

  filterItems: GroupedCheckboxOption[] = [
    {
      groupKey: 'ScheduledType',
      groupLabel: 'Scheduled Type',
      options: [
        { key: 'all', label: 'All' },
        { key: '1', label: 'Interview 1' },
        { key: '2', label: 'Interview 2' },
        { key: '3', label: 'Onboarded' }
      ],
    },
    {
      groupKey: 'InterviewTeam',
      groupLabel: 'Interview Team',
      options: [],
    }
  ];

  filterConfig: FilterConfig = {
    expandAllByDefault: true,
    animationDuration: 300,
  };

  calendarOptions: CalendarOptions | undefined;
  // eventDate = [
  //   {
  //     user: 'Kitti Wiratgate',
  //     teamId: 1,
  //     teamName: 'Team A',
  //     time: '10:00',
  //     date: '2025-09-01',
  //     interview: 'interview1',
  //     status: 'pending'
  //   },
  //   {
  //     user: 'Poschanan Thongsri',
  //     teamId: 2,
  //     teamName: 'Team B',
  //     time: '14:00',
  //     date: '2025-09-03',
  //     interview: 'interview2',
  //     status: 'rescheduled'
  //   },
  //   {
  //     user: 'Pattanan Chongsermklang',
  //     teamId: 4,
  //     teamName: 'Team C',
  //     time: '10:00',
  //     date: '2025-09-03',
  //     interview: 'interview2',
  //     status: 'pending'
  //   },
  //   {
  //     user: 'Pannatorn Ditkham',
  //     teamId: 4,
  //     teamName: 'Team C',
  //     time: '10:00',
  //     date: '2025-08-23',
  //     interview: 'interview2',
  //     status: 'pending'
  //   },
  //   {
  //     user: 'Nanthiya Kiattiphongwiriya',
  //     teamId: 1,
  //     teamName: 'Team A',
  //     time: '10:30',
  //     date: '2025-09-04',
  //     interview: 'onboarded',
  //     status: 'interviewed'
  //   },
  //   {
  //     user: 'Poschanan Thongsri',
  //     teamId: 5,
  //     teamName: 'Team D',
  //     time: '13:00',
  //     date: '2025-09-24',
  //     interview: 'interview1',
  //     status: 'pending'
  //   },
  //   {
  //     user: 'Luamdaun Thongkhamho',
  //     teamId: 1,
  //     teamName: '',
  //     time: '08:00',
  //     date: '2025-10-01',
  //     interview: 'onboarded',
  //     status: 'interviewed'
  //   }
  // ]

  eventDate: AppointmentEvent[] = [];
  filteredEvents: AppointmentEvent[] = [];

  constructor(
    private interviewerService: InterviewerService,
    private appointmentCalendarService: AppointmentCalendarService,
    private router: Router,
  ) { }

  ngOnInit() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    this.fetchTeamID();
    // this.fetchAppointment(currentYear, currentMonth);
  }

  fetchTeamID() {
    this.interviewerService.getAllTeams().subscribe({
      next: (response) => {
        const teamItems = response.items || [];

        const teamOptions = teamItems.map((item: any) => ({
          key: String(item.teamId),
          label: item.teamName
        }));

        const finalTeamOptions = [
          { key: 'all', label: 'All' },
          ...teamOptions
        ];

        this.filterItems = this.filterItems.map(filterItem => {
          if (filterItem.groupKey === 'InterviewTeam') {
            return { ...filterItem, options: finalTeamOptions };
          }
          return filterItem;
        });
      },
      error: (error) => {
        console.error('Error fetching teams:', error);
      }
    });
  }

  fetchAppointment(year: number, month: number) {
    this.appointmentCalendarService.getInterviewAppointments(year, month).subscribe({
      next: (res) => {
        this.eventDate = res;
        this.applyFilters();
      },
      error: (err) => {
        console.error('Error fetching appointments', err);
      }
    });
  }


  onDateRangeSelected(range: { startDate: string; endDate: string }) {
    this.startDate = range.startDate;
    this.endDate = range.endDate;

    const start = new Date(this.startDate);
    const year = start.getFullYear();
    const month = start.getMonth() + 1;

    this.fetchAppointment(year, month);
  }

  onTodayClick() {}

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onFiltersSelected(filters: Record<string, string[]>) {
    this.lastSelectedFilters = filters;
    this.applyFilters();
  }

  applyFilters() {
    const filters = this.lastSelectedFilters;
    let tempFilteredEvents = [...this.eventDate];
    const scheduledTypeFilter = filters['ScheduledType'];
    const interviewTeamFilter = filters['InterviewTeam'];

    this.filteredEvents = tempFilteredEvents.filter(event => {
      let scheduledTypeMatch = true;
      let interviewTeamMatch = true;

      if (
        scheduledTypeFilter &&
        scheduledTypeFilter.length > 0 &&
        !scheduledTypeFilter.includes('all')
      ) {
        scheduledTypeMatch = scheduledTypeFilter.map(str => +str).includes(event.interview);
      }

      if (
        interviewTeamFilter &&
        interviewTeamFilter.length > 0 &&
        !interviewTeamFilter.includes('all') &&
        event.teamId !== undefined
      ) {
        interviewTeamMatch = interviewTeamFilter.map(str => +str).includes(event.teamId);
      }

      return scheduledTypeMatch && interviewTeamMatch;
    });
  }


}
