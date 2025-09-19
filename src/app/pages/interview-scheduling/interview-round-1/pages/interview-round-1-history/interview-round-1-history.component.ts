import { ChangeDetectorRef, Component, computed, QueryList, signal, ViewChildren } from '@angular/core';
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

const SEARCH_OPTIONS: string[] = [
  'Applicant ID',
  'Applicant Name'
] as const;

@Component({
  selector: 'app-interview-round-1-history',
  templateUrl: './interview-round-1-history.component.html',
  styleUrl: './interview-round-1-history.component.scss'
})
export class InterviewRound1HistoryComponent {

  createInitialTabs(): TabMenu[] {
    return [
      { key: 'total', label: 'All Status', count: 0 },
      // { key: 'no-show', label: 'Candidate No-Show', count: 0 },
      // { key: 'accept', label: 'Accepted Interviews', count: 0 },
      // { key: 'decline-interviews', label: 'Declined Interviews', count: 0 },
      // { key: 'decline-candidate', label: 'Declined Candidates', count: 0 },

      { key: 'no-show', label: 'No Show', count: 0 },
      { key: 'pass-interview', label: 'Pass Interview', count: 0 },
      { key: 'not-pass-interview', label: 'Not Pass Interview', count: 0 },
      // { key: 'decline-candidate', label: 'Declined Candidates', count: 0 },
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

  // ---------- Tabs / filters ----------
  selectedTab = 'total';
  filterButtons: { label: string; key: string; color: string; outlineBtn?: boolean }[] = [];

  // ---------- Dropdown data sources ----------
  locationsList: any;
  jobpositionList: any;
  teamList: any;
  interviewerList: any;

  // ---------- Appointments / UI state ----------
  appointments: any[] = [];
  isDeclined = false;
  loading = false;
  hasMoreData = true;

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
  dataStatusCall = [
    { label: 'Switched Off', value: 1 },
    { label: 'No Answer', value: 2 },
    { label: 'Call Rejected', value: 3 },
    { label: 'Line Busy', value: 4 },
    { label: 'Invalid Number', value: 5 },
    { label: 'Answered by Someone Else', value: 6 },
    { label: 'Call Back Requested', value: 7 },
    { label: 'Voicemail Reached', value: 8 },
  ];

  historyData = [
    { date: '2025/09/18', time: '10:00am', status: 'โทรติดแต่ไม่รับสาย', value: 1 },
    { date: '2025/09/17', time: '10:00am', status: 'โทรไม่ติด / ปิดเครื่อง', value: 2 },
    { date: '2025/09/16', time: '10:00am', status: 'Voicemail', value: 3 },
  ];

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

  // ---------- Constructor ----------
  constructor(
    private interviewerService: InterviewerService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private benefitsService: GeneralBenefitsService,
    private jobPositionService: JobPositionService,
    private appointmentsService: AppointmentsService,
  ) { }

  // ---------- Lifecycle ----------
  ngOnInit() {
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

    this.fetchLocationDetails();
    this.fetchJobPosition();
    this.fetchTeamID();
    this.fetchInterviewer();

    this.filterButtons = [{ label: 'Scheduled', key: 'back', color: 'transparent', outlineBtn: true }];
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

  fetchInterviewer() {
    this.interviewerService.getAllInterviewers().subscribe({
      next: (res) => {
        const list = res ?? [];

        const filteredInterviewer = (list as any[]).filter(x => x?.isActive !== false);

        this.interviewerList = filteredInterviewer.map(loc => ({
          label: loc.fullName,
          value: loc.idEmployee
        }));
      },
      error: (error) => {
        console.error('Error fetching category types:', error);
      }
    });
  }

  fetchAppointments(updateTabCounts = false) {
    this.loading = true;

    const updatedParams = {
      ...this.currentFilterParams,
      month: this.monthData === 12 ? undefined : this.monthData,
      // year: this.yearData,
      page: this.currentFilterParams.page ?? 1,
      search: this.currentFilterParams.search,
    };

    this.appointmentsService.getAppointmentsHistory<any>(updatedParams).subscribe({
      next: (res) => {
        const newItems = res.items || [];
        this.appointments = [...this.appointments, ...newItems];

        if (newItems.length < Number(this.currentFilterParams.pageSize)) {
          this.hasMoreData = false;
        }

        this.loading = false;

        if (updateTabCounts && res.groupCounts) {
          this.updateTabCountsFromGroup(res.groupCounts);
        }
      },
      error: (err) => {
        console.error('Error fetching appointments:', err);
        this.loading = false;
      }
    });
  }


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

    this.fetchAppointments(true);
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

    this.fetchAppointments(true);
  }

  onTabChange(tabKey: string): void {
    this.selectedTab = tabKey;
    this.currentFilterParams.page = 1;
    this.hasMoreData = true;

    console.log(this.currentFilterParams, '=>.this.currentFilterParams tabbb');
    const updatedParams = {
      ...this.currentFilterParams,
      InterviewResult: tabKey === 'total' ? undefined : tabKey,
      page: 1
    };

    this.filterRequest.set(updatedParams);
    this.currentFilterParams = updatedParams;

    this.appointments = [];
    this.fetchAppointments(false);
  }

  // ---------- Date range ----------
  onDateRangeSelected(range: { startDate: string; endDate: string }) {
    this.startDate = range.startDate;
    this.endDate = range.endDate;

    const start = new Date(this.endDate);
    this.yearData = start.getFullYear();
    this.monthData = start.getMonth() + 1;

    this.appointments = [];
    this.fetchAppointments(true);

    this.updateTabCounts(this.appointments);
  }

  // ---------- Tab counts (preserve comments) ----------
  updateTabCounts(appointments: any[]) {
    const counts: { [key: string]: number } = {
      total: appointments.length,
      'no-show': appointments.filter(a => a.result.interviewResult === 22).length,
      accept: appointments.filter(a => a.result.interviewResult === 21).length,
      'in-process': appointments.filter(a => a.result.interviewResultText.toLowerCase() === 'in-process').length
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

    const historyOptions: SelectOption[] = this.historyData.map(item => ({
      value: item.value,
      label: `${item.date} ${item.time} ${item.status}`,
    }));

    const defaultSelected = historyOptions.slice(-2).map(opt => opt.value);

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
      if (result?.Position) {
        const item = this.appointments[index];
        if (!item.selectedPositions) {
          item.selectedPositions = [];
        }
        const exists = item.selectedPositions.some((pos: any) => pos.value === result.Position.value);
        if (!exists && item.selectedPositions.length < 2) {
          item.selectedPositions.push(result.Position);

          const newJob = {
            jobId: result.Position.value,
            jobName: result.Position.label,
            isActive: true,
            isOffered: true
          };
          item.jobPosition.jobList.push(newJob);
          item.jobPosition.totalJobs = item.jobPosition.jobList.length;

          console.log(this.appointments, '=>this.appointments');
        }
      }
    });
  }

  onRemoveJobByValue(jobToRemove: any, item: any) {

    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      width: '496px',
      panelClass: 'custom-dialog-container',
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

        item.jobPosition.jobList = item.jobPosition.jobList.filter(
          (job: any) => job.jobId !== jobToRemove.jobId
        );

        item.selectedPositions = item.selectedPositions.filter(
          (pos: any) => pos.value !== jobToRemove.jobId
        );

        item.jobPosition.totalJobs = item.jobPosition.jobList.length;
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

  onAddTermClick() {
    this.dropdownConfigs = [
      {
        type: 'single',
        label: 'Team',
        placeholder: 'Select Team',
        options: this.teamList,
      },
      {
        type: 'multi',
        label: 'Interviewers',
        isHistory: false,
        options: this.interviewerList,
      }
    ];

    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(SelectDialogComponent, {
      width: '480px',
      data: {
        title: 'Interviewers Team',
        quality: 0,
        confirm: true,
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

  onAddCallStatus() {

    const historyOptions: SelectOption[] = this.historyData.map(item => ({
      value: item.value,
      label: `${item.date} ${item.time} ${item.status}`,
    }));

    const defaultSelected = historyOptions.slice(-2).map(opt => opt.value);

    this.dropdownConfigs = [
      {
        type: 'single',
        label: 'Status',
        placeholder: 'Select Status',
        options: this.dataStatusCall,
      },
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

    dialogRef.afterClosed().subscribe((result: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (result) {
        console.log('Selected values from dialog:', result);
      }
    });
  }

  onShowCallStatus() {

    const historyOptions: SelectOption[] = this.historyData.map(item => ({
      value: item.value,
      label: `${item.date} ${item.time} ${item.status}`,
    }));

    const defaultSelected = historyOptions.slice(-2).map(opt => opt.value);

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

    dialogRef.afterClosed().subscribe((result: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (result) {
        console.log('Selected values from dialog:', result);
      }
    });
  }

  onSendMail() {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(MailDialogComponent, {
      width: '1140px',
      data: {
        title: 'Send Mail',
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

  getButtonClass(resultText: string): string {
    switch (resultText?.toLowerCase()) {
      case 'no show':
        return 'tw-bg-[#FAFBC8] tw-text-[#AAAA00]';
      case 'in process':
        return 'tw-bg-[#F9E9C8] tw-text-[#AA5500]';
      case 'scheduled':
        return 'tw-bg-[#E0EEFA] tw-text-[#0085FF]';
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
      month: this.monthData === 12 ? undefined : this.monthData,
      // year: this.yearData,
    };

    this.appointmentsService.getAppointmentsHistory<any>(params).subscribe({
      next: (res) => {
        const newItems = res.items || [];

        this.appointments = [...this.appointments, ...newItems];

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

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'back':
        this.router.navigate(['/interview-scheduling/interview-round-1']);
        break;
    }
  }
}
