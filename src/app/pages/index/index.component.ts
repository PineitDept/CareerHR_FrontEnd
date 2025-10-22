import { Component, computed, ElementRef, EventEmitter, Output, signal, ViewChild } from '@angular/core';
import { defaultColumns, defaultFilterButtons } from '../../constants/admin-setting/interviewer.constants';
import { InterviewerService } from '../../services/admin-setting/interviewer/interviewer.service';
import { Router } from '@angular/router';
import { AppointmentEvent, DateRange, SearchForm } from '../../interfaces/interview-scheduling/interview.interface';
import { FilterConfig, GroupedCheckboxOption } from '../../shared/components/filter-check-box/filter-check-box.component';
import { CalendarOptions } from '@fullcalendar/core/index.js';
import { AppointmentCalendarService } from '../../services/interview-scheduling/appointment-calendar/appointment-calendar.service';
import { ICandidateFilterRequest, TabMenu } from '../../interfaces/Application/application.interface';
import { IBenefitsFilterRequest } from '../../interfaces/admin-setting/general-benefits.interface';
import { Columns } from '../../shared/interfaces/tables/column.interface';
import { AppointmentsService } from '../../services/interview-scheduling/appointment-interview/appointments.service';
import { catchError, finalize, Observable, of, tap } from 'rxjs';
import { ApplicationService } from '../../services/application/application.service';

@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrl: './index.component.scss',
})
export class IndexComponent {
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
  eventDate: AppointmentEvent[] = [];
  filteredEvents: AppointmentEvent[] = [];


  // ---------- Signals & reactive states ----------
  createInitialTabs(): TabMenu[] {
    return [
      { key: 'pending', label: 'Screening', count: 0 },
      { key: 'pending1', label: 'Interview 1', count: 0 },
      { key: 'pending2', label: 'Interview 2', count: 0 },
      { key: 'pendingOffer', label: 'Offer', count: 0 },
    ];
  }

  protected currentFilterParams: IBenefitsFilterRequest = {
    page: 1,
    pageSize: 20
  };

  appointments: any[] = [];
  tabMenus = signal<TabMenu[]>(this.createInitialTabs());
  tabMenusComputed = computed(() => this.tabMenus());
  filterRequest = signal<ICandidateFilterRequest>(this.currentFilterParams);
  activeTab = computed(() => this.filterRequest().statusGroup || '');
  selectedTab = 'total';
  hasMoreData = true;
  loading = false;
  hasOverflowY = false;
  rows: any[] = [];
  ColumnClicked: any;

  totalItems: number | undefined
  interview1: number | undefined
  interview2: number | undefined
  hired: number | undefined

  readonly columns: Columns = [
    {
      header: 'Submit Date',
      field: 'submitDate',
      type: 'date',
      align: 'center',
      width: '10%'
    },
    {
      header: 'Applicant ID',
      field: 'userID',
      type: 'text',
      align: 'center',
      width: '15%'
    },
    {
      header: 'Applicant Name',
      field: 'fullName',
      type: 'text',
      width: '15%'
    },
    {
      header: 'Job Position',
      field: 'position',
      type: 'list',
      minWidth: '264px',
      wrapText: true,
    },
    // {
    //   header: 'University',
    //   field: 'university',
    //   type: 'text',
    //   minWidth: '264px',
    //   width: '16%',
    //   wrapText: true,
    // },
    // {
    //   header: 'GPA',
    //   field: 'gpa',
    //   type: 'text',
    //   align: 'center',
    //   width: '5%',
    // },
    {
      header: 'Grade',
      field: 'gradeCandidate',
      type: 'text',
      align: 'center',
      width: '5%',
    },
    {
      header: '',
      field: 'OfferResult',
      type: 'textlink',
      align: 'center',
      width: '15%',
      textlinkActions: ['view'],
      iconLink: 'pen-to-square'
    },
  ] as const;

  constructor(
    private interviewerService: InterviewerService,
    private appointmentCalendarService: AppointmentCalendarService,
    private router: Router,
    private appointmentsService: AppointmentsService,
    private applicationService: ApplicationService
  ) { }

  ngOnInit() {
    this.startDate = this.formatDate(new Date());
    this.fetchTeamID();

    this.appointmentsService.setAppointmentsType(3);
    // this.loadInitialStagePending(true);
    this.onTabChange('pending')
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

  currentPage = 1;

  loadInitialStagePending(updateTabCounts = false) {
    this.appointments = [];
    this.currentFilterParams.page = 1;

    this.fetchStagePending(updateTabCounts);
    this.fetchStageLastYear(true);
  }

  fetchStagePending(updateTabCounts = false, autoSubscribe = true): Observable<any> {
    if (!this.hasMoreData) return of(null);
    this.loading = true;

    const updatedParams = { ...this.currentFilterParams };

    const obs$ = this.applicationService.getTrackingApplications(updatedParams).pipe(
      tap((res: any) => {
        this.hasMoreData = res.hasNextPage ?? false;

        this.rows = (res.items ?? []).map((item: any) => ({
          ...item,
          id: String(item.userID),
          submitDate: item.submitDate || '',
          userID: String(item.userID),
          fullName: item.fullName,
          fullNameTH: item.fullNameTH,
          position: item.positions?.map((p: any) => p.namePosition) ?? [],
          university: item.university,
          gpa: item.gpa != null ? String(item.gpa) : '',
          gradeCandidate: item.gradeCandidate,
        }));

        this.totalItems = res.groupCounts?.received ?? 0;
        this.interview1 = res.groupCounts?.accept1 ?? 0;
        this.interview2 = res.groupCounts?.accept2 ?? 0;
        this.hired = res.groupCounts?.onboarded ?? 0;

        if (updateTabCounts && res.groupCounts) {
          this.updateTabCountsFromGroup(res.groupCounts);
        }
        
      }),
      catchError((err) => {
        console.error('Error fetching appointments:', err);
        return of(null);
      }),
      finalize(() => { this.loading = false; })
    );

    if (autoSubscribe) obs$.subscribe();
    return obs$;
  }

  fetchStageLastYear(autoSubscribe = true) {
    this.loading = true;
    const lastY = new Date().getFullYear().toString();
    const updatedParams = { ...this.currentFilterParams, year: lastY, status: '' };
    const obs$ = this.applicationService.getTrackingApplications(updatedParams).pipe(
      tap((res: any) => {
        this.totalItems = res.groupCounts?.received ?? 0;
        this.interview1 = res.groupCounts?.accept1 ?? 0;
        this.interview2 = res.groupCounts?.accept2 ?? 0;
        this.hired = res.groupCounts?.onboarded ?? 0;
      }),
      catchError((err) => {
        console.error('Error fetching appointments:', err);
        return of(null);
      }),
      finalize(() => { this.loading = false; })
    );

    if (autoSubscribe) obs$.subscribe();
    return obs$;
  }

  onCalendarDateChange(range: { year: number; month: number }) {
    this.fetchAppointment(range.year, range.month);
  }

  onDateRangeSelected(range: { startDate: string; endDate: string }) {
    this.startDate = range.startDate;
    this.endDate = range.endDate;

    const start = new Date(this.startDate);
    const year = start.getFullYear();
    const month = start.getMonth() + 1;

    this.fetchAppointment(year, month);
  }

  onTodayClick() { }

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

  toCalendar() {
    this.router.navigate(['/interview-scheduling/appointment-calendar']);
  }

  // Tab
  updateTabCounts(appointments: any[]) {
    const counts: { [key: string]: number } = {
      total: appointments.length,
      pending1: appointments.filter(a => a.result.interviewResult === 'hire-offer').length,
      pending2: appointments.filter(a => a.result.interviewResult === 'candidate-decline-offer').length,
      pendingOffer: appointments.filter(a => a.result.interviewResult === 'in-process').length
    };

    const newTabs = this.tabMenus().map(tab => ({
      ...tab,
      count: counts[tab.key] ?? 0
    }));

    this.tabMenus.set(newTabs);
  }

  updateTabCountsFromGroup(groupCounts: { [key: string]: number }) {
    const newTabs = this.tabMenus().map(tab => {
      let count = 0;

      switch (tab.key) {
        case 'pending':
          count = groupCounts['pending'] ?? 0;
          break;
        case 'pending1':
          count = groupCounts['pending1'] ?? 0;
          break;
        case 'pending2':
          count = groupCounts['pending2'] ?? 0;
          break;
        case 'pendingOffer':
          count = groupCounts['pendingOffer'] ?? 0;
          break;
      }

      return { ...tab, count };
    });
    
    this.tabMenus.set(newTabs);
  }

  onTabChange(tabKey: string): void {
    this.selectedTab = tabKey;
    this.currentFilterParams.page = 1;
    this.hasMoreData = true;

    const base: any = {
      page: 1,
      pageSize: 20
    };

    if (tabKey === 'pending') base.status = 'pending';
    else if (tabKey === 'pending1') base.interview1 = [12];
    else if (tabKey === 'pending2') base.interview2 = [12];
    else if (tabKey === 'pendingOffer') base.offer = [12];

    this.filterRequest.set(base);
    this.currentFilterParams = base;

    this.rows = [];
    if (tabKey === 'pending') {
      this.loadInitialStagePending(true);
    } else {
      this.loadInitialStagePending(false);
    }
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLElement;

    const scrollPosition = element.scrollTop + element.clientHeight;
    const threshold = element.scrollHeight - 50;

    if (scrollPosition >= threshold && !this.loading && this.hasMoreData) {
      this.loadMoreAppointments();
    }
  }

  loadMoreAppointments() {
    if (!this.hasMoreData || this.loading) return;

    this.loading = true;
    this.currentFilterParams.page = (this.currentFilterParams.page ?? 1) + 1;

    const updatedParams = { ...this.currentFilterParams };

    this.applicationService.getTrackingApplications(updatedParams).subscribe({
      next: (res: any) => {
        const newItems = res.items ?? [];
        const mapped = newItems.map((item: any) => ({
          ...item,
          id: String(item.userID),
          submitDate: item.submitDate || '',
          userID: String(item.userID),
          fullName: item.fullName,
          fullNameTH: item.fullNameTH,
          position: item.positions?.map((p: any) => p.namePosition) ?? [],
          university: item.university,
          gpa: item.gpa != null ? String(item.gpa) : '',
          gradeCandidate: item.gradeCandidate,
        }));

        this.rows = [...this.rows, ...mapped];

        if (newItems.length < Number(this.currentFilterParams.pageSize)) {
          this.hasMoreData = false;
        }
      },
      error: (err) => {
        console.error('Load more failed:', err);
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  getStatusClasses(status: string): string[] {
    switch (status) {
      case 'overweek':
        return ['tw-bg-red-900', 'tw-text-white', 'tw-ring-red-900/10'];
      case 'overmonth':
        return ['tw-bg-red-900', 'tw-text-white', 'tw-ring-red-900/10'];
      case 'over3day':
        return ['tw-bg-yellow-400', 'tw-text-black', 'tw-ring-yellow-500/10'];
      default:
        return ['tw-bg-green-500', 'tw-text-white', 'tw-ring-green-500/10'];
    }
  }

  formatCreateDateTimeDMY(dateString: string) {
    const date = new Date(dateString);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    const formattedDate = `${day}/${month}/${year}`;

    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return { formattedDate, formattedTime };
  }

  // table
  handleColumnRowClick(event: { column: any; row: any }) {
    this.ColumnClicked = event.column;
    this.onViewRowClicked(event.row);
  }

  onViewRowClicked(row: any) {
    const queryParams = {
      id: row.userID
    };

    if (this.selectedTab === 'pending') this.router.navigate(['/applications/screening/application-form'], { queryParams });
    else if (this.selectedTab === 'pending1') this.router.navigate(['/interview-scheduling/interview-round-1'], { queryParams });
    else if (this.selectedTab === 'pending2') this.router.navigate(['/interview-scheduling/interview-round-2'], { queryParams });
    else if (this.selectedTab === 'pendingOffer') this.router.navigate(['/offer-employment'], { queryParams });
    ;
  }
}
