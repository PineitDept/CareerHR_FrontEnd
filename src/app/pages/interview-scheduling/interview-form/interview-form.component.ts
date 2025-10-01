import { ChangeDetectorRef, Component, computed, ElementRef, QueryList, signal, ViewChild, ViewChildren } from '@angular/core';
import { InterviewerService } from '../../../services/admin-setting/interviewer/interviewer.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DateRange, SearchForm } from '../../../interfaces/interview-scheduling/interview.interface';
import { ICandidateFilterRequest, IPositionDto, TabMenu } from '../../../interfaces/Application/application.interface';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { SelectDialogComponent, SelectOption } from '../../../shared/components/dialogs/select-dialog/select-dialog.component';
import { GeneralBenefitsService } from '../../../services/admin-setting/general-benefits/general-benefits.service';
import { IApiResponse, IBenefitsFilterRequest, IUniversityWithPositionsDto } from '../../../interfaces/admin-setting/general-benefits.interface';
import { JobPositionService } from '../../../services/admin-setting/job-position/job-position.service';
import { SlickCarouselComponent } from 'ngx-slick-carousel';
import { MailDialogComponent } from '../../../shared/components/dialogs/mail-dialog/mail-dialog.component';
import { AppointmentsService } from '../../../services/interview-scheduling/appointment-interview/appointments.service';
import { AlertDialogComponent } from '../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { catchError, finalize, forkJoin, map, Observable, of, tap } from 'rxjs';
import { NotificationService } from '../../../shared/services/notification/notification.service';
import { Columns } from '../../../shared/interfaces/tables/column.interface';
import { InterviewFormService } from '../../../services/interview-scheduling/interview-form/interview-form.service';

const SEARCH_OPTIONS: string[] = [
  'Applicant ID',
  'Applicant Name'
] as const;

@Component({
  selector: 'app-interview-form',
  templateUrl: './interview-form.component.html',
  styleUrl: './interview-form.component.scss'
})
export class InterviewFormComponent {

  createInitialTabs(): TabMenu[] {
    return [
      { key: 'total', label: 'All Status', count: 0 },
      { key: 'pending', label: 'Pending', count: 0 },
      { key: 'in-process', label: 'In Process', count: 0 },
      { key: 'scheduled', label: 'Scheduled', count: 0 }
    ];
  }

  protected currentFilterParams: IBenefitsFilterRequest = {
    page: 1,
    pageSize: 20,
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
  filterButtons: { label: string; key: string; color: string; outlineBtn?: boolean }[] = [];

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

  hasOverflowY = false;
  rows: any[] = [];
  readonly columns: Columns = [
    {
      header: 'Applicant ID.',
      field: 'userID',
      type: 'text',
      align: 'center',
      width: '8%',
    },
    {
      header: 'Applicant Name',
      field: 'fullName',
      type: 'text',
      // align: 'center',
      width: '12%',
    },
    {
      header: 'Job Position',
      field: 'position',
      type: 'list',
      width: '22%',
      wrapText: true,
    },
    {
      header: 'Grade',
      field: 'gradeCandidate',
      type: 'text',
      align: 'center',
      width: '5%',
    },
    {
      header: 'Interview 1 Result',
      field: 'interview1ResultText',
      type: 'badge',
      align: 'center',
      width: '8%',
    },
    {
      header: 'Interview 1',
      field: 'interview1FormResult',
      type: 'textlink-custom',
      align: 'center',
      width: '6%',
      textlinkActions: ['view'],
      iconLink: 'pen-to-square'
    },
    {
      header: 'Interview 1 Submit Date',
      field: 'interview1TimeSubmit',
      type: 'text',
      align: 'center',
      width: '10%',
    },
    {
      header: 'Interview 2 Result',
      field: 'interview2ResultText',
      type: 'badge',
      align: 'center',
      width: '8%',
    },
    {
      header: 'Interview 2',
      field: 'interview2FormResult',
      type: 'textlink-custom',
      align: 'center',
      width: '6%',
      textlinkActions: ['view'],
      iconLink: 'pen-to-square'
    },
    {
      header: 'Interview 2 Submit Date',
      field: 'interview2TimeSubmit',
      type: 'text',
      align: 'center',
      width: '10%',
    },
  ] as const;


  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

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
    private interviewFormService: InterviewFormService,
  ) { }

  // ---------- Lifecycle ----------
  ngOnInit() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    this.today = `${year}-${month}-${day}`;

    this.appointmentsService.setAppointmentsType(1);

    const savedSearch = sessionStorage.getItem('interviewSearchForm');
    if (savedSearch) {
      this.searchForm = JSON.parse(savedSearch);
      this.currentFilterParams = {
        ...this.currentFilterParams,
        search: this.searchForm.searchValue,
        page: 1,
      };
    }
    
    this.fetchAppointments(true);

    // this.filterButtons = [{ label: 'History', key: 'history', color: 'transparent', outlineBtn: true }];
  }

  // ---------- Data fetching ----------

  currentPage = 1;

  loadInitialAppointments(updateTabCounts = false) {
    this.appointments = [];
    this.currentFilterParams.page = 1;
  }

  fetchAppointments(updateTabCounts = false, autoSubscribe = true): Observable<any> {
    if (!this.hasMoreData) return of(null);

    this.loading = true;

    const updatedParams = {
      ...this.currentFilterParams,
      month: this.monthData,
      year: this.yearData,
      page: this.currentFilterParams.page ?? 1,
      search: this.currentFilterParams.search,
    };

    const obs$ = this.interviewFormService.getTrackingForm<any>(updatedParams).pipe(
      tap((res) => {

        this.rows = (res.items ?? []).map((item: any) => {
          const interview1Text = item.interview1ResultText;
          const interview2Text = item.interview2ResultText;

          const interview1Hidden = !interview1Text;
          const interview2Hidden = !interview2Text;

          return {
            ...item,
            interview1ResultText: {
              label: interview1Text,
              class: [
                ...(item.interview1Result === 21
                  ? ['tw-bg-green-50', 'tw-ring-green-300', 'tw-text-green-700']
                  : ['tw-bg-red-50', 'tw-ring-red-300', 'tw-text-red-700']),
                ...(interview1Hidden ? ['tw-hidden'] : []),
              ],
            },
            interview2ResultText: {
              label: interview2Text,
              class: [
                ...(item.interview2Result === 21
                  ? ['tw-bg-green-50', 'tw-ring-green-300', 'tw-text-green-700']
                  : ['tw-bg-red-50', 'tw-ring-red-300', 'tw-text-red-700']),
                ...(interview2Hidden ? ['tw-hidden'] : []),
              ],
            },
            interview1TimeSubmit: item.interview1TimeSubmit
              ? this.formatCreateDateTimeDMY(item.interview1TimeSubmit).formattedDate
              : undefined,
            interview2TimeSubmit: item.interview2TimeSubmit
              ? this.formatCreateDateTimeDMY(item.interview2TimeSubmit).formattedDate
              : undefined,
            interview1FormResult: item.interview1FormResult ? item.interview1FormResult : undefined,
            interview2FormResult: item.interview2FormResult ? item.interview2FormResult : undefined,
            position: item.positions?.map((pos: IPositionDto) => pos.namePosition) || [],
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



  // fetchCategoryTypes() {
  //   this.applicationQuestionService.getCategoryTypesInfoQuestion().subscribe({
  //     next: (response) => {
  //       console.log('Category types fetched successfully:', response);
  //       this.rows = (response ?? []).map((item: any, idx: number) => ({
  //         ...item,
  //         activeStatus: true,
  //         no: idx + 1
  //       }));
  //     },
  //     error: (error) => {
  //       console.error('Error fetching category types:', error);
  //     }
  //   });
  // }

  // ---------- Search / filter actions ----------
  onSearch() {
    sessionStorage.setItem('interviewSearchForm', JSON.stringify(this.searchForm));

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
    sessionStorage.removeItem('interviewSearchForm');

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
    const input = event.target as HTMLInputElement;
    const dateTime = input.value;

    const payload = {
      appointmentId: item.profile.appointmentId,
      interviewDate: dateTime
    }

    this.appointmentsService.updateInterviewDate(payload).subscribe({
      error: (err) => {
        console.error('Error update date:', err);

        this.notificationService.error('Error update date');
      }
    });
  }

  onInterviewFormClicked(item: any) {
    const queryParams = {
      id: item.profile.appointmentId,
      interview: 1
    }
    this.router.navigate(['/interview-scheduling/interview-form/details'], { queryParams });
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

  // ---------- Helpers ----------
  getTeamNameById(teamId: number): string {
    const team = this.teamList?.find((t: { value: number; }) => t.value === teamId);
    return team?.label ?? '';
  }

  getButtonClass(resultCode: number): string {
    switch (resultCode) {
      case 12:
        return 'tw-bg-[#FAFBC8] tw-text-[#AAAA00]'; // pending
      case 15:
        return 'tw-bg-[#F9E9C8] tw-text-[#AA5500]'; // in process
      case 16:
        return 'tw-bg-[#E0EEFA] tw-text-[#0085FF]'; // scheduled
      default:
        return 'tw-bg-[#e9e9e9] tw-text-[#373737]';
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

    this.appointmentsService.getAppointments<any>(params).subscribe({
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
      case 'history':
        this.router.navigate(['/interview-scheduling/interview-round-1/history']);
        break;
    }
  }

  // table
  onViewRowClicked(row: any) {
    console.log(row)
    const queryParams = {
      id: row.userID,
      interview: 1
    }

    this.router.navigate(['/interview-scheduling/interview-form/details'], { queryParams });
  }
}