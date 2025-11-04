import { ChangeDetectorRef, Component, computed, ElementRef, QueryList, signal, ViewChild, ViewChildren } from '@angular/core';
import { InterviewerService } from '../../../../services/admin-setting/interviewer/interviewer.service';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { DateRange, SearchForm } from '../../../../interfaces/interview-scheduling/interview.interface';
import { ICandidateFilterRequest, IPositionDto, TabMenu } from '../../../../interfaces/Application/application.interface';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { SelectDialogComponent, SelectOption } from '../../../../shared/components/dialogs/select-dialog/select-dialog.component';
import { GeneralBenefitsService } from '../../../../services/admin-setting/general-benefits/general-benefits.service';
import { IApiResponse, IBenefitsFilterRequest, IUniversityWithPositionsDto } from '../../../../interfaces/admin-setting/general-benefits.interface';
import { JobPositionService } from '../../../../services/admin-setting/job-position/job-position.service';
import { SlickCarouselComponent } from 'ngx-slick-carousel';
import { MailDialogComponent } from '../../../../shared/components/dialogs/mail-dialog/mail-dialog.component';
import { AppointmentsService } from '../../../../services/interview-scheduling/appointment-interview/appointments.service';
import { AlertDialogComponent } from '../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { catchError, distinctUntilChanged, filter, finalize, forkJoin, map, Observable, of, startWith, Subject, takeUntil, tap } from 'rxjs';
import { NotificationService } from '../../../../shared/services/notification/notification.service';
import { Columns } from '../../../../shared/interfaces/tables/column.interface';
import { InterviewFormService } from '../../../../services/interview-scheduling/interview-form/interview-form.service';

const SEARCH_OPTIONS: string[] = [
  'Applicant ID',
  'Applicant Name'
] as const;

@Component({
  selector: 'app-offer-employment-history',
  templateUrl: './offer-employment-history.component.html',
  styleUrl: './offer-employment-history.component.scss'
})
export class OfferEmploymentHistoryComponent {

  createInitialTabs(): TabMenu[] {
    return [
      { key: 'total', label: 'All Status', count: 0 },
      { key: 'hire-offer', label: 'Offer', count: 0 },
      { key: 'not-offer', label: 'Not Offer', count: 0 },
      // { key: 'candidate-decline-offer', label: 'Candidate Decline Offer', count: 0 }
    ];
  }

  protected currentFilterParams: IBenefitsFilterRequest = {
    page: 1,
    pageSize: 20,
  };

  childActive = false;

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

  hasOverflowY = false;
  rows: any[] = [];
  readonly columns: Columns = [
    {
      header: 'Offer Status',
      field: 'interview1ResultText',
      type: 'badge',
      align: 'center',
      width: '10%',
    },
    {
      header: 'Applicant ID.',
      field: 'userID',
      type: 'text',
      align: 'center',
      width: '10%',
    },
    {
      header: 'Applicant Name',
      field: 'fullName',
      type: 'text',
      // align: 'center',
      width: '20%',
    },
    {
      header: 'Job Position',
      field: 'position',
      type: 'list',
      width: '20%',
      wrapText: true,
    },
    {
      header: 'Interview 2 Date',
      field: 'Interview2Date',
      type: 'text',
      align: 'center',
      width: '10%',
    },
    {
      header: 'Offer Date',
      field: 'OfferDate',
      type: 'text',
      align: 'center',
      width: '10%',
    },
    {
      header: 'Offer Result',
      field: 'OfferResult',
      type: 'textlink-custom',
      align: 'center',
      width: '10%',
      textlinkActions: ['view'],
      iconLink: 'pen-to-square'
    },
    {
      header: 'Hire Result',
      field: 'HireResult',
      type: 'textlink-custom',
      align: 'center',
      width: '10%',
      textlinkActions: ['view'],
      iconLink: 'pen-to-square'
    },
    {
      header: 'Status',
      field: 'statusDate',
      type: 'badge',
      align: 'center',
      width: '10%',
    },
  ] as const;


  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

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
    private interviewFormService: InterviewFormService,
    private route: ActivatedRoute
  ) { }

  // ---------- Lifecycle ----------
  ngOnInit() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    this.today = `${year}-${month}-${day}`;

    this.appointmentsService.setAppointmentsType(3);

    const savedSearch = sessionStorage.getItem('interviewOffer');
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

    // this.fetchAppointments(true);

    // this.loadInitialAppointments(true);

    this.filterButtons = [{
      label: 'Offer', key: 'back', outlineBtn: true,
      color: '#FFFFFF',
      textColor: '#000000',
      borderColor: '#000000',
    }];
  }

  // ---------- Data fetching ----------

  currentPage = 1;

  loadInitialAppointments(updateTabCounts = false) {
    this.appointments = [];
    this.currentFilterParams.page = 1;
    if (this.isAtParentOnly()) {
      this.fetchAppointments(updateTabCounts);
    }
  }

  fetchAppointments(updateTabCounts = false, autoSubscribe = true): Observable<any> {
    if (!this.hasMoreData) return of(null);

    this.loading = true;

    const updatedParams = {
      ...this.currentFilterParams,
      month: this.monthData,
      year: this.yearData,
      page: this.currentFilterParams.page ?? 1,
      search: this.applicantId ? String(this.applicantId) : this.currentFilterParams.search,
    };

    const obs$ = this.appointmentsService.getInterviewOfferHistory<any>(updatedParams).pipe(
      tap((res) => {

        this.hasMoreData = res.hasNextPage;

        this.rows = (res.items ?? []).map((item: any) => {
          const interview1Text = item.result.offerResult;
          const interview2Text = item.result.statusResult.statusText;

          const interview1Hidden = !interview1Text;
          const interview2Hidden = !interview2Text;

          return {
            ...item,
            userID: item.profile.userId,
            fullName: item.profile.fullName,
            interview1ResultText: {
              label: interview1Text,
              class: [
                ...(item.result.offerResult.toLowerCase().trim() === 'offer'
                  ? ['tw-bg-green-500', 'tw-text-white', 'tw-ring-green-500/10']
                  : item.result.offerResult.toLowerCase().trim() === 'pending'
                    ? ['tw-bg-[#FFAA00]', 'tw-text-white', 'tw-ring-orange-500/10']
                    : item.result.offerResult.toLowerCase().trim() === 'in process'
                      ? ['tw-bg-orange-500', 'tw-text-white', 'tw-ring-orange-500/10']
                      : item.result.offerResult.toLowerCase().trim() === 'scheduled'
                        ? ['tw-bg-indigo-400', 'tw-text-white', 'tw-ring-indigo-400/10']
                        : item.result.offerResult.toLowerCase().trim() === 'onhold'
                          ? ['tw-bg-gray-400', 'tw-text-white', 'tw-ring-gray-400/10']
                          : ['tw-bg-red-500', 'tw-text-white', 'tw-ring-red-500/10']),
                ...(interview1Hidden ? ['tw-hidden'] : []),
              ],
            },
            statusDate: {
              label: interview2Text,
              class: [
                ...(this.getStatusClasses(interview2Text)),
                ...(interview2Hidden ? ['tw-hidden'] : []),
              ],
            },
            Interview2Date: this.formatCreateDateTimeDMY(item.result.statusResult.dateInterview2).formattedDate,
            OfferDate: this.formatCreateDateTimeDMY(item.result.offerDate).formattedDate,
            OfferResult: item.result.offerResult ? item.result.offerResult : undefined,
            HireResult: item.result.hireResult ? item.result.hireResult : undefined,
            position: item.jobPosition.jobList ?.filter((pos: { isOffered?: boolean }) => pos.isOffered).map((pos: { jobName: string }) => pos.jobName) || [],
          };
        });

        if (updateTabCounts && res.groupCounts) {
          this.updateTabCountsFromGroup(res.groupCounts);
        }

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

  // ---------- Search / filter actions ----------
  onSearch() {
    sessionStorage.setItem('interviewOfferSearchForm', JSON.stringify(this.searchForm));

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
    sessionStorage.removeItem('interviewOfferSearchForm');

    this.currentFilterParams = {
      page: 1,
      pageSize: 20,
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
      page: 1,
      pageSize: 20,
    };

    this.filterRequest.set(updatedParams);
    this.currentFilterParams = updatedParams;

    this.appointments = [];
    this.loadInitialAppointments(false);

    if (tabKey === 'base') {
      this.router.navigate(['./'], { relativeTo: this.route });
    } else if (tabKey === 'hire-result') {
      this.router.navigate(['hire-result'], { relativeTo: this.route });
    } else if (tabKey === 'offer-result') {
      this.router.navigate(['offer-result'], { relativeTo: this.route });
    }
  }

  onChildActivate() {
    Promise.resolve().then(() => this.childActive = true);
  }

  onChildDeactivate() {
    Promise.resolve().then(() => this.childActive = false);
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
      pageSize: 20,
    };

    this.hasMoreData = true;
    this.appointments = [];

    if (this.isAtParentOnly()) {
      this.fetchAppointments(true);
    }

    this.updateTabCounts(this.appointments);
  }

  private isAtParentOnly(): boolean {
    // ถ้ามี child แสดงว่าเราอยู่ /offer-employment/<child> → ไม่ fetch
    const child = this.route.firstChild ?? this.route.snapshot.firstChild;
    // กรณีมี child path = '' (หน้า default ของ parent) ยังถือว่าอยู่หน้า parent
    return !child || child.routeConfig?.path === '';
  }

  // onDateChange(event: Event, item: any) {
  //   const input = event.target as HTMLInputElement;
  //   const dateTime = input.value;

  //   const payload = {
  //     appointmentId: item.profile.appointmentId,
  //     interviewDate: dateTime
  //   }

  //   this.appointmentsService.updateInterviewDate(payload).subscribe({
  //     error: (err) => {
  //       console.error('Error update date:', err);

  //       this.notificationService.error('Error update date');
  //     }
  //   });
  // }

  onInterviewFormClicked(item: any) {
    const queryParams = {
      id: item.profile.appointmentId,
      interview: 1
    }
    this.router.navigate(['/interview-scheduling/interview-form/result'], { queryParams });
  }

  // ---------- Tab counts (preserve comments) ----------
  updateTabCounts(appointments: any[]) {
    const counts: { [key: string]: number } = {
      total: appointments.length,
      'hire-offer': appointments.filter(a => a.result.interviewResult === 'hire-offer').length,
      'candidate-decline-offer': appointments.filter(a => a.result.interviewResult === 'candidate-decline-offer').length,
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
      } else if (tab.key === 'hire-offer') {
        count = groupCounts['Offer'] ?? 0;
      } else if (tab.key === 'not-offer') {
        count = groupCounts['Not Offer'] ?? 0;
      } else {
        const labelMatch = tab.key.toLowerCase().trim();
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

    const updatedParams = {
      ...this.currentFilterParams,
      month: this.monthData,
      year: this.yearData,
      page: this.currentFilterParams.page ?? 1,
      search: this.applicantId ? String(this.applicantId) : this.currentFilterParams.search,
    };

    this.appointmentsService.getInterviewOfferHistory<any>(updatedParams).subscribe({
      next: (res) => {
        const newItems = res.items || [];

        const mappedItems = newItems.map((item: any) => {
          const interview1Text = item.result.offerResult;
          const interview2Text = item.result.statusResult.statusText;

          const interview1Hidden = !interview1Text;
          const interview2Hidden = !interview2Text;

          return {
            ...item,
            userID: item.profile.userId,
            fullName: item.profile.fullName,
            interview1ResultText: {
              label: interview1Text,
              class: [
                ...(item.result.offerResult.toLowerCase().trim() === 'offer'
                  ? ['tw-bg-green-500', 'tw-text-white', 'tw-ring-green-500/10']
                  : item.result.offerResult.toLowerCase().trim() === 'pending'
                    ? ['tw-bg-[#FFAA00]', 'tw-text-white', 'tw-ring-orange-500/10']
                    : item.result.offerResult.toLowerCase().trim() === 'in process'
                      ? ['tw-bg-orange-500', 'tw-text-white', 'tw-ring-orange-500/10']
                      : item.result.offerResult.toLowerCase().trim() === 'scheduled'
                        ? ['tw-bg-indigo-400', 'tw-text-white', 'tw-ring-indigo-400/10']
                        : item.result.offerResult.toLowerCase().trim() === 'onhold'
                          ? ['tw-bg-gray-400', 'tw-text-white', 'tw-ring-gray-400/10']
                          : ['tw-bg-red-500', 'tw-text-white', 'tw-ring-red-500/10']),
                ...(interview1Hidden ? ['tw-hidden'] : []),
              ],
            },
            statusDate: {
              label: interview2Text,
              class: [
                ...(this.getStatusClasses(interview2Text)),
                ...(interview2Hidden ? ['tw-hidden'] : []),
              ],
            },
            Interview2Date: this.formatCreateDateTimeDMY(item.result.statusResult.dateInterview2).formattedDate,
            OfferDate: item.result.offerDate ? this.formatCreateDateTimeDMY(item.result.offerDate).formattedDate : '',
            OfferResult: item.result.offerResult ? item.result.offerResult : undefined,
            HireResult: item.result.hireResult ? item.result.hireResult : undefined,
            position: item.jobPosition.jobList ?.filter((pos: { isOffered?: boolean }) => pos.isOffered).map((pos: { jobName: string }) => pos.jobName) || [],
          };
        });

        // ✅ ต่อข้อมูลใหม่เข้า rows เดิม
        this.rows = [...this.rows, ...mappedItems];

        // ✅ เช็คว่าไม่มีข้อมูลเพิ่มแล้ว
        if (newItems.length < Number(this.currentFilterParams.pageSize)) {
          this.hasMoreData = false;
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('Load more failed:', err);
        this.loading = false;
      }
    });
  }

  // table
  ColumnClicked: any;

  handleColumnRowClick(event: { column: any; row: any }) {
    this.ColumnClicked = event.column;
    this.onViewRowClicked(event.row);
  }

  onViewRowClicked(row: any) {
    if (this.ColumnClicked === 'OfferResult') {
      const queryParams = {
        id: row.userID
      };

      this.router.navigate(['/offer-employment/offer-result'], { queryParams });
    } else if (this.ColumnClicked === 'HireResult') {
      const queryParams = {
        id: row.userID
      };

      this.router.navigate(['/offer-employment/hire-result'], { queryParams });
    }
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'back':
        this.router.navigate(['/offer-employment']);
        break;
    }
  }

}