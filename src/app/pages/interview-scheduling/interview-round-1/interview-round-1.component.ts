import { ChangeDetectorRef, Component, computed, ElementRef, EventEmitter, HostListener, Output, QueryList, signal, ViewChild, ViewChildren } from '@angular/core';
import { defaultColumns, defaultFilterButtons } from '../../../constants/admin-setting/interviewer.constants';
import { InterviewerService } from '../../../services/admin-setting/interviewer/interviewer.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DateRange, SearchForm } from '../../../interfaces/interview-scheduling/interview.interface';
import { FilterConfig, GroupedCheckboxOption } from '../../../shared/components/filter-check-box/filter-check-box.component';
import { CalendarOptions } from '@fullcalendar/core/index.js';
import { defaultColumnsPolicy } from '../../../constants/admin-setting/email-template.constants';
import { ICandidateFilterRequest, TabMenu } from '../../../interfaces/Application/application.interface';
import { DropdownOption } from '../../../shared/components/cdk-dropdown/cdk-dropdown.component';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogComponent } from '../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { forkJoin } from 'rxjs';
import { SelectDialogComponent } from '../../../shared/components/dialogs/select-dialog/select-dialog.component';
import { GeneralBenefitsService } from '../../../services/admin-setting/general-benefits/general-benefits.service';
import { IApiResponse, IBenefitsFilterRequest, IUniversityWithPositionsDto } from '../../../interfaces/admin-setting/general-benefits.interface';
import { JobPositionService } from '../../../services/admin-setting/job-position/job-position.service';
import { SlickCarouselComponent } from 'ngx-slick-carousel';
import { MailDialogComponent } from '../../../shared/components/dialogs/mail-dialog/mail-dialog.component';
import { AppointmentsService } from '../../../services/interview-scheduling/appointment-interview/appointments.service';

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

  searchByOptions = SEARCH_OPTIONS;
  searchForm: SearchForm = { searchBy: '', searchValue: '' };

  filterDateRange: DateRange = { month: '', year: '' };
  startDate = '';
  endDate = '';
  dateRangeInitialized = false;

  tabMenus = signal<TabMenu[]>(this.createInitialTabs());
  tabMenusComputed = computed(() => this.tabMenus());

  protected currentFilterParams: IBenefitsFilterRequest = {
    page: 1,
    pageSize: 5,
  };

  filterRequest = signal<ICandidateFilterRequest>(
    this.currentFilterParams
  );

  activeTab = computed(() => this.filterRequest().statusGroup || '');

  createInitialTabs(): TabMenu[] {
    return [
      { key: 'total', label: 'All Status', count: 0 },
      { key: 'pending', label: 'Pending', count: 0 },
      // { key: 'scheduled', label: 'Scheduled', count: 0 },
      { key: 'no-show', label: 'No-Show', count: 0 },
      { key: 'accept', label: 'Accept', count: 0 },
      { key: 'decline', label: 'Decline', count: 0 },
    ];
  }

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

  ngOnInit() {
    this.fetchLocationDetails();
    this.fetchJobPosition();
    this.fetchTeamID();
    this.fetchInterviewer();

    // this.fetchAppointments();
  }

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

  fetchAppointments() {
    this.loading = true;

    this.currentFilterParams

    // console.log(this.yearData, '=>this.yearData')
    // console.log(this.monthData, '=>this.monthData')

    const updatedParams = {
      ... this.currentFilterParams,
      month: this.monthData === 12 ? undefined : this.monthData,
      year: this.yearData,
      page: 1
    };

    this.appointmentsService.getAppointments<any>(updatedParams).subscribe({
      next: (res) => {
        const newItems = res.items || [];

        this.appointments = [...this.appointments, ...newItems];

        if (newItems.length < Number(this.currentFilterParams.pageSize)) {
          this.hasMoreData = false;
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching appointments:', err);
        this.loading = false;
      }
    });
  }




  updateTabCounts(appointments: any[]) {
    // const counts: { [key: string]: number } = {
    //   total: appointments.length,
    //   pending: appointments.filter(a => a.result.interviewResultText.toLowerCase() === 'pending').length,
    //   scheduled: appointments.filter(a => a.result.interviewResultText.toLowerCase() === 'scheduled').length,
    //   'no-show': appointments.filter(a => a.result.interviewResultText.toLowerCase() === 'no-show').length,
    //   accept: appointments.filter(a => a.result.interviewResultText.toLowerCase() === 'accept').length,
    //   decline: appointments.filter(a => a.result.interviewResultText.toLowerCase() === 'decline').length,
    // };

    // const newTabs = this.tabMenus().map(tab => ({
    //   ...tab,
    //   count: counts[tab.key] ?? 0
    // }));

    // this.tabMenus.set(newTabs);
  }



  // updateTabCounts(groupCounts: { [key: string]: number }) {
  //   const newTabs = this.tabMenus().map(tab => {
  //     let count = 0;

  //     if (tab.key === 'total') {
  //       count = groupCounts['All Status'] ?? 0;
  //     } else {
  //       const key = tab.key
  //         .split('-')
  //         .map(s => s.charAt(0).toUpperCase() + s.slice(1))
  //         .join('-');

  //       count = groupCounts[key] ?? 0;
  //     }

  //     return { ...tab, count };
  //   });

  //   this.tabMenus.set(newTabs);
  // }


  selectedTab = 'total';

  onTabChange(tabKey: string): void {
    this.selectedTab = tabKey;
    this.currentFilterParams.page = 1;
    this.hasMoreData = true;

    console.log(this.currentFilterParams, '=>.this.currentFilterParams tabbb')
    const updatedParams = {
      ...this.currentFilterParams,
      InterviewResult: tabKey === 'total' ? undefined : tabKey,
      page: 1
    };

    this.filterRequest.set(updatedParams);

    this.currentFilterParams = updatedParams

    this.appointments = [];
    this.fetchAppointments();
  }

  onDateRangeSelected(range: { startDate: string; endDate: string }) {
    this.startDate = range.startDate;
    this.endDate = range.endDate;

    const start = new Date(this.endDate);
    this.yearData = start.getFullYear();
    this.monthData = start.getMonth() + 1;

    this.appointments = [];
    this.fetchAppointments();

    this.updateTabCounts(this.appointments);
  }

  // loadAppointments() {
  //   this.updateTabCounts(this.appointments);
  // }




  locationsList: any;
  jobpositionList: any;
  teamList: any;
  interviewerList: any;
  isDeclined = false;
  yearData: number | undefined;
  monthData: number | undefined;

  currentSlide: number[] = [];
  totalSlides: number[] = [];
  canGoPrev: boolean[] = [];
  canGoNext: boolean[] = [];

  dropdownConfigs: any[] = []
  formDetails!: FormGroup;
  dataOptions = []
  appointments: any[] = [];

  selectedPositions: { label: string, value: number }[] = [];

  slideConfig = {
    slidesToShow: 4,
    slidesToScroll: 1,
    infinite: false,
    arrows: false,
    responsive: [
      {
        breakpoint: 1800,
        settings: {
          slidesToShow: 3
        }
      },
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 2
        }
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1
        }
      }
    ]
  };


  @ViewChildren('slickCarousel') carousels!: QueryList<SlickCarouselComponent>;

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

  getTeamNameById(teamId: number): string {
    const team = this.teamList?.find((t: { value: number; }) => t.value === teamId);
    return team?.label ?? '';
  }

  getButtonClass(resultText: string): string {
    switch (resultText?.toLowerCase()) {
      case 'pending':
        return 'tw-bg-[#FFAA00]';
      case 'accept':
        return 'tw-bg-[#0A0]';
      case 'decline':
        return 'tw-bg-red-600';
      default:
        return 'tw-bg-gray-500';
    }
  }

  getTagClass(resultText: string): string {
    switch (resultText?.toLowerCase().trim()) {
      case 'a':
        return 'tag-green';
      case 'b':
        return 'tag-green2';
      case 'c':
        return 'tag-green3';
      case 'd':
        return 'tag-green4';
      case 'f':
        return 'tag-green5';
      default:
        return 'tag-gray';
    }
  }

  onAddPoscitionClick(index: number) {
    this.appointments.forEach(item => item.isAddingPosition = false);
    this.appointments[index].isAddingPosition = true;

    this.dropdownConfigs = [
      {
        type: 'single',
        label: 'Position',
        placeholder: 'Select Position',
        options: this.jobpositionList,
      },
      {
        type: 'multi',
        label: 'History',
        options: this.dataOptions,
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
        }
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
    this.dropdownConfigs = [
      {
        type: 'single',
        label: 'Status',
        placeholder: 'Select Status',
        options: this.dataOptions,
      },
      {
        type: 'multi',
        label: 'History',
        options: this.dataOptions,
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


  loading = false;
  hasMoreData = true;

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
      },
      error: (err) => {
        console.error('Load more failed:', err);
        this.loading = false;
      }
    });
  }

}
