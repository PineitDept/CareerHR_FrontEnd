import { ChangeDetectorRef, Component, computed, ElementRef, QueryList, signal, ViewChild, ViewChildren } from '@angular/core';
import { InterviewerService } from '../../../../../services/admin-setting/interviewer/interviewer.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DateRange, SearchForm } from '../../../../../interfaces/interview-scheduling/interview.interface';
import { ICandidateFilterRequest, TabMenu } from '../../../../../interfaces/Application/application.interface';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { SelectDialogComponent, SelectOption } from '../../../../../shared/components/dialogs/select-dialog/select-dialog.component';
import { GeneralBenefitsService } from '../../../../../services/admin-setting/general-benefits/general-benefits.service';
import { IApiResponse, IBenefitsFilterRequest, IUniversityWithPositionsDto } from '../../../../../interfaces/admin-setting/general-benefits.interface';
import { JobPositionService } from '../../../../../services/admin-setting/job-position/job-position.service';
import { SlickCarouselComponent } from 'ngx-slick-carousel';
import { MailDialogComponent } from '../../../../../shared/components/dialogs/mail-dialog/mail-dialog.component';
import { AppointmentsService } from '../../../../../services/interview-scheduling/appointment-interview/appointments.service';
import { AlertDialogComponent } from '../../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { BehaviorSubject, catchError, finalize, forkJoin, map, Observable, of, Subject, takeUntil, tap } from 'rxjs';
import { NotificationService } from '../../../../../shared/services/notification/notification.service';

const SEARCH_OPTIONS: string[] = [
  'Applicant ID',
  'Applicant Name'
] as const;

@Component({
  selector: 'app-interview-round-2-history',
  templateUrl: './interview-round-2-history.component.html',
  styleUrl: './interview-round-2-history.component.scss'
})
export class InterviewRound2HistoryComponent {

  createInitialTabs(): TabMenu[] {
    return [
      { key: 'total', label: 'All Status', count: 0 },
      { key: 'pass-interview', label: 'Accept', count: 0 },
      { key: 'not-pass-interview', label: 'Company Decline', count: 0 },
      { key: 'no-show', label: 'No Show', count: 0 },
      { key: 'candidate-decline-interview', label: 'Applicants Decline', count: 0 },
      { key: 'on-hold', label: 'On Hold', count: 0 },
      // { key: 'hire-offer', label: 'Hire Offer', count: 0 },
      // { key: 'candidate-decline-offer', label: 'Not Hire Offer', count: 0 },
    ];
  }

  protected currentFilterParams: IBenefitsFilterRequest = {
    page: 1,
    pageSize: 5,
  };

  // ---------- Signals & reactive states ----------
  tabMenus = signal<TabMenu[]>(this.createInitialTabs());
  tabMenusComputed = computed(() => this.tabMenus());
  filterRequest = signal<ICandidateFilterRequest>(this.currentFilterParams);
  activeTab = computed(() => this.filterRequest().statusGroup || '');

  // ---------- Forms & search ----------
  searchByOptions = SEARCH_OPTIONS;
  searchForm: SearchForm = { searchBy: '', searchValue: '' };

  // ---------- Date range ----------
  filterDateRange: DateRange = { month: '', year: '' };
  startDate = '';
  endDate = '';
  dateRangeInitialized = false;
  yearData: number | undefined;
  monthData: number | undefined;
  today: string | undefined;

  // ---------- Tabs / filters ----------
  selectedTab = 'total';
  filterButtons: {
    label: string;
    key: string;
    color?: string;
    textColor?: string;
    borderColor?: string;
    outlineBtn?: boolean;
    options?: Array<{ label: string; value: any }>;
  }[] = [];

  // ---------- Dropdown data sources ----------
  locationsList: any;
  jobpositionList: any;
  teamList: any;
  interviewerList: any;
  revisionList: any;
  teamName = "Team"
  teamUser = 0

  // ---------- Appointments / UI state ----------
  appointments: any[] = [];
  isDeclined = false;
  loading = false;
  hasMoreData = true;
  canAddPos = true

  // ---------- Carousel controls ----------
  currentSlide: number[] = [];
  totalSlides: number[] = [];
  canGoPrev: boolean[] = [];
  canGoNext: boolean[] = [];

  // ---------- Dialogs / dynamic dropdown config ----------
  dropdownConfigs: any[] = [];
  formDetails!: FormGroup;
  dataOptions: any[] = [];

  // ---------- Demo/static option data ----------
  dataStatusCall: any[] = [];
  dataStatusCallFirst: any[] = [];
  dataStatusCallSecond: any[] = [];
  historyData: any[] = [];

  selectedPositions: { label: string; value: number }[] = [];

  jobPositions: {
    jobId: number,
    jobName: string,
    isActive: boolean,
    isOffered: boolean
  }[] = [];

  // ---------- Carousel config ----------
  slideConfig = {
    slidesToShow: 4,
    slidesToScroll: 1,
    infinite: false,
    arrows: false,
    responsive: [
      {
        breakpoint: 1800,
        settings: { slidesToShow: 3 }
      },
      {
        breakpoint: 1200,
        settings: { slidesToShow: 2 }
      },
      {
        breakpoint: 768,
        settings: { slidesToShow: 1 }
      }
    ]
  };

  @ViewChildren('slickCarousel') carousels!: QueryList<SlickCarouselComponent>;
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  private dateSaveTimers: Record<string, any> = {};
  private lastSubmittedDate: Record<string, string> = {};
  private destroy$ = new Subject<void>();
  applicantId: number = 0;

  // ---------- Constructor ----------
  constructor(
    private interviewerService: InterviewerService,
    private router: Router,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private benefitsService: GeneralBenefitsService,
    private jobPositionService: JobPositionService,
    private appointmentsService: AppointmentsService,
    private notificationService: NotificationService,
    private route: ActivatedRoute,
  ) { }

  // ---------- Lifecycle ----------
  ngOnInit() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    this.today = `${year}-${month}-${day}`;

    this.appointmentsService.setAppointmentsType(2);

    const savedSearch = sessionStorage.getItem('interviewSearchForm2History');
    if (savedSearch) {
      this.searchForm = JSON.parse(savedSearch);
      this.currentFilterParams = {
        ...this.currentFilterParams,
        search: this.searchForm.searchValue,
        page: 1,
      };
    }

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applicantId = Number(params['id'] || 0);

        if (this.applicantId) {
          this.currentFilterParams = {
            ...this.currentFilterParams,
            search: String(this.applicantId),
            page: 1,
          };
        }
      });

    this.fetchLocationDetails();
    this.fetchJobPosition();
    this.fetchTeamID();
    this.fetchInterviewer();
    this.fetchStatusCall();

    this.filterButtons = [{
      label: 'Scheduled', key: 'back', outlineBtn: true,
      color: '#FFFFFF',
      textColor: '#000000',
      borderColor: '#000000',
    }];
  }

  // ---------- Data fetching ----------
  fetchLocationDetails() {
    this.benefitsService.setBenefitType('location');
    this.benefitsService.getBenefitsWeb<IApiResponse<IUniversityWithPositionsDto>>(this.currentFilterParams).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.items ?? (res as any)?.data ?? []);
        const activeLocations = (list as any[]).filter(x => x?.isActive !== false);

        this.locationsList = activeLocations.map(loc => ({
          label: loc.locationName,
          value: loc.locationId
        }));
      },
      error: (error) => {
        console.error('Error fetching location details:', error);
      },
    });
  }

  fetchJobPosition() {
    this.jobPositionService.setEMailType('job-position');
    this.jobPositionService.getAllJobTemplates().subscribe({
      next: (res) => {
        const list = res.items ?? [];

        const filteredPositions = (list as any[]).filter(x =>
          x?.isActive !== false && x?.status === 31
        );

        this.jobpositionList = filteredPositions.map(loc => ({
          label: loc.namePosition,
          value: loc.idjobPst
        }));
      },
      error: (error) => {
        console.error('Error fetching category types:', error);
      }
    });
  }

  fetchTeamID() {
    this.interviewerService.getAllTeams().subscribe({
      next: (res) => {
        const list = res.items ?? [];

        const filteredTeam = (list as any[]).filter(x => x?.isActive !== false);

        this.teamList = filteredTeam.map(loc => ({
          label: loc.teamName,
          value: loc.teamId
        }));
      },
      error: (error) => {
        console.error('Error fetching category types:', error);
      }
    });
  }

  allInterviewers: Array<{ label: string; value: number }> = [];
  fetchInterviewer() {
    this.interviewerService.getAllInterviewers().subscribe({
      next: (res) => {
        const filtered = (res as any[])
          .filter(x => x?.isActive !== false)
          .map(loc => ({ label: loc.fullName, value: loc.idEmployee }));

        this.allInterviewers = filtered;
        this.interviewerList = [...filtered];
      },
      error: (error) => {
        console.error('Error fetching category types:', error);
      }
    });
  }

  fetchInterviewerByTeam(id: number) {
    this.interviewerService.getTeamById(id).subscribe({
      next: (res) => {
        this.interviewerList = this.allInterviewers.filter(
          (opt: { value: any; }) => !res.members.some((ex: { interviewerId: any; }) => ex.interviewerId === opt.value)
        );
        const nextConfigs = this.dropdownConfigs.map(cfg =>
          cfg.label === 'Interviewers' ? { ...cfg, options: [...this.interviewerList] } : cfg
        );
        this.dropdownConfigs$.next(nextConfigs);
      },
      error: (error) => {
        console.error('Error fetching category types:', error);
      }
    });
  }

  fetchTeamInterviewer(id: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.interviewerService.getTeamById(id).subscribe({
        next: (res) => resolve(res),
        error: (err) => {
          console.error('Error fetching team:', err);
          reject(err);
        }
      });
    });
  }

  fetchIDInterviewer(appointmentId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.appointmentsService.getInterviewer(appointmentId).subscribe({
        next: (res) => resolve(res),
        error: (err) => {
          console.error('Error fetching team:', err);
          reject(err);
        }
      });
    });
  }

  currentPage = 1;

  loadInitialAppointments(updateTabCounts = false) {
    this.appointments = [];
    this.currentFilterParams.page = 1;
    this.fetchAppointments(updateTabCounts);
  }

  fetchAppointments(updateTabCounts = false, autoSubscribe = true): Observable<any> {
    if (!this.hasMoreData) return of(null);

    this.loading = true;

    const updatedParams = {
      ...this.currentFilterParams,
      month: this.applicantId ? undefined : this.monthData,
      year: this.applicantId ? undefined : this.yearData,
      page: this.currentFilterParams.page ?? 1,
      search: this.applicantId ? String(this.applicantId) : this.currentFilterParams.search,
    };

    const obs$ = this.appointmentsService.getAppointmentsHistory<any>(updatedParams).pipe(
      tap((res) => {
        const newItems = res.items || [];
        this.appointments = [...this.appointments, ...newItems];

        if (newItems.length < Number(this.currentFilterParams.pageSize)) {
          this.hasMoreData = false;
        } else {
          this.currentFilterParams.page = (this.currentFilterParams.page ?? 1);
        }

        if (updateTabCounts && res.groupCounts) {
          this.updateTabCountsFromGroup(res.groupCounts);
        }

        this.appointments = this.appointments.map((item: any) => {
          const revision = Number(item.interview?.revision || 1);

          const revisionList = Array.from({ length: revision }, (_, i) => ({
            label: i + 1,
            value: i + 1
          })).reverse();

          return {
            ...item,
            revisionList
          };
        });

        this.appointments = this.appointments.map(appointment => {
          const offeredCount = appointment.jobPosition.jobList.filter((job: any) => job.isOffered === true).length;
          return {
            ...appointment,
            isHidden: offeredCount >= 2
          };
        });

      }),
      catchError((err) => {
        console.error('Error fetching appointments:', err);
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
      })
    );

    if (autoSubscribe) {
      obs$.subscribe();
    }

    return obs$;
  }


  getHistoryDataForUser(userId: number) {
    const historyData: { date: string; time: string; status: any; value: any; }[] = [];

    const userAppointment = this.appointments.find(item => item.profile?.userId === userId);
    if (!userAppointment) return historyData;

    const missCalls = userAppointment.interview?.missCallHistory || [];
    missCalls.forEach((call: { missCallAt: string | number | Date; missCallReason: any; missCallId: any; }) => {
      historyData.push({
        date: call.missCallAt ? new Date(call.missCallAt).toISOString().split('T')[0].replace(/-/g, '/') : '',
        time: call.missCallAt ? new Date(call.missCallAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
        status: call.missCallReason || '',
        value: call.missCallId || 0
      });
    });

    return historyData;
  }

  fetchStatusCall() {

    const updatedParams = {
      ...this.currentFilterParams,
      page: this.currentFilterParams.page ?? 1,
      search: this.currentFilterParams.search,
    };

    this.appointmentsService.getStatus<any>(updatedParams).subscribe({
      next: (res) => {
        const allMapped = res.map((item: { reasonMissCall: any; missCallId: number }) => ({
          label: item.reasonMissCall,
          value: item.missCallId
        }));

        this.dataStatusCallFirst = allMapped.filter((item: { value: number; }) => item.value >= 0 && item.value <= 49);
        this.dataStatusCallSecond = allMapped.filter((item: { value: number; }) => item.value >= 50 && item.value <= 99);

        this.dataStatusCall = [...this.dataStatusCallFirst, ...this.dataStatusCallSecond];
      },
      error: (err) => {
        console.error('Error fetching appointments:', err);
      }
    });
  }

  fetchPositionLogFor(appointment: any): Observable<any> {
    return this.appointmentsService.getPositionLogs(appointment.profile.userId, appointment.interview.round).pipe(
      tap(res => {
        appointment.positionLogs = res.data;
      })
    );
  }




  // ---------- Search / filter actions ----------
  onSearch() {
    sessionStorage.setItem('interviewSearchForm2History', JSON.stringify(this.searchForm));

    this.currentFilterParams = {
      ...this.currentFilterParams,
      search: this.searchForm.searchValue,
      page: 1,
    };

    this.appointments = [];
    this.hasMoreData = true;

    this.loadInitialAppointments(true);
  }

  onClearSearch() {
    this.searchForm = { searchBy: '', searchValue: '' };
    sessionStorage.removeItem('interviewSearchForm2History');

    this.currentFilterParams = {
      page: 1,
      pageSize: 5,
    };

    this.appointments = [];
    this.hasMoreData = true;

    this.loadInitialAppointments(true);
  }

  onTabChange(tabKey: string): void {
    this.selectedTab = tabKey;
    this.currentFilterParams.page = 1;
    this.hasMoreData = true;

    const updatedParams = {
      ...this.currentFilterParams,
      InterviewResult: tabKey === 'total' ? undefined : tabKey,
      page: 1
    };

    this.filterRequest.set(updatedParams);
    this.currentFilterParams = updatedParams;

    this.appointments = [];
    this.loadInitialAppointments(false);
  }

  // ---------- Date range ----------
  onDateRangeSelected(range: { startDate: string; endDate: string }) {
    this.startDate = range.startDate;
    this.endDate = range.endDate;

    if (this.startDate == 'Invalid Date') return;

    const endY = this.endDate.split('-')[0]
    const endM = Number(this.endDate.split('-')[1])
    const startM = Number(this.startDate.split('-')[1])

    if (endY !== 'NaN') {
      this.yearData = Number(endY);

      if (endM - startM !== 11) {
        this.monthData = endM;
      } else {
        this.monthData = undefined;
      }
    } else {
      this.yearData = undefined;
      this.monthData = undefined;
    }

    this.currentFilterParams = {
      page: 1,
      pageSize: 5,
    };

    this.hasMoreData = true;
    this.appointments = [];

    this.fetchAppointments(true);

    this.updateTabCounts(this.appointments);
  }


  onDateChange(event: Event, item: any) {
    const el = event.target as HTMLInputElement;
    const newValue = el.value;                 // yyyy-MM-ddTHH:mm
    const prevValue = item?.interview?.date;
    const appointmentId = item.profile.appointmentId;

    // อัปเดต UI ให้ input ที่มองเห็นเปลี่ยนทันที
    item.interview = { ...(item.interview || {}), date: newValue };
    this.cdr?.markForCheck?.();

    // input = debounce / change = ทันที
    const isChange = event.type === 'change';
    const delay = isChange ? 0 : 600;

    // กันยิงถี่
    if (this.dateSaveTimers[appointmentId]) {
      clearTimeout(this.dateSaveTimers[appointmentId]);
    }

    this.dateSaveTimers[appointmentId] = setTimeout(() => {
      // กันยิงซ้ำค่าซ้ำ
      if (this.lastSubmittedDate[appointmentId] === newValue) return;

      const payload = {
        appointmentId,
        interviewDate: newValue,
      };

      this.appointmentsService.updateInterviewDate(payload).subscribe({
        next: () => {
          this.lastSubmittedDate[appointmentId] = newValue;
          this.notificationService.success('Interview date updated.');
        },
        error: (err) => {
          console.error('Error update date:', err);
          this.notificationService.error('Error update date');

          // rollback UI + ค่าใน input hidden
          item.interview = { ...(item.interview || {}), date: prevValue };
          el.value = this.toDateTimeLocalValue(prevValue);
          this.cdr?.markForCheck?.();
        }
      });
    }, delay);
  }

  onLocationChange(selectedValue: number, item: any) {

    const payload = {
      appointmentId: item.profile.appointmentId,
      location: selectedValue
    }

    this.appointmentsService.updateInterviewLocation(payload).subscribe({
      next: () => {
        this.notificationService.success('Interview location updated.');
      },
      error: (err) => {
        console.error('Error update location:', err);

        this.notificationService.error('Error update location');
      }
    });
  }

  changeRevision: boolean | undefined;
  onRevisionChange(selectedValue: number, item: any) {
    const appointmentId = item.profile.appointmentId;
    const AppointmentRevision = item.profile.appointmentId.slice(0, -1) + selectedValue;

    this.appointmentsService.getAppointmentsRevision(AppointmentRevision).subscribe({
      next: (res) => {
        this.appointments = this.appointments.map(appointment => {
          if (appointment.profile.appointmentId === appointmentId) {
            this.changeRevision = true
            appointment.interview = res.items[0].interview
          }

          return {
            ...appointment
          };
        });
      },
      error: (err) => {
        console.error('Error get revision:', err);
      }
    });
  }

  onRescheduledClick(item: any) {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      width: '496px',
      panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
      autoFocus: false,
      disableClose: true,
      data: {
        title: 'Confirmation',
        message: 'Do you want to reschedule this appointment?',
        confirm: true
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (confirmed) {
        const appointmentid = item.profile.appointmentId;
        const userId = item.profile.userId;
        const round = item.interview.round;
        const revision = item.interview.revision;

        const payload = {
          appointmentId: appointmentid,
          userId: userId,
          round: round,
          revice: revision
        }

        this.appointmentsService.postReschedule(payload).subscribe({
          next: () => {
            const previousPage = this.currentFilterParams.page;
            const focusedAppointmentId = item.profile.appointmentId;

            this.appointments = [];
            this.currentFilterParams.page = 1;
            this.hasMoreData = true;

            const fetchCalls: Observable<any>[] = [this.fetchAppointments(false, false)];

            for (let page = 2; page <= previousPage; page++) {
              this.currentFilterParams.page = page;
              fetchCalls.push(this.fetchAppointments(false, false));
            }

            forkJoin(fetchCalls).subscribe(() => {
              setTimeout(() => {
                const el = document.getElementById(`appointment-${focusedAppointmentId}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 500);
            });
          },
          error: (err) => {
            console.error('Error Rescheduled:', err);

            this.notificationService.error('Error Rescheduled');
          }
        });
      }
    })
  }

  onInterviewFormClicked(item: any) {
    const queryParams = {
      id: item.profile.userId,
      interview: 2
    }
    this.router.navigate(['/interview-scheduling/interview-form/result'], { queryParams });
  }

  onInterviewDetailsClicked(item: any) {
    const queryParams = {
      id: item.profile.userId
    }
    this.router.navigate(['/applications/screening/application-form'], { queryParams });
  }

  // ---------- Tab counts (preserve comments) ----------
  updateTabCounts(appointments: any[]) {
    const counts: { [key: string]: number } = {
      total: appointments.length,
      pending: appointments.filter(a => a.result.interviewResult === 'pending').length,
      scheduled: appointments.filter(a => a.result.interviewResult === 'scheduled').length,
      'in-process': appointments.filter(a => a.result.interviewResult === 'in-process').length
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

      if (tab.key === 'total') {
        count = groupCounts['All Status'] ?? 0;
      } else if (tab.key === 'pass-interview') {
        count = groupCounts['Pass Interview'] ?? 0;
      } else if (tab.key === 'not-pass-interview') {
        count = groupCounts['Not Pass Interview'] ?? 0;
      } else if (tab.key === 'candidate-decline-interview') {
        count = groupCounts['Candidate Decline Interview'] ?? 0;
      } else if (tab.key === 'on-hold') {
        count = groupCounts['On Hold Interview'] ?? 0;
      } else {
        const labelMatch = tab.label.toLowerCase().trim();
        const matchingKey = Object.keys(groupCounts).find(
          key => key.toLowerCase().trim() === labelMatch
        );

        if (matchingKey) {
          count = groupCounts[matchingKey];
        }
      }

      return { ...tab, count };
    });

    this.tabMenus.set(newTabs);
  }

  // ---------- Dialog handlers ----------
  onAddPoscitionClick(index: number) {
    this.appointments.forEach(item => item.isAddingPosition = false);
    this.appointments[index].isAddingPosition = true;

    const item = this.appointments[index];
    const filteredJobPositionList = this.jobpositionList.filter((jp: { label: string; }) =>
      !item.jobPosition.jobList.some((job: { jobName: string; }) =>
        jp.label.trim().toLowerCase() === job.jobName.trim().toLowerCase()
      )
    );

    this.historyData = [];

    this.fetchPositionLogFor(this.appointments[index]).subscribe(() => {
      const dataPosLogs = this.appointments[index].positionLogs;

      const historyOptions: SelectOption[] = dataPosLogs.map((item: { createDate: string; namePosition: any; }, index: any) => {
        const { formattedDate, formattedTime } = this.formatCreateDateTimeDMY(item.createDate);
        return {
          value: index,
          label: `${formattedDate} ${formattedTime} ${item.namePosition}`
        };
      });

      const defaultSelected = historyOptions.slice(0, 2).map(opt => opt.value);

      this.dropdownConfigs = [
        {
          type: 'single',
          label: 'Position',
          placeholder: 'Select Position',
          options: filteredJobPositionList,
        },
        {
          type: 'multi',
          label: 'History',
          options: historyOptions,
          isHistory: true,
          defaultSelected: defaultSelected
        }
      ];

      document.querySelector('.cdk-overlay-pane')?.classList.add('pp-rounded-dialog');

      const dialogRef = this.dialog.open(SelectDialogComponent, {
        width: '480px',
        data: {
          title: 'Job Position',
          quality: 0,
          confirm: true,
          dropdownConfigs: this.dropdownConfigs
        }
      });

      dialogRef.afterClosed().subscribe((result: any) => {

        result = result.selectionMap

        if (result?.Position) {
          const item = this.appointments[index];
          if (!item.selectedPositions) {
            item.selectedPositions = [];
          }
          const exists = item.selectedPositions.some((pos: any) => pos.value === result.Position.value);
          if (!exists && item.selectedPositions.length < 2) {

            const payload = {
              userId: item.profile.userId,
              idjobPst: result.Position.value,
              round: item.interview.round
            }

            this.appointmentsService.addPositionJob(payload).subscribe({
              next: (res) => {
                item.selectedPositions.push(result.Position);
                const newJob = {
                  jobId: result.Position.value,
                  jobName: result.Position.label,
                  isActive: true,
                  isOffered: true
                };
                item.jobPosition.jobList.push(newJob);
                item.jobPosition.totalJobs = item.jobPosition.jobList.length;

                const offeredCount = item.jobPosition.jobList.filter((job: any) => job.isOffered === true).length;
                item.isHidden = offeredCount >= 2;
              },
              error: (err) => {
                console.error('Add Job Log Error:', err);
              }
            });

          }
        }
      });
    });
  }

  onRemoveJobByValue(jobToRemove: any, item: any) {

    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      width: '496px',
      panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
      autoFocus: false,
      disableClose: true,
      data: {
        title: 'Confirmation',
        message: 'Are you sure you want to delete this job position?',
        confirm: true
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (confirmed) {

        this.appointmentsService.deletePositionJob(item.profile.userId, item.interview.round, jobToRemove.jobId).subscribe({
          next: (res) => {
            item.jobPosition.jobList = item.jobPosition.jobList.filter(
              (job: any) => job.jobId !== jobToRemove.jobId
            );

            // item.selectedPositions = item.selectedPositions.filter(
            //   (pos: any) => pos.value !== jobToRemove.jobId
            // );

            item.jobPosition.totalJobs = item.jobPosition.jobList.length;

            const offeredCount = item.jobPosition.jobList.filter((job: any) => job.isOffered === true).length;
            item.isHidden = offeredCount >= 2;
          },
          error: (err) => {
            console.error('Delete Job Log Error:', err);
          }
        });
      }
    })

  }

  onRemoveJobApplicant(jobToRemove: any, item: any) {
    const candidateId = item.profile.userId;
    const positionId = jobToRemove.jobId;
    const applyRound = item.interview.round || 1;
    const isPassed = !jobToRemove.isActive;

    this.appointmentsService.updateCandidateStatus(candidateId, {
      isPassed,
      positionId,
      applyRound
    }).subscribe({
      error: (err) => {
        console.error('เกิดข้อผิดพลาดขณะอัปเดตสถานะผู้สมัคร', err);
      }
    });
  }

  async getEmployee(item: any) {
    const existingIdInterviewers = await this.fetchIDInterviewer(item.profile.appointmentId)
    return existingIdInterviewers.employees.length
  }

  private async preloadInterviewersForDialog(teamId: number | null, appointmentId: string) {
    if (!teamId) {
      const appt = await this.fetchIDInterviewer(appointmentId);
      const excluded = new Set(appt.employees.map((e: any) => e.employeeId));
      this.interviewerList = this.allInterviewers.filter(opt => !excluded.has(opt.value));
      return;
    }

    const [team, appt] = await Promise.all([
      this.fetchTeamInterviewer(teamId),
      this.fetchIDInterviewer(appointmentId),
    ]);

    const excluded = new Set<number>([
      ...team.members.map((m: any) => m.interviewerId),
      ...appt.employees.map((e: any) => e.employeeId)
    ]);
    this.interviewerList = this.allInterviewers.filter(opt => !excluded.has(opt.value));
  }

  dropdownConfigs$ = new BehaviorSubject<any[]>([]);
  async onAddTeamClick(item: any) {
    let TeamAppointmentIds = [];
    // let interviewerListMap = []

    if (item.interview.teamId !== null) {
      try {
        // const existingInterviewers = await this.fetchTeamInterviewer(item.interview.teamId);
        const existingIdInterviewers = await this.fetchIDInterviewer(item.profile.appointmentId);

        // const teamIds = existingInterviewers.members.map((i: any) => i.interviewerId);
        TeamAppointmentIds = existingIdInterviewers.employees.map((i: any) => i.employeeId);
        await this.preloadInterviewersForDialog(item.interview.teamId, item.profile.appointmentId);

        // const allExcludedIds = new Set([...teamIds, ...TeamAppointmentIds]);

        // interviewerListMap = this.interviewerList.filter(
        //   (i: any) => !allExcludedIds.has(i.value)
        // );

      } catch (err) {
        console.error('Error fetching team:', err);
      }
    }

    this.dropdownConfigs = [
      {
        type: 'single',
        label: 'Team',
        placeholder: 'Select Team',
        options: this.teamList,
        defaultValue: item.interview.teamId
      },
      {
        type: 'multi',
        label: 'Interviewers',
        isHistory: false,
        options: this.interviewerList,
        defaultSelected: TeamAppointmentIds
      }
    ];

    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
      document.querySelector('.cdk-overlay-pane')?.classList.add('pp-rounded-dialog');
    });

    this.dropdownConfigs$.next(this.dropdownConfigs);
    const dialogRef = this.dialog.open(SelectDialogComponent, {
      width: '480px',
      data: {
        title: 'Interviewers Team',
        quality: 0,
        confirm: true,
        dropdownConfigs: this.dropdownConfigs
      }
    });
    dialogRef.componentInstance.dropdownConfigs$ = this.dropdownConfigs$;

    dialogRef.componentInstance.teamChanged.subscribe(async (teamId: number) => {
      if (Number.isFinite(teamId)) {
        this.fetchInterviewerByTeam(teamId);
      }
    });

    dialogRef.afterClosed().subscribe(async (result: any) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (result) {
        const selectionMap = result.selectionMap;

        item.teamName = this.getTeamNameById(selectionMap.Team?.value)

        let valuesOnly = []
        let teamId = '';

        if (selectionMap.Interviewers === undefined) {
          item.teamUser = 0
          valuesOnly = TeamAppointmentIds
        } else {
          item.teamUser = selectionMap.Interviewers.length
          valuesOnly = selectionMap.Interviewers.map((item: { value: any; }) => item.value);
        }

        if (selectionMap.Team !== undefined) {
          teamId = selectionMap.Team?.value
        } else {
          teamId = item.interview.teamId
        }

        const payload = {
          appointmentId: item.profile.appointmentId,
          teamInterviewId: Number(teamId),
          employeeIds: valuesOnly
        }

        console.log(payload)

        this.appointmentsService.addMemberToTeam(payload).subscribe({
          next: () => {
            const previousPage = this.currentFilterParams.page;
            const focusedAppointmentId = item.profile.appointmentId;

            this.appointments = [];
            this.currentFilterParams.page = 1;
            this.hasMoreData = true;

            const fetchCalls: Observable<any>[] = [this.fetchAppointments(false, false)];

            for (let page = 2; page <= previousPage; page++) {
              this.currentFilterParams.page = page;
              fetchCalls.push(this.fetchAppointments(false, false));
            }

            forkJoin(fetchCalls).subscribe(() => {
              setTimeout(() => {
                const el = document.getElementById(`appointment-${focusedAppointmentId}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 500);
            });
          },
          error: (err) => {
            console.error('Error update team:', err);

            this.notificationService.error('Error update team interview');
          }
        });
      }
    });

  }

  onAddCallStatus(item: any) {
    const currentUserId = item.profile.userId;
    const currentAppointmentId = item.profile.appointmentId;
    const missCallCount = item.interview.missCallCount;
    this.historyData = this.getHistoryDataForUser(currentUserId);

    const historyOptions: SelectOption[] = this.historyData.map((item, index) => ({
      value: index,
      label: `${item.date} ${item.time} ${item.status}`,
    }));

    const defaultSelected = historyOptions.slice(0, 2).map(opt => opt.value);

    this.dropdownConfigs = [
      {
        type: 'toggle',
        missCallCount: missCallCount
      },
      {
        type: 'single',
        label: 'Status',
        placeholder: 'Select Status',
        optionsFirst: this.dataStatusCallFirst,
        optionsSecond: this.dataStatusCallSecond,
        dynamicByToggle: true
      },
      {
        type: 'multi',
        label: 'History',
        options: historyOptions,
        isHistory: true,
        defaultSelected: defaultSelected,
        placeholder: 'No History',
      }
    ];

    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
      document.querySelector('.cdk-overlay-pane')?.classList.add('pp-rounded-dialog');
    });

    const dialogRef = this.dialog.open(SelectDialogComponent, {
      width: '480px',
      data: {
        title: 'Call Status',
        quality: 0,
        confirm: true,
        options: this.dataOptions,
        dropdownConfigs: this.dropdownConfigs
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (result) {
        const appointmentId = currentAppointmentId;
        const missCallId = result.selectionMap.Status?.value || 0;
        const isNoShow = result.isNoShow;

        this.appointmentsService.appointmentMisscall({
          appointmentId,
          missCallId,
          isNoShow
        }).subscribe({
          next: () => {
            const previousPage = this.currentFilterParams.page;
            const focusedAppointmentId = appointmentId;

            this.appointments = [];
            this.currentFilterParams.page = 1;
            this.hasMoreData = true;

            const fetchCalls: Observable<any>[] = [this.fetchAppointments(false, false)];

            for (let page = 2; page <= previousPage; page++) {
              this.currentFilterParams.page = page;
              fetchCalls.push(this.fetchAppointments(false, false));
            }

            forkJoin(fetchCalls).subscribe(() => {
              setTimeout(() => {
                const el = document.getElementById(`appointment-${focusedAppointmentId}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 500);
            });
          },
          error: (err) => {
            console.error('API call error:', err);
          }
        });

      }
    });
  }

  onShowCallStatus(item: any) {
    const currentUserId = item.profile.userId;
    this.historyData = this.getHistoryDataForUser(currentUserId);

    const historyOptions: SelectOption[] = this.historyData.map((item, index) => ({
      value: index,
      label: `${item.date} ${item.time} ${item.status}`,
    }));

    const defaultSelected = historyOptions.slice(0, 2).map(opt => opt.value);

    this.dropdownConfigs = [
      {
        type: 'multi',
        label: 'History',
        options: historyOptions,
        isHistory: true,
        defaultSelected: defaultSelected
      }
    ];

    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
      document.querySelector('.cdk-overlay-pane')?.classList.add('pp-rounded-dialog');
    });

    const dialogRef = this.dialog.open(SelectDialogComponent, {
      width: '480px',
      data: {
        title: 'Call Status History',
        quality: 0,
        confirm: false,
        options: this.dataOptions,
        dropdownConfigs: this.dropdownConfigs
      }
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');
    });
  }

  onSendMail(item: any) {
    const statusCall = item.interview.isCalled;
    if (statusCall !== 'complete') return;
    if (!item.interview.locationId || !item.interview.teamId || !item.interview.date) return;

    this.appointmentsService.getEmailTemplate(item.profile.appointmentId, 1).subscribe({
      next: (res) => {
        const container = document.querySelector('.cdk-overlay-container');
        container?.classList.add('dimmed-overlay');

        const dialogRef = this.dialog.open(MailDialogComponent, {
          width: '1140px',
          data: {
            title: 'Send Mail',
            quality: 0,
            confirm: true,
            options: this.dataOptions,
            dropdownConfigs: this.dropdownConfigs,
            dataMail: res
          }
        });

        dialogRef.afterClosed().subscribe(async (result: any) => {
          container?.classList.remove('dimmed-overlay');
          if (result) {
            const formData = result.formData as FormData;
            const from = formData.get('from') as string;
            const to = formData.get('to') as string;
            const subject = formData.get('subject') as string;
            const message = formData.get('message') as string;
            const attachments = formData.getAll('attachments') as File[];

            const emailAttachments = [];

            for (const file of attachments) {
              const base64Content = await this.fileToBase64(file);
              emailAttachments.push({
                fileName: file.name,
                content: base64Content,
                contentType: file.type
              });
            }

            const payload = {
              appointmentId: item.profile.appointmentId,
              fromEmail: from,
              fromName: res.formName,
              to: to,
              cc: [],
              bcc: [],
              subject: subject,
              body: message,
              isHtml: true,
              attachments: emailAttachments,
              priority: 0
            };

            this.appointmentsService.sendEmail(payload).subscribe({
              next: () => {
                const previousPage = this.currentFilterParams.page;
                const focusedAppointmentId = item.profile.appointmentId;

                this.appointments = [];
                this.currentFilterParams.page = 1;
                this.hasMoreData = true;

                const fetchCalls: Observable<any>[] = [this.fetchAppointments(true, false)];

                for (let page = 2; page <= previousPage; page++) {
                  this.currentFilterParams.page = page;
                  fetchCalls.push(this.fetchAppointments(true, false));
                }

                forkJoin(fetchCalls).subscribe(() => {
                  setTimeout(() => {
                    const el = document.getElementById(`appointment-${focusedAppointmentId}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 500);
                });
              },
              error: (err) => {
                console.error('Error Sent Mail:', err);

                this.notificationService.error('Error Sent Mail');
              }
            });
          }
        });

      },
      error: (err) => {
        console.error('Get Email Template Error:', err);
      }
    });
  }

  // ---------- Carousel ----------
  onPrevClick(index: number) {
    const carousel = this.carousels.get(index);
    carousel?.slickPrev();
  }

  onNextClick(index: number) {
    const carousel = this.carousels.get(index);
    carousel?.slickNext();
  }

  onCarouselInit(e: any, index: number) {
    this.totalSlides[index] = e.slick.slideCount;
    this.currentSlide[index] = 0;
    this.updateArrowState(index);

    this.cdr.detectChanges();
  }

  onSlideChanged(e: any, index: number) {
    this.currentSlide[index] = e.currentSlide;
    this.updateArrowState(index);
  }

  updateArrowState(index: number) {
    const visibleSlides = this.getVisibleSlides();
    const maxStartIndex = this.totalSlides[index] - visibleSlides;

    this.canGoPrev[index] = this.currentSlide[index] > 0;
    this.canGoNext[index] = this.currentSlide[index] < maxStartIndex;
  }

  getVisibleSlides(): number {
    const width = window.innerWidth;

    if (width < 1800) {
      return 3;
    }
    return 4;
  }

  // ---------- Helpers ----------
  getTeamNameById(teamId: number): string {
    const team = this.teamList?.find((t: { value: number; }) => t.value === teamId);
    return team?.label ?? '';
  }

  getButtonClass(resultCode: number): string {
    switch (resultCode) {
      case 21:
        return 'tw-bg-[#AAFFAA] tw-text-[#00AA00]'; // pass
      case 22:
        return 'tw-bg-[#9300001A] tw-text-[#660708]'; // not pass
      case 25:
        return 'tw-bg-[#FF00551F] tw-text-[#FF0055]'; // candidate decline
      default:
        return 'tw-bg-[#e9e9e9] tw-text-[#373737]'; // No Show
    }
  }

  getTagClass(resultText: string): string {
    switch (resultText?.toLowerCase().trim()) {
      case 'a':
        return 'tag-grade-a';
      case 'b':
        return 'tag-grade-b';
      case 'c':
        return 'tag-grade-c';
      case 'd':
        return 'tag-grade-d';
      case 'f':
        return 'tag-grade-f';
      default:
        return 'tag-grade-default';
    }
  }

  formatCreateDateTimeDMY(dateString: string) {
    const date = new Date(dateString);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // เดือนเริ่มที่ 0
    const year = String(date.getFullYear()).slice(-2); // 2 หลักสุดท้ายของปี

    const formattedDate = `${day}/${month}/${year}`;

    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return { formattedDate, formattedTime };
  }

  fileToBase64(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1]; // ตัดเอาเฉพาะ base64 หลัง comma
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // ---------- Infinite scroll ----------
  onScroll(event: Event): void {
    const element = event.target as HTMLElement;

    const scrollPosition = element.scrollTop + element.clientHeight;
    const threshold = element.scrollHeight - 50;

    if (scrollPosition >= threshold && !this.loading && this.hasMoreData) {
      this.loadMoreAppointments();
    }
  }

  loadMoreAppointments() {
    this.loading = true;
    this.currentFilterParams.page++;

    const params: any = {
      page: this.currentFilterParams.page,
      pageSize: this.currentFilterParams.pageSize,
      InterviewResult: this.selectedTab === 'total' ? undefined : this.selectedTab,
      month: this.monthData,
      year: this.yearData,
    };

    this.appointmentsService.getAppointmentsHistory<any>(params).subscribe({
      next: (res) => {
        const newItems = res.items || [];

        this.appointments = [...this.appointments, ...newItems];

        if (newItems.length < Number(this.currentFilterParams.pageSize)) {
          this.hasMoreData = false;
        }

        this.loading = false;

        this.appointments = this.appointments.map((item: any) => {
          const revision = Number(item.interview?.revision || 1);

          const revisionList = Array.from({ length: revision }, (_, i) => ({
            label: i + 1,
            value: i + 1
          })).reverse();

          return {
            ...item,
            revisionList
          };
        });

        this.appointments = this.appointments.map(appointment => {
          const offeredCount = appointment.jobPosition.jobList.filter((job: any) => job.isOffered === true).length;
          return {
            ...appointment,
            isHidden: offeredCount >= 2
          };
        });
      },
      error: (err) => {
        console.error('Load more failed:', err);
        this.loading = false;
      }
    });
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'back':
        this.router.navigate(['/interview-scheduling/interview-round-2']);
        break;
    }
  }

  // === DateTime helpers ===
  canOpenDateTimePicker(item: any): boolean {
    // หน้า History: ล็อกไว้ให้อ่านอย่างเดียว (ปิดการแก้ไข)
    return false;
  }

  toDateTimeLocalValue(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
  }

  formatDateTimeDDMMYYYYHHmm(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const dd = pad(d.getDate());
    const MM = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${dd}/${MM}/${yyyy} ${hh}:${mm}`;
  }

  openDateTimePicker(nativeInput: HTMLInputElement | null): void {
    if (!this.canOpenDateTimePicker(null)) return;
    if (!nativeInput) return;
    // Chrome มี showPicker; ถ้าไม่มีให้ fallback เป็น focus/click
    // @ts-ignore
    if (typeof nativeInput.showPicker === 'function') {
      // @ts-ignore
      nativeInput.showPicker();
    } else {
      nativeInput.focus();
      nativeInput.click();
    }
  }

  onDateTimeBoxMouseDown(nativeInput: HTMLInputElement | null, _item: any): void {
    if (!this.canOpenDateTimePicker(_item)) return;
    this.openDateTimePicker(nativeInput);
  }
}
