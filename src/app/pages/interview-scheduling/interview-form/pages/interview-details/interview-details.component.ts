import { ChangeDetectorRef, Component, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, Subject, switchMap, takeUntil } from 'rxjs';
import { ApplicationService } from '../../../../../services/application/application.service';
import { CandidatePagedResult } from '../../../../../interfaces/Application/application.interface';
import {
  CandidateTracking,
  CandidateTrackStatus,
} from '../../../../../interfaces/Application/tracking.interface';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { AlertDialogComponent } from '../../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import * as QRCode from 'qrcode';
import { SlickCarouselComponent, SlickItemDirective } from 'ngx-slick-carousel';
import { InterviewFormService } from '../../../../../services/interview-scheduling/interview-form/interview-form.service';
import { ReasonService } from '../../../../../services/admin-setting/reason/reason.service';
import { AlertDialogData } from '../../../../../shared/interfaces/dialog/dialog.interface';
import { NotificationService } from '../../../../../shared/services/notification/notification.service';
import { InterviewDetailsFormService } from '../../../../../services/interview-scheduling/interview-details-form/interview-details-form.service';

dayjs.extend(utc);

// ====== Types สำหรับฝั่ง View ======
type StepStatus = 'done' | 'pending';

type Risk = 'Normal' | 'Warning';

type ScreeningStatus = 'Accept' | 'Decline' | 'Hold'; type CellType = 'text' | 'input' | 'select' | 'multiselect' | 'textarea';

interface WarningRow {
  no: number | string;
  warning: string;

  // ค่าที่จะเก็บ
  result1: any;
  result2: any;

  // ชนิด control ของแต่ละคอลัมน์ (มาจาก API ต่อแถว)
  result1Type: CellType;
  result2Type: CellType;

  // option ต่อแถว (ถ้าเป็น select/multiselect)
  result1Options?: Array<{ label: string; value: any }>;
  result2Options?: Array<{ label: string; value: any }>;
}

interface Applicant {
  id: string;
  name: string;
  gpa: number;
  university: string;
  appliedDate: string | Date;
  email: string;
  positions: string[];
  grade: string;
  views: number;
  avatarUrl: string;
  faculty?: string;
  program?: string;
  phone?: string;
  interview1Date?: string;
  interview1Status?: string;
  interview1Result?: number;
  interview2Date?: string;
  interview2Status?: string;
  interview2Result?: number;
}

// ===== Stage History (view) =====
type CategoryOption = { categoryId: number; categoryName: string };
type ReasonOption = { reasonId: number; reasonText: string; checked?: boolean };

interface StageSection {
  historyId: number;
  stageId: number;
  stageName: string;
  stageNameNormalized: string;  // lower-cased for switch
  headerTitle: string;

  hrUserName: string;
  stageDate: string | Date;

  categories: CategoryOption[];
  selectedCategoryId?: number;

  reasons: ReasonOption[];

  // notes: ใช้กับ Screened/Offered
  notes?: string | null;
  // ใช้กับ Interview 1/2 (ถ้า API ยังไม่มี แสดง '—')
  strength?: string | null;
  concern?: string | null;

  open: boolean;
}

interface AssessmentItem {
  no: number;
  review: string;
  result: string;
  score: number;
  visibility: boolean;
  details: string;
  detailsPositive?: boolean;
}

interface WarningItem {
  no: number;
  warning: string;
  result: string;
  risk: Risk;
  visibility: boolean;
  detail: string;
}

interface Screening {
  screenedBy: string;
  screeningDate: string | Date;
  status: ScreeningStatus;
  reasons: string[]; // list ของ key
  description: string;
}

interface CommentItem {
  id: string;
  author: string;
  date: string; // แสดงผลแล้วฟอร์แมตรูปแบบ
  text: string;
}

interface Attachment {
  name: string;
  file: string;
}

interface HistoryLog {
  date: string;
  action: string;
}

type Variant = 'green' | 'blue' | 'gray' | 'red' | 'white';
interface StepperItem {
  label: string;
  sub?: string;
  date?: string;
  variant?: Variant;
}

interface ApiComment {
  id: number;
  parentCommentId: number | null;
  candidateId: number;
  commentByUserId: number;
  commentByUserName: string;
  commentText: string;
  commentType: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  canDelete: boolean;
  replies: ApiComment[];
}

interface ViewComment {
  id: number;
  parentId: number | null;
  author: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  commentType?: string;
  isEdited: boolean;
  canDelete: boolean;
  replies: ViewComment[];
  ui: {
    isReplying: boolean;
    replyText: string;
    isEditing: boolean;
    editText: string;
  };
}

@Component({
  selector: 'app-interview-details',
  templateUrl: './interview-details.component.html',
  styleUrl: './interview-details.component.scss'
})
export class InterviewDetailsComponent {
  // ====== Filter ======
  filterButtons: { label: string; key: string; color: string }[] = [];
  disabledKeys: string[] = [];

  // ====== Routing ======
  applicantId: number = 0;
  appointmentId: number = 0;
  stageId: number = 0;
  interview1AppointmentId: string | undefined;
  interview2AppointmentId: string | undefined;

  // ====== Data Model (View) ======
  applicant: Applicant = {
    id: '',
    name: '',
    gpa: 0,
    university: '',
    appliedDate: '',
    email: '',
    positions: [],
    grade: '',
    views: 0,
    avatarUrl: '',
  };

  steps: { label: string; date?: string; status: StepStatus; sub?: string }[] =
    [];
  currentIndex = -1; // ไม่มีขั้นไหนเสร็จ = -1

  assessments: AssessmentItem[] = [];
  assessmentTotalScore = 0;
  assessmentMaxScore = 0;
  assessmentRecommendation = '';

  warnings: WarningItem[] = [];

  screening: Screening = {
    screenedBy: '—',
    screeningDate: '',
    status: 'Accept',
    reasons: [],
    description: '',
  };

  isEditing = false;
  private initialSnapshot: any = null;

  formDetails!: FormGroup;
  formInterviewDetails!: FormGroup;

  comments: CommentItem[] = [];
  currentUserName = '';
  newCommentText = '';

  transcripts: Attachment[] = [];
  certifications: Attachment[] = [];
  historyLogs: HistoryLog[] = [];
  today: string | undefined;
  nowDate: string | undefined;

  applicationFormSubmittedDate: string | Date = '';

  // UI: ขนาดรอยบั้งของ chevron (ไม่ใช้แล้ว แต่คงไว้หากต้องกลับไปใช้ pipeline เดิม)
  chevW = 28;

  // ====== Stepper bindings ======
  stepperItems: StepperItem[] = [];
  activeStepIndex = 0;
  disabledStepLabels: string[] = [];

  stageSections: StageSection[] = [];
  usernameLogin: string | undefined;

  @ViewChildren('textContent') textContents!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('strengthText') strengthTexts!: QueryList<ElementRef>;
  @ViewChildren('concernText') concernTexts!: QueryList<ElementRef>;

  isExpanded: boolean = false;
  isOverflow: boolean = false;

  reasonsInterview1: any[] = [];
  reasonsInterview2: any[] = [];

  // Loading/State
  isLoading = false;
  isNotFound = false;

  private destroy$ = new Subject<void>();
  qrCodeImageUrl: string | undefined;

  // ===== Comments state =====
  commentsLoading = false;
  commentsTree: ViewComment[] = [];
  commentCtrl!: FormControl<string>;

  foundisSummary: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private interviewFormService: InterviewFormService,
    private applicationService: ApplicationService,
    private reasonService: ReasonService,
    private notificationService: NotificationService,
    private interviewDetailsFormService: InterviewDetailsFormService
  ) { }

  // ---------- Carousel config ----------
  @ViewChildren(SlickItemDirective) slickItems!: QueryList<SlickItemDirective>;

  slideConfig: any = {
    slidesToShow: 2,
    slidesToScroll: 1,
    dots: false,
    arrows: false,
    infinite: false,
    responsive: [
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
          dots: false
        }
      }
    ]
  };

  // ---------- Carousel controls ----------
  currentSlide: number[] = [];
  totalSlides: number[] = [];
  canGoPrev: boolean[] = [];
  canGoNext: boolean[] = [];

  @ViewChildren('slickCarousel') carousels!: QueryList<SlickCarouselComponent>;

  // ====== Candidate Warning UI ======
  isRevOpen = true; // ปุ่ม chevron พับ/กาง
  isWarnOpen = true;
  warningRows: any[] = [];
  warningColumns: any[] = [];

  reviewHistory: any[] = [];
  selectedCategoryId: number | null = null;

  private initWarningColumns() {
    // this.warningColumns = [
    //   { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
    //   { header: 'Question', field: 'warning', type: 'text', minWidth: '220px', wrapText: true, },
    //   { header: 'Interview 1', field: 'result1', type: 'input', minWidth: '160px' },
    //   { header: 'Interview 2', field: 'result2', type: 'select', minWidth: '160px' }
    // ];

    this.warningColumns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Question', field: 'warning', type: 'text', minWidth: '220px', wrapText: true },

      // ใช้ชนิดแบบ dynamic: ดู type/option จากแถว
      { header: 'Interview 1', field: 'result1', type: 'dynamic', typeKey: 'result1Type', optionsKey: 'result1Options', minWidth: '160px' },
      { header: 'Interview 2', field: 'result2', type: 'dynamic', typeKey: 'result2Type', optionsKey: 'result2Options', minWidth: '160px' },
    ];
  }

  selectedTab: string = '';

  // ===================== Lifecycle =====================
  ngOnInit() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    this.today = `${year}-${month}-${day}`;
    this.nowDate = this.today;
    this.commentCtrl = this.fb.control<string>('', { nonNullable: true });

    this.filterButtons = [{ label: 'Print', key: 'print', color: '#0055FF' }];
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applicantId = Number(params['id'] || 0);
        this.stageId = Number(params['interview'] || 1);
        this.selectedTab = 'tab' + params['interview'];

        this.fetchCandidateTracking();
        // this.fetchRecruitmentStagesWithReasons(Number(params['interview']) + 1)
        this.fetchFormById(this.stageId)
      });

    // ตาราง Warning
    this.initWarningColumns();

    const userString = sessionStorage.getItem('user');
    if (userString) {
      const user = JSON.parse(userString);
      this.usernameLogin = user.username;
    }

    this.initializeForm()
    this.initializeFormInterviewDetail()
  }

  ngAfterViewInit() {
    this.nextTick(() => this.setActionButtons('view'));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===================== Data Fetch =====================
  initializeForm() {
    this.formDetails = this.fb.group({
      userInterviewReview: [this.foundisSummary?.hrUserName || this.usernameLogin],
      dateInterviewReview: [this.formatDateForInput(this.foundisSummary?.stageDate) || this.nowDate],
      noteInterviewReview: [this.foundisSummary?.notes || '']
    });
  }

  initializeFormInterviewDetail() {
    this.formInterviewDetails = this.fb.group({
      question: [''],
      interview1: [''],
      interview2: [''],
    });
  }

  private fetchCandidateTracking() {
    if (!this.applicantId) {
      this.isNotFound = true;
      return;
    }

    this.isLoading = true;

    this.applicationService.getTrackingApplications({
      page: 1,
      pageSize: 20,
      search: String(this.applicantId),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: CandidatePagedResult<CandidateTracking>) => {
          const items = res?.items || [];
          if (!items.length) {
            this.isNotFound = true;
            this.isLoading = false;
            return;
          }

          const exact =
            items.find((i) => Number(i.userID) === this.applicantId) ||
            items[0];

          this.mapTrackingToView(exact);
          this.isLoading = false;

          // Attachments
          this.fetchFiles(Number(this.applicantId || 0));
        },
        error: (err) => {
          console.error(
            '[ApplicationForm] getTrackingApplications error:',
            err
          );
          this.isNotFound = true;
          this.isLoading = false;
        },
      });

    this.interviewFormService.getApplicantTracking(this.applicantId).subscribe({
      next: (res) => {
        const appointmentIdKey = `interview${this.stageId}AppointmentId`;
        const appointmentIdValue = res[appointmentIdKey];

        (this as any)[appointmentIdKey] = appointmentIdValue;
      },
      error: (err) => {
        console.error(err);
      },
    });

  }

  fetchInterviewer() {
    this.interviewFormService.getApplicantReview(
      Number(this.applicantId),
      Number(this.stageId) + 1
    ).subscribe({
      next: (res) => {
        this.reviewHistory = res.map((item: any) => ({
          ...item,
          expandState: {
            strength: false,
            concern: false,
          },
          overflowState: {
            strength: false,
            concern: false,
          }
        }));

        const countIsSummaryFalse = this.reviewHistory.filter(item => item.isSummary === false).length;

        setTimeout(() => {
          this.slideConfig = {
            ...this.slideConfig,
            dots: countIsSummaryFalse > 2,
            slidesToShow: countIsSummaryFalse === 1 ? 1 : 2,
            responsive: [
              {
                breakpoint: 768,
                settings: {
                  slidesToShow: 1,
                  dots: countIsSummaryFalse > 1
                }
              }
            ]
          };

          // 👇 รี init slick
          setTimeout(() => {
            this.carousels.forEach((carousel) => {
              carousel.unslick();
              carousel.initSlick();
            });
          }, 0);

          // ✅ เช็ค overflow หลัง DOM update
          // setTimeout(() => this.checkAllOverflow(), 0);
        }, 0);

        setTimeout(() => this.checkAllOverflow(), 0);
        this.foundisSummary = this.reviewHistory.find(user => user.isSummary === true);

        this.initializeForm()

        this.reasonsInterview1.forEach(category => {
          category.rejectionReasons.forEach((reason: { reasonId: any; checked: boolean; }) => {
            if (this.foundisSummary?.selectedReasonIds?.includes(reason.reasonId)) {
              reason.checked = true;
            } else {
              reason.checked = false;
            }
          });
        });

        this.selectedCategoryId = this.foundisSummary?.categoryId
      },

      error: (error) => {
        console.error('Error fetching applicant review:', error);
      }
    });
  }

  fetchRecruitmentStagesWithReasons(interview: number) {
    this.reasonService.getRecruitmentStagesWithReasons(interview).subscribe({
      next: (response) => {
        this.reasonsInterview1 = response;

        this.reasonsInterview1 = response.map((category: any) => ({
          ...category,
          rejectionReasons: category.rejectionReasons.map((reason: any) => ({
            ...reason,
            checked: false
          }))
        }));

        this.fetchInterviewer();
      },
      error: (error) => {
        console.error('Error fetching Recruitment Stages with reasons:', error);
      },
    });
  }

  private fetchFiles(id: number) {
    if (!id) return;
    this.applicationService.getFileByCandidateId(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          const files = Array.isArray(res) ? res : [];

          // 1) Avatar จาก fileType = 'Profile'
          const profile = files.find(f => String(f?.fileType).toLowerCase() === 'profile');

          this.applicant.avatarUrl = profile?.filePath || '';

        },
        error: (e) => {
          console.error('[ApplicationForm] getFileByCandidateId error:', e);
          // ไม่เปลี่ยน state ถ้า error
        }
      });
  }

  // ===================== Mapping =====================
  private mapTrackingToView(ct: CandidateTracking) {
    // ----- Applicant header -----
    this.applicant = {
      id: String(ct.userID ?? ''),
      name: ct.fullName || ct.fullNameTH || '—',
      gpa: Number(ct.gpa ?? 0),
      university: ct.university || '—',
      appliedDate: ct.submitDate || '',
      email: ct.email || '—',
      positions: Array.from(
        new Set(
          (ct.positions ?? [])
            .map((p) => p?.namePosition)
            .filter((n): n is string => !!n)
        )
      ),
      grade: ct.gradeCandidate || '—',
      views: Number(ct.countLike ?? 0),
      avatarUrl: '',
      faculty: ct.faculty,
      program: ct.major,
      phone: ct.phoneNumber,
      interview1Date: dayjs(ct.interview1.date).format('DD MMMM YYYY'),
      interview1Status: ct.interview1.status,
      interview1Result: ct.interview1.id,
      interview2Date: dayjs(ct.interview2.date).format('DD MMMM YYYY'),
      interview2Status: ct.interview2.status,
      interview2Result: ct.interview2.id,
    };

    this.applicationFormSubmittedDate = ct.submitDate || '';

    // ----- Warnings (mock) -----
    this.warnings = [
      {
        no: 1,
        warning: 'Work History',
        result: '—',
        risk: 'Normal',
        visibility: true,
        detail: '—',
      },
    ];

    // ----- Attachments / Comments / Logs -----
    this.comments = [];
    this.currentUserName = '';
    this.transcripts = [];
    this.certifications = [];
    this.historyLogs = [];
  }

  // ===================== UI Events =====================
  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit':
        // this.setActionButtons('edit');
        this.onEditClicked();
        // this.isEditing = true
        // this.formDetails.enable();
        break;
      case 'save':
        this.onSaveClicked()
        break;
    }
  }

  formatDateForInput(dateString: string | null | undefined): string {
    if (!dateString) return '';

    if (dateString.includes('T')) {
      return dateString.split('T')[0];
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  formatTimeForInput(dateString: string | null | undefined): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  formatTimeForInputWithOffset(dateString: string | null | undefined, offsetMinutes = 30): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    // บวกเวลา offset (เช่น 30 นาที)
    date.setMinutes(date.getMinutes() + offsetMinutes);

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  toggleReasonCheck(reason: any) {
    if (!this.foundisSummary) {
      reason.checked = !reason.checked;
    }
  }

  get filteredReviewHistory() {
    return this.reviewHistory.filter(item => item.isSummary === false);
  }

  getCurrentDateTimeString(): string {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // เดือน (0-11) เลยบวก 1
    const day = String(now.getDate()).padStart(2, '0');

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  getRejectionReasons(categoryId: number) {
    const category = this.reasonsInterview1.find(item => item.categoryId === categoryId);
    return category?.rejectionReasons?.filter((r: { isActive: any; }) => r.isActive) || [];
  }

  selectCategory(categoryId: number) {
    this.reasonsInterview1 = this.reasonsInterview1.map((category: any) => ({
      ...category,
      rejectionReasons: category.rejectionReasons.map((reason: any) => ({
        ...reason,
        checked: false
      }))
    }));

    if (this.selectedCategoryId === categoryId) {
      this.selectedCategoryId = null; // ถ้ากดซ้ำ → reset
    } else {
      this.selectedCategoryId = categoryId; // กดอันใหม่ → set ใหม่
    }
  }

  toggleExpand(index: number, field: 'strength' | 'concern') {
    this.reviewHistory[index].expandState[field] = !this.reviewHistory[index].expandState[field];

    setTimeout(() => this.checkOverflow(index, field), 0);
  }

  checkOverflow(index: number, field: 'strength' | 'concern') {
    const el = field === 'strength'
      ? this.strengthTexts.toArray()[index].nativeElement
      : this.concernTexts.toArray()[index].nativeElement;

    this.reviewHistory[index].overflowState[field] = el.scrollHeight > el.clientHeight;
  }

  checkAllOverflow() {
    this.reviewHistory.forEach((review, i) => {
      const strengthEl = this.strengthTexts.toArray()[i]?.nativeElement;
      const concernEl = this.concernTexts.toArray()[i]?.nativeElement;

      if (strengthEl) {
        review.overflowState.strength = strengthEl.scrollHeight > strengthEl.clientHeight;
      }

      if (concernEl) {
        review.overflowState.concern = concernEl.scrollHeight > concernEl.clientHeight;
      }
    });
  }

  onComfirmReview() {
    const payload = this.formDetails.value;

    const isoDate = new Date(payload.dateInterviewReview).toISOString();
    let checkedReasonIds = []
    checkedReasonIds = this.reasonsInterview1.flatMap((category: { rejectionReasons: any[]; }) =>
      category.rejectionReasons
        .filter(reason => reason.checked === true)
        .map(reason => reason.reasonId)
    );

    const checkedCategoryIds = this.reasonsInterview1
      .filter(category => category.rejectionReasons.some((reason: { checked: boolean; }) => reason.checked === true))
      .map(category => category.categoryId);

    const appointmentIdKey = `interview${this.stageId}AppointmentId`;
    const appointmentId = (this as any)[appointmentIdKey];

    const transformedPayload = {
      applicationId: this.applicantId,
      stageId: this.stageId + 1,
      categoryId: checkedCategoryIds[0],
      isSummary: true,
      stageDate: isoDate,
      appointmentId: appointmentId.trim(),
      satisfaction: null,
      notes: payload.noteInterviewReview,
      strength: "",
      concern: "",
      selectedReasonIds: checkedReasonIds
    }

    this.interviewFormService.postInterviewReview(transformedPayload).subscribe({
      next: () => {
        this.fetchInterviewer()
        this.foundisSummary = this.reviewHistory.find(user => user.isSummary === true);
      },
      error: (err) => {
        console.error('Error Rescheduled:', err);
      }
    });
  }

  onCancelReview() {
    this.initializeForm()
    this.selectedCategoryId = null;
  }


  onEditClicked() {
    this.isEditing = true;
    this.formDetails.enable();
    // this.initialSnapshot = this.buildSnapshot();

    this.nextTick(() => this.setActionButtons('edit'));
  }

  private setActionButtons(mode: 'view' | 'edit') {
    if (mode === 'view') {
      this.filterButtons = [{ label: 'Edit', key: 'edit', color: '#000000' }];
      this.disabledKeys = [];
    } else {
      this.filterButtons = [{ label: 'Save', key: 'save', color: '#000055' }];
      this.disabledKeys = ['save'];
    }
  }

  private nextTick(fn: () => void) {
    Promise.resolve().then(fn);
  }

  addComment() {
    const text = (this.newCommentText || '').trim();
    if (!text) return;
    this.comments.push({
      id: 'c' + (this.comments.length + 1),
      author: this.currentUserName || 'Current User',
      date: new Date().toLocaleString(),
      text,
    });
    this.newCommentText = '';
  }

  onInterviewClick(tab: string) {
    this.selectedTab = tab;
    const interviewNumber = tab === 'tab1' ? '1' : '2';
    this.stageId = Number(interviewNumber)

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { interview: interviewNumber },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  getInterviewDateByStage(): string {
    const key = `interview${this.stageId}Date`;
    return (this.applicant as Record<string, any>)?.[key] ?? '';
  }

  onTimeStartChange(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    const newTimeValue = inputElement.value;

    // เก็บค่าเดิมไว้ก่อนเปลี่ยน (ก่อน user เปลี่ยน)
    const oldTimeValue = this.formatTimeForInput(this.getInterviewDateByStage());

    const dateValue = this.formatDateForInput(this.getInterviewDateByStage());
    const dataPatch = `${dateValue}T${newTimeValue}`;

    const appointmentIdKey = `interview${this.stageId}AppointmentId`;
    const appointmentId = (this as any)[appointmentIdKey];

    const payload = {
      appointmentId: appointmentId,
      interviewStartTime: dataPatch
    };

    setTimeout(() => {
      this.interviewFormService.updateInterviewDateStart(payload).subscribe({
        next: () => { },
        error: (err) => {
          console.error('Error Rescheduled:', err);
          this.notificationService.error('Failed to set start interview time');

          inputElement.value = oldTimeValue;
        }
      });
    }, 3000)
  }

  onTimeEndChange(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    const newTimeValue = inputElement.value;

    const oldTimeValue = this.formatTimeForInput(this.getInterviewDateByStage());

    const dateValue = this.formatDateForInput(this.getInterviewDateByStage());
    const dataPatch = `${dateValue}T${newTimeValue}`;

    const appointmentIdKey = `interview${this.stageId}AppointmentId`;
    const appointmentId = (this as any)[appointmentIdKey];

    const payload = {
      appointmentId: appointmentId,
      interviewEndTime: dataPatch
    };

    setTimeout(() => {
      this.interviewFormService.updateInterviewDateEnd(payload).subscribe({
        next: () => { },
        error: (err) => {
          console.error('Error Rescheduled:', err);
          this.notificationService.error('Failed to set end interview time');

          inputElement.value = oldTimeValue;
        }
      });
    }, 3000)
  }

  getInterview1StatusClass(): string {
    switch (this.applicant?.interview1Result) {
      case 12: return 'tw-bg-yellow-400 tw-text-black';           // Pending
      case 15: return 'tw-bg-blue-400 tw-text-white';            // Inprocess
      case 16: return 'tw-bg-indigo-400 tw-text-white';          // Scheduled
      case 21: return 'tw-bg-[#005500] tw-text-white';           // Pass Interview (สีเขียว)
      case 22: return 'tw-bg-red-500 tw-text-white';             // Not Pass Interview (สีแดง)
      case 23: return 'tw-bg-gray-500 tw-text-white';            // No Show
      case 24: return 'tw-bg-purple-400 tw-text-white';          // Reschedule
      case 25: return 'tw-bg-pink-400 tw-text-white';            // Candidate Decline
      case 41: return 'tw-bg-green-700 tw-text-white';           // Hire
      case 42: return 'tw-bg-red-700 tw-text-white';             // Not Hire
      case 43: return 'tw-bg-orange-400 tw-text-white';          // Comparison
      default: return 'tw-bg-gray-300 tw-text-black';            // Default สีเทา
    }
  }

  getInterview2StatusClass(): string {
    switch (this.applicant?.interview2Result) {
      case 12: return 'tw-bg-yellow-400 tw-text-white';           // Pending
      case 15: return 'tw-bg-blue-400 tw-text-white';            // Inprocess
      case 16: return 'tw-bg-indigo-400 tw-text-white';          // Scheduled
      case 21: return 'tw-bg-[#005500] tw-text-white';           // Pass Interview (สีเขียว)
      case 22: return 'tw-bg-red-500 tw-text-white';             // Not Pass Interview (สีแดง)
      case 23: return 'tw-bg-gray-500 tw-text-white';            // No Show
      case 24: return 'tw-bg-purple-400 tw-text-white';          // Reschedule
      case 25: return 'tw-bg-pink-400 tw-text-white';            // Candidate Decline
      case 41: return 'tw-bg-green-700 tw-text-white';           // Hire
      case 42: return 'tw-bg-red-700 tw-text-white';             // Not Hire
      case 43: return 'tw-bg-orange-400 tw-text-white';          // Comparison
      default: return 'tw-bg-gray-300 tw-text-black';            // Default สีเทา
    }
  }

  getCategoryBtnClass(c: CategoryOption, selectedId?: number | null) {
    const isActive = c.categoryId === selectedId;
    const name = (c.categoryName || '').toLowerCase();
    const tone =
      name.includes('accept') ? 'tw-bg-green-500 tw-text-white tw-border-green-600' :
        name.includes('decline') ? 'tw-bg-red-500 tw-text-white tw-border-red-600' :
          name.includes('application decline') ? 'tw-bg-red-500 tw-text-white tw-border-red-600' :
            name.includes('no-show') ? 'tw-bg-gray-200 tw-text-gray-800 tw-border-gray-300' :
              name.includes('on hold') ? 'tw-bg-amber-500 tw-text-white tw-border-amber-600' :
                'tw-bg-white tw-text-gray-700 tw-border-gray-300';

    const inactive = 'hover:tw-brightness-105';
    const activeRing = 'tw-ring-2 tw-ring-white/40';

    return isActive ? `${tone} ${activeRing}` : `tw-bg-white tw-text-gray-700 tw-border-gray-300 ${inactive}`;
  }

  generateQRCode(text: string): void {
    QRCode.toDataURL(text, (err: any, url: string) => {
      if (err) {
        console.error(err);
        return;
      }

      this.qrCodeImageUrl = url;
    });
  }

  onViewDetailClick() {
    const queryParams = {
      id: this.applicantId
    }
    this.router.navigate(['/applications/screening/application-form'], { queryParams });
  }

  onInterviewDetailClick() {
    const queryParams = {
      id: this.applicantId,
      interview: this.stageId,
    }
    this.router.navigate(['/interview-scheduling/interview-form/details'], { queryParams });
  }

  onReviewClick(idEmployee?: number) {

    if (!idEmployee) {
      const userDataString = sessionStorage.getItem('user');
      if (userDataString !== null) {
        const userData = JSON.parse(userDataString);
        idEmployee = userData.idEmployee;
      }
    }

    const queryParams = {
      id: this.applicantId,
      interview: this.stageId,
      idEmployee: idEmployee
    }

    this.router.navigate(['/interview-scheduling/interview-form/review'], { queryParams });
  }

  genQRReviewPage() {
    let idEmployee
    const userDataString = sessionStorage.getItem('user');
    if (userDataString !== null) {
      const userData = JSON.parse(userDataString);
      idEmployee = userData.idEmployee;
    }

    const queryParams = {
      id: this.applicantId,
      interview: this.stageId,
      idEmployee: idEmployee
    };

    const urlTree = this.router.createUrlTree(
      ['/interview-scheduling/interview-form/review'],
      { queryParams }
    );

    const relativeUrl = this.router.serializeUrl(urlTree);
    const fullUrl = window.location.origin + relativeUrl;

    this.generateQRCode(fullUrl)

  }

  onSaveClicked() {
    // if (!this.hasFormChanged()) return;

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
        message: 'Are you sure you want to save this data?',
        confirm: true
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (confirmed) {
        console.log('Save Click')
      }
    });

  }

  // ===== Helpers เดิม (ยังเก็บไว้เผื่อใช้งานต่อ) =====
  isDone(i: number) {
    return i <= this.currentIndex;
  }

  private stepVariant(i: number): 'green' | 'blue' | 'gray' | 'red' | 'white' {
    const st = this.steps?.[i];
    return statusToVariant(st?.sub);
  }

  private isColored(i: number) {
    const v = this.stepVariant(i);
    return v === 'green' || v === 'blue' || v === 'red';
  }

  stepBgTextClass(i: number) {
    const v = this.stepVariant(i);
    switch (v) {
      case 'green':
        return ['tw-text-white'].concat([`tw-bg-[${COLOR.green}]`]);
      case 'blue':
        return ['tw-text-white'].concat([`tw-bg-[${COLOR.blue}]`]);
      case 'red':
        return ['tw-text-white'].concat([`tw-bg-[${COLOR.red}]`]);
      case 'gray':
        return ['tw-text-gray-700', `tw-bg-[${COLOR.grayBg}]`];
      case 'white':
      default:
        return ['tw-text-gray-700', 'tw-bg-white'];
    }
  }

  circleClass(i: number) {
    const v = this.stepVariant(i);
    if (v === 'green' || v === 'blue' || v === 'red') {
      return ['tw-border-2', 'tw-border-white/80', 'tw-text-white'];
    }
    return ['tw-border', 'tw-border-gray-300', 'tw-text-gray-600'];
  }

  labelClass(i: number) {
    const v = this.stepVariant(i);
    if (v === 'green' || v === 'blue' || v === 'red') return ['tw-text-white'];
    return ['tw-text-gray-700'];
  }

  chevFill(i: number) {
    const v = this.stepVariant(i);
    switch (v) {
      case 'green':
        return COLOR.green;
      case 'blue':
        return COLOR.blue;
      case 'red':
        return COLOR.red;
      case 'gray':
        return COLOR.white;
      case 'white':
      default:
        return COLOR.white;
    }
  }

  chevStroke(i: number) {
    const colored = this.isColored(i);
    return colored ? COLOR.white : COLOR.grayBorder;
  }

  clipLastGreen(i: number, last: boolean) {
    if (last) return {};
    if (!this.isColored(i)) return {};
    const notch = this.chevW + 2;
    const poly = `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%)`;
    return {
      clipPath: poly,
      WebkitClipPath: poly,
      backfaceVisibility: 'hidden',
      transform: 'translateZ(0)',
    };
  }

  variantBg(i: number) {
    switch (this.stepVariant(i)) {
      case 'green':
        return COLOR.green;
      case 'blue':
        return COLOR.blue;
      case 'red':
        return COLOR.red;
      case 'gray':
        return COLOR.grayBg;
      default:
        return COLOR.white;
    }
  }
  variantText(i: number) {
    return this.isColored(i) ? '#FFFFFF' : '#374151';
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


  // Form Interview Detail
  result1Type = '';
  result2Type = '';
  fetchFormById(stageId: number) {
    this.interviewDetailsFormService.getFormById(stageId).subscribe({
      next: (response: any) => {
        const fields = Array.isArray(response?.fields) ? response.fields : [];

        this.warningRows = fields.map((item: any, idx: number) => {
          const type = this.mapFieldType(item.fieldType);

          // แปลง options จาก API ถ้ามี
          const opts = Array.isArray(item.options)
            ? item.options.map((o: any) => ({ label: o.name ?? o.label ?? String(o), value: o.id ?? o.value ?? o }))
            : undefined;

          const row: WarningRow = {
            no: idx + 1,
            warning: item.questionName ?? '-',

            result1: type === 'multiselect' ? [] : '',
            result2: type === 'multiselect' ? [] : '',

            result1Type: type,
            result2Type: type,

            result1Options: opts,
            result2Options: opts,
          };

          return row;
        });
        
      },
      error: (error) => console.error(error),
    });
  }

  mapFieldType(apiType: string): CellType {
    switch ((apiType || '').toLowerCase()) {
      case 'checkbox': return 'multiselect'; // checkbox หลายตัว => multiselect
      case 'dropdown': return 'select';
      case 'textarea': return 'textarea';
      case 'text': return 'input';
      default: return 'text';
    }
  }
}

// ====== Helpers ======
function has(v: any): boolean {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function formatDay(d?: string): string | undefined {
  if (!has(d)) return undefined;
  const m = dayjs.utc(String(d));
  if (!m.isValid()) return undefined;
  return m.format('DD MMM YYYY');
}

function isInProcess(status?: string | null): boolean {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return [
    'inprocess',
    'in process',
    'pending',
    'scheduled',
    'schedule',
    'in schedule',
    'awaiting',
    'waiting',
  ].includes(s);
}

function stepStatusFrom(
  s?: CandidateTrackStatus,
  fallbackDate?: string
): StepStatus {
  if (!s) return has(fallbackDate) ? 'done' : 'pending';
  if (isInProcess(s.status)) return 'pending';
  return has(s.status) || has(s.date) ? 'done' : 'pending';
}

function subFrom(s?: CandidateTrackStatus, fallback = ''): string {
  return (s?.status && String(s.status)) || fallback;
}

// ===== Palette =====
const COLOR = {
  green: '#0AAA2A',
  blue: '#0A57C3',
  red: '#DC2626',
  grayBg: '#F3F4F6',
  white: '#FFFFFF',
  grayBorder: '#E5E7EB',
};

// สถานะ -> โทนสี
function statusToVariant(
  raw?: string | null
): 'green' | 'blue' | 'gray' | 'red' | 'white' {
  const s = String(raw || '').trim().toLowerCase();

  if (!s) return 'white';
  if (/(decline|declined|reject|rejected|fail|failed|decline offer)/.test(s))
    return 'red';
  if (/(inprocess|in process|scheduled|schedule|in schedule|inprogress)/.test(s))
    return 'blue';
  if (/(pending|awaiting|waiting)/.test(s)) return 'gray';
  if (
    /(accept|accepted|pass|passed|hired|applied|submitted|screened|offer|offered)/.test(
      s
    )
  )
    return 'green';
  return 'white';
}