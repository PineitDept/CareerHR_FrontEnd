import { ChangeDetectorRef, Component, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, combineLatest, map, Observable, of, Subject, switchMap, takeUntil } from 'rxjs';
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

type ScreeningStatus = 'Accept' | 'Decline' | 'Hold';

// --- เพิ่ม type ด้านบนไฟล์ ---
type ResultGroupKey = 'accept' | 'decline';
type ResultGroup = {
  key: ResultGroupKey;
  label: string;
  regex: RegExp;
  items: any[];
};

type CellType = 'text' | 'input' | 'select' | 'multiselect' | 'textarea';

interface WarningRow {
  no?: number | string;
  warning?: string;

  // ค่าที่จะเก็บ
  result1?: any;
  result2?: any;

  // ชนิด control ของแต่ละคอลัมน์ (มาจาก API ต่อแถว)
  result1Type?: CellType;
  result2Type?: CellType;

  // option ต่อแถว (ถ้าเป็น select/multiselect)
  result1Options?: any;
  result2Options?: any;
  selectedIds?: []
  result1SelectedIds?: any;
  result1Readonly?: any;
  result2SelectedIds?: any;
  result2Readonly?: any;
  questionId?: any;
}

interface Applicant {
  id: string;
  name: string;
  gpa: number;
  age?: number;
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
  graduation_year?: number;
  interview1Date?: string;
  interview1DateFormat?: string;
  interview1Status?: string;
  interview1Result?: number;
  interview2Date?: string;
  interview2DateFormat?: string;
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
  selector: 'app-interview-form-details',
  templateUrl: './interview-form-details.component.html',
  styleUrl: './interview-form-details.component.scss'
})
export class InterviewFormDetailsComponent {
  // ====== Filter ======
  filterButtons: { label: string; key: string; color: string }[] = [];
  disabledKeys: string[] = [];

  // ====== Routing ======
  applicantId: number = 0;
  appointmentId: number = 0;
  stageId: number = 0;
  round: number = 1;
  isLatestRound = true;
  interview1AppointmentId: string | undefined;
  interview2AppointmentId: string | undefined;
  resultId1: number = 0;
  resultId2: number = 0;

  // ====== Data Model (View) ======
  applicant: Applicant = {
    id: '',
    name: '',
    gpa: 0,
    age: 0,
    university: '',
    appliedDate: '',
    email: '',
    positions: [],
    grade: '',
    views: 0,
    avatarUrl: '',
    faculty: '',
    program: '',
    phone: '',
    graduation_year: 0,
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
  isDetailOpen = false;
  isDetail1Open = false;
  isDetail2Open = false;
  detailRows: any[] = [];
  detailColumns: any[] = [];
  detail1Rows: any[] = [];
  detail1Columns: any[] = [];
  detail2Rows: any[] = [];
  detail2Columns: any[] = [];

  reviewHistory: any[] = [];
  selectedCategoryId: number | null = null;

  editReview = false;
  allowEditButton = true;

  private initdetailColumns() {
    this.detailColumns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Question', field: 'warning', type: 'text', minWidth: '220px', wrapText: true },
      { header: 'Interview 1', field: 'result1', type: 'dynamic', typeKey: 'result1Type', options: 'result1Options', minWidth: '160px' },
    ];
  }

  private initdetail1Columns() {
    this.detail1Columns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Question', field: 'warning', type: 'text', minWidth: '220px', wrapText: true },
      { header: 'Interview 1', field: 'result1', type: 'dynamic', typeKey: 'result1Type', options: 'result1Options', minWidth: '160px' },
      { header: 'Interview 2', field: 'result2', type: 'dynamic', typeKey: 'result2Type', options: 'result2Options', minWidth: '160px' },
    ];
  }

  private initdetail2Columns() {
    this.detail2Columns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Question', field: 'warning', type: 'text', minWidth: '220px', wrapText: true },
      { header: 'Interview 2', field: 'result2', type: 'dynamic', typeKey: 'result2Type', options: 'result2Options', minWidth: '160px' },
    ];
  }

  selectedTab: string = '';

  snapshotInputForm: any;
  // --- เพิ่ม state ใน class ---
  selectedGroupKey: ResultGroupKey | null = null;
  resultGroups: ResultGroup[] = [
    { key: 'accept', label: 'Accept', regex: /(accept|on\s*hold|pass)/i, items: [] },
    { key: 'decline', label: 'Decline', regex: /(decline|no[\s-]?show)/i, items: [] },
  ];

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
        this.round = Number(params['round'] || 0);
        this.selectedTab = 'tab' + params['interview'];

        this.fetchCandidateTracking();
        // this.fetchRecruitmentStagesWithReasons(this.stageId + 1);
        // this.fetchInterviewer();
        // this.fetchFormById(this.stageId)

        this.loadReasonsAndReview(this.stageId, this.applicantId);

        // ----- โหลด Comments -----
        this.loadComments(this.applicantId);
      });

    // ตาราง Warning
    this.initdetailColumns();
    this.initdetail1Columns();
    this.initdetail2Columns();

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
          const items = res?.items ?? [];
          if (!items.length) {
            this.isNotFound = true;
            this.isLoading = false;
            return;
          }

          // เฉพาะของ user นี้
          const byUser = items.filter(i => Number(i.userID) === this.applicantId);
          const pool = byUser.length ? byUser : items;

          const roundParam = Number(this.round) || null;
          const getRound = (x: any) => Number(x?.roundID ?? x?.round ?? 0);

          let exact: CandidateTracking;

          if (roundParam) {
            // ถ้าส่ง round มา เลือกอันที่ round ตรงกันก่อน
            const match = pool.find(x => getRound(x) === roundParam);
            exact = match ?? pool.reduce((best, cur) =>
              this.getLastTs(cur) > this.getLastTs(best) ? cur : best, pool[0]);
          } else {
            // ถ้าไม่ส่งมา เลือกรอบที่มากสุด (เท่ากันตัดสินด้วย timestamp)
            exact = pool.reduce((best, cur) => {
              const br = getRound(best);
              const cr = getRound(cur);
              if (cr !== br) return cr > br ? cur : best;
              return this.getLastTs(cur) > this.getLastTs(best) ? cur : best;
            }, pool[0]);
            // อัปเดต this.round ให้เป็นรอบที่เลือกมา เพื่อให้หน้าอื่นใช้ต่อได้
            this.round = getRound(exact) || 1;
          }

          const latestRound = pool.reduce((mx, cur) => Math.max(mx, getRound(cur)), 0);
          const selectedRound = getRound(exact) || 1;
          this.isLatestRound = selectedRound === latestRound;
          if (!this.isLatestRound) {
            this.allowEditButton = false;
            this.editReview = false;
          }

          this.mapTrackingToView(exact);
          this.isLoading = false;
          this.setInitialEditState();

          this.fetchFiles(Number(this.applicantId || 0));

          this.fetchPreviewFormRound({ roundID: getRound(exact), userID: this.applicantId });
          const appointmentIdKey = `interview${this.stageId}AppointmentId`;
          (this as any)[appointmentIdKey] = (exact as any)?.[appointmentIdKey];
        },
        error: (err) => {
          console.error('[ApplicationForm] getTrackingApplications error:', err);
          this.isNotFound = true;
          this.isLoading = false;
        },
      });
  }

  disableWhenNotLatest(): string {
    return this.isLatestRound ? '' : 'tw-pointer-events-none tw-bg-gray-100 tw-text-[#8b8b8b]';
  }

  HideWhenNotLatest(): string {
    return this.isLatestRound ? '' : 'tw-hidden';
  }

  private getLastTs(i: CandidateTracking): number {
    const candidates = [
      i?.interview2?.date,
      i?.interview1?.date,
      (i as any)?.updatedAt,
      i?.submitDate,
    ]
      .map(d => (d ? Date.parse(String(d)) : 0))
      .filter(n => Number.isFinite(n) && n > 0);

    return candidates.length ? Math.max(...candidates) : 0;
  }

  fetchInterviewer() {
    this.interviewFormService.getApplicantReview(
      Number(this.applicantId),
      Number(this.stageId) + 1
    ).subscribe({
      next: (res) => {
        // 0) เตรียม reviewHistory + slick
        this.reviewHistory = res.map((item: any) => ({
          ...item,
          expandState: { strength: false, concern: false },
          overflowState: { strength: false, concern: false }
        }));

        const countIsSummaryFalse = this.reviewHistory.filter(item => item.isSummary === false).length;

        setTimeout(() => {
          this.slideConfig = {
            ...this.slideConfig,
            dots: countIsSummaryFalse > 2,
            slidesToShow: countIsSummaryFalse === 1 ? 1 : 2,
            responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: countIsSummaryFalse > 1 } }]
          };
          setTimeout(() => {
            this.carousels?.forEach((carousel) => {
              try { carousel.unslick(); } catch { }
              carousel.initSlick();
            });
          }, 0);
        }, 0);

        setTimeout(() => this.checkAllOverflow(), 0);

        // 1) เลือก record ที่ใช้ (ของหน้านี้ใช้ summary=true)
        this.foundisSummary = this.reviewHistory.find(user => user.isSummary === true) ?? null;

        // 2) ตั้งสถานะเริ่มต้น + ฟอร์ม
        this.setInitialEditState();
        this.initializeForm();

        // 3) Restore เหตุผลจาก server (หน้านี้ไม่มี cache priority)
        // this.reasonsInterview1.forEach((category: any) => {
        //   (category.rejectionReasons || []).forEach((reason: any) => {
        //     const fromServer = this.foundisSummary?.selectedReasonIds?.includes(reason.reasonId);
        //     reason.checked = !!fromServer;
        //   });
        // });

        // 4) ตั้ง category จาก server และคำนวณ group ที่ต้อง active
        this.selectedCategoryId = this.foundisSummary?.categoryId ?? null;
        this.selectedGroupKey = this.resolveGroupByCategoryId(this.selectedCategoryId);
      },
      error: (error) => {
        console.error('Error fetching applicant review:', error);
      }
    });

    this.interviewFormService.getApplicantTracking(this.applicantId).subscribe({
      next: (res) => {
        const appointmentIdKey = `interview${this.stageId}AppointmentId`;
        const appointmentIdValue = res[appointmentIdKey];

        (this as any)[appointmentIdKey] = appointmentIdValue;

        this.appointmentId = appointmentIdValue

        this.resultId1 = res.interview1Result;
        this.resultId2 = res.interview2Result;
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  fetchRecruitmentStagesWithReasons(interview: number) {
    this.reasonService.getRecruitmentStagesWithReasons(interview).subscribe({
      next: (response) => {
        this.reasonsInterview1 = response.map((category: any) => ({
          ...category,
          rejectionReasons: (category.rejectionReasons || []).map((r: any) => ({ ...r, checked: false }))
        }));

        // ✅ build groups ให้มี items เพื่อใช้ resolveGroupByCategoryId
        this.resultGroups = ([
          { key: 'accept', label: 'Accept', regex: /(accept|on\s*hold|pass)/i, items: [] },
          { key: 'decline', label: 'Decline', regex: /(decline|no[\s-]?show)/i, items: [] },
        ].map(g => ({
          ...g,
          items: this.reasonsInterview1.filter((c: any) =>
            g.regex.test((c.categoryName || '').toLowerCase())
          )
        })) as ResultGroup[]);
      },
      error: (error) => {
        console.error('Error fetching Recruitment Stages with reasons:', error);
      },
    });
  }

  private applySelectedReasons(selectedReasonIds: any[] | undefined) {
    const ids = (selectedReasonIds ?? []).map((x: any) => Number(x));
    this.reasonsInterview1 = (this.reasonsInterview1 || []).map((cat: any) => ({
      ...cat,
      rejectionReasons: (cat.rejectionReasons || []).map((r: any) => ({
        ...r,
        checked: ids.includes(Number(r.reasonId)),
      })),
    }));
  }


  // ===================== Mapping =====================
  private mapTrackingToView(ct: CandidateTracking) {
    // ----- Applicant header -----
    this.applicant = {
      id: String(ct.userID ?? ''),
      name: ct.fullName || ct.fullNameTH || '—',
      gpa: Number(ct.gpa ?? 0),
      age: Number(ct.age ?? 0),
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
      graduation_year: ct.graduation_year,
      interview1DateFormat: dayjs(ct.interview1.date).format('DD MMMM YYYY'),
      interview1Date: ct.interview1.date,
      interview1Status: ct.interview1.status,
      interview1Result: ct.interview1.id,
      interview2DateFormat: dayjs(ct.interview2.date).format('DD MMMM YYYY'),
      interview2Date: ct.interview2.date,
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

  private buildGroups(categories: any[]): ResultGroup[] {
    const groups: ResultGroup[] = [
      { key: 'accept', label: 'Accept', regex: /(accept|on\s*hold|pass)/i, items: [] },
      { key: 'decline', label: 'Decline', regex: /(decline|no[\s-]?show)/i, items: [] },
    ];
    return groups.map(g => ({
      ...g,
      items: (categories || []).filter((c: any) =>
        g.regex.test(String(c?.categoryName || '').toLowerCase())
      )
    }));
  }

  private normalizeIds<T extends { reasonId?: any }>(cats: any[]): any[] {
    return (cats || []).map((c: any) => ({
      ...c,
      rejectionReasons: (c.rejectionReasons || []).map((r: any) => ({
        ...r,
        reasonId: Number(r.reasonId),
        checked: !!r.checked
      }))
    }));
  }

  private applySelectedReasonsToCategories(cats: any[], selectedIds: number[]): any[] {
    const set = new Set((selectedIds || []).map(Number));
    return (cats || []).map((c: any) => ({
      ...c,
      rejectionReasons: (c.rejectionReasons || []).map((r: any) => ({
        ...r,
        checked: set.has(Number(r.reasonId)),
      }))
    }));
  }

  private resolveGroupByCategoryId(catId: number | null): ResultGroupKey | null {
    if (!catId) return null;
    const id = Number(catId);
    const inAccept = (this.resultGroups.find(g => g.key === 'accept')?.items || []).some((c: any) => Number(c.categoryId) === id);
    const inDecline = (this.resultGroups.find(g => g.key === 'decline')?.items || []).some((c: any) => Number(c.categoryId) === id);
    return inAccept ? 'accept' : (inDecline ? 'decline' : null);
  }

  // โหลด reasons + review แล้ว apply ทีเดียว
  private loadReasonsAndReview(stageId: number, applicantId: number): void {
    const interviewStage = stageId + 1;

    const reasons$ = this.reasonService.getRecruitmentStagesWithReasons(interviewStage)
      .pipe(
        map((res: any[]) => this.normalizeIds(
          (res || []).map((c: any) => ({
            ...c,
            rejectionReasons: (c.rejectionReasons || []).map((r: any) => ({ ...r, checked: false }))
          }))
        ))
      );

    const review$ = this.interviewFormService.getApplicantReview(Number(applicantId), Number(interviewStage))
      .pipe(
        map((res: any[]) => (res || []).map((item: any) => ({
          ...item,
          expandState: { strength: false, concern: false },
          overflowState: { strength: false, concern: false }
        })))
      );

    // รวมสองสตรีม
    combineLatest([reasons$, review$]).pipe(takeUntil(this.destroy$)).subscribe({
      next: ([reasonsCats, reviews]) => {
        // --- 1) เซ็ตรีวิว/คารูเซลตามเดิม ---
        this.reviewHistory = reviews;
        const countIsSummaryFalse = this.reviewHistory.filter(x => x.isSummary === false).length;
        setTimeout(() => {
          this.slideConfig = {
            ...this.slideConfig,
            dots: countIsSummaryFalse > 2,
            slidesToShow: countIsSummaryFalse === 1 ? 1 : 2,
            responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: countIsSummaryFalse > 1 } }]
          };
          setTimeout(() => {
            this.carousels?.forEach((carousel) => { try { carousel.unslick(); } catch { } carousel.initSlick(); });
          }, 0);
        }, 0);
        setTimeout(() => this.checkAllOverflow(), 0);

        // --- 2) สรุปรีวิวตัวที่เป็น summary ---
        this.foundisSummary = this.reviewHistory.find(u => u.isSummary === true) ?? null;

        // --- 3) เซ็ต reasons + groups จาก reasonsCats ---
        this.reasonsInterview1 = reasonsCats;
        this.resultGroups = this.buildGroups(this.reasonsInterview1);

        // --- 4) apply "ติ๊กเหตุผล" จากข้อมูล summary (ถ้ามี) ---
        const selectedIds = (this.foundisSummary?.selectedReasonIds || []).map((x: any) => Number(x));
        this.reasonsInterview1 = this.applySelectedReasonsToCategories(this.reasonsInterview1, selectedIds);

        // --- 5) เซ็ต category + group ตาม summary (ถ้ามี) ---
        this.selectedCategoryId = this.foundisSummary?.categoryId ?? null;
        this.selectedGroupKey = this.resolveGroupByCategoryId(this.selectedCategoryId);

        // --- 6) ฟอร์ม + ปุ่ม ---
        this.setInitialEditState();
        this.initializeForm();
      },
      error: (e: any) => console.error('[loadReasonsAndReview] error:', e)
    });

    this.interviewFormService.getApplicantTracking(this.applicantId).subscribe({
      next: (res) => {
        const appointmentIdKey = `interview${this.stageId}AppointmentId`;
        const appointmentIdValue = res[appointmentIdKey];

        (this as any)[appointmentIdKey] = appointmentIdValue;

        this.appointmentId = appointmentIdValue

        this.resultId1 = res.interview1Result;
        this.resultId2 = res.interview2Result;
      },
      error: (err) => {
        console.error(err);
      },
    });
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

  likeState = {
    count: 0,
    liked: false,
    loading: false
  };

  private fetchInterest(id: number) {
    if (!id) return;
    this.applicationService.getInterestByCandidateId(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.likeState.count = Number(res?.countLike ?? 0);
          this.likeState.liked = !!res?.isLikedByCurrentEmployee;
        },
        error: (e) => {
          console.error('[ApplicationForm] fetchInterest error:', e);
          // fallback เงียบ ๆ: ไม่เปลี่ยน state
        }
      });
  }

  onToggleLike() {
    if (!this.applicantId || this.likeState.loading) return;

    const wantLike = !this.likeState.liked;
    const body = { candidateId: this.applicantId };

    // optimistic update
    const prev = { ...this.likeState };
    this.likeState.loading = true;
    this.likeState.liked = wantLike;
    this.likeState.count = Math.max(0, this.likeState.count + (wantLike ? 1 : -1));

    const req$ = wantLike
      ? this.applicationService.addInterest(body)
      : this.applicationService.deleteInterest(body);

    req$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // สำเร็จ — อาจ refresh จาก server อีกครั้งเพื่อความชัวร์:
          this.fetchInterest(this.applicantId);
          this.likeState.loading = false;
        },
        error: (e) => {
          console.error('[ApplicationForm] toggle like error:', e);
          // rollback
          this.likeState = prev;
        }
      });
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

  formatDateDDMMYYYY(dateString: string | null | undefined): string {
    if (!dateString || dateString === 'Invalid Date') return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  toggleReasonCheck(reason: any) {
    if (this.editReview) {
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

    const categoryId = this.selectedCategoryId ?? null;

    const checkedCategoryIds = this.reasonsInterview1
      .filter(category => category.rejectionReasons.some((reason: { checked: boolean; }) => reason.checked === true))
      .map(category => category.categoryId);

    const appointmentIdKey = `interview${this.stageId}AppointmentId`;
    const appointmentId = (this as any)[appointmentIdKey];

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
        message: 'Are you sure you want to save this data?',
        confirm: true
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (confirmed) {
        if (this.foundisSummary) {
          const payloadHistory = {
            // categoryId: checkedCategoryIds[0],
            categoryId,
            stageDate: isoDate,
            notes: payload.noteInterviewReview,
            selectedReasonIds: checkedReasonIds
          }

          this.interviewFormService.updateCandidateStageHistory(this.foundisSummary.historyId, payloadHistory).subscribe({
            next: () => {
              this.fetchInterviewer()
              this.foundisSummary = this.reviewHistory.find(user => user.isSummary === true);
              this.editReview = false;
              this.allowEditButton = true;
            },
            error: (err) => {
              console.error('Error Rescheduled:', err);
            }
          });

        } else {
          const transformedPayload = {
            applicationId: this.applicantId,
            stageId: this.stageId + 1,
            roundID: this.round,
            // categoryId: checkedCategoryIds[0],
            categoryId,
            isSummary: true,
            stageDate: isoDate,
            appointmentId: String(this.appointmentId).trim(),
            satisfaction: 0,
            notes: payload.noteInterviewReview,
            strength: "",
            concern: "",
            selectedReasonIds: checkedReasonIds
          }

          this.interviewFormService.postInterviewReview(transformedPayload).subscribe({
            next: () => {
              this.fetchCandidateTracking();
              this.fetchInterviewer();
              this.foundisSummary = this.reviewHistory.find(user => user.isSummary === true);
              this.editReview = false;
              this.allowEditButton = true;
            },
            error: (err) => {
              console.error('Error Rescheduled:', err);
            }
          });
        }
      }
    });
  }

  onCancelReview() {
    const payload = this.formDetails.value;

    const isoDate = new Date(payload.dateInterviewReview).toISOString();
    let checkedReasonIds = [];
    checkedReasonIds = this.reasonsInterview1.flatMap((category: { rejectionReasons: any[]; }) =>
      category.rejectionReasons
        .filter(reason => reason.checked === true)
        .map(reason => reason.reasonId)
    );

    const checkedCategoryIds = this.reasonsInterview1
      .filter(category => category.rejectionReasons.some((reason: { checked: boolean; }) => reason.checked === true))
      .map(category => category.categoryId);

    const transformedPayload = {
      categoryId: this.selectedCategoryId ?? null,
      stageDate: isoDate,
      notes: payload.noteInterviewReview,
      selectedReasonIds: checkedReasonIds
    }

    if (JSON.stringify(this.snapshotInputForm) !== JSON.stringify(transformedPayload)) {
      this.fetchInterviewer()
      this.foundisSummary = this.reviewHistory.find(user => user.isSummary === true);
      this.editReview = false;
      this.allowEditButton = true;
    }

    // this.initializeForm()
    // this.selectedCategoryId = null;
    // this.formDetails = this.fb.group({
    //   userInterviewReview: [this.foundisSummary?.hrUserName || this.usernameLogin],
    //   dateInterviewReview: [this.formatDateForInput(this.foundisSummary?.stageDate) || this.nowDate],
    //   noteInterviewReview: [this.foundisSummary?.notes || '']
    // });
    const countIsSummaryTrue = this.reviewHistory.filter(item => item.isSummary === true).length;
    if (!countIsSummaryTrue) {
      this.editReview = true;
      this.allowEditButton = false;
    } else {
      this.editReview = false;
      this.allowEditButton = true;
    }
  }

  onEditReview() {
    this.initializeForm()
    this.editReview = true;
    this.allowEditButton = false;

    const payload = this.formDetails.value;

    const isoDate = new Date(payload.dateInterviewReview).toISOString();
    let checkedReasonIds = [];
    checkedReasonIds = this.reasonsInterview1.flatMap((category: { rejectionReasons: any[]; }) =>
      category.rejectionReasons
        .filter(reason => reason.checked === true)
        .map(reason => reason.reasonId)
    );

    const checkedCategoryIds = this.reasonsInterview1
      .filter(category => category.rejectionReasons.some((reason: { checked: boolean; }) => reason.checked === true))
      .map(category => category.categoryId);

    const transformedPayload = {
      categoryId: this.selectedCategoryId ?? null,
      stageDate: isoDate,
      notes: payload.noteInterviewReview,
      selectedReasonIds: checkedReasonIds
    }

    this.snapshotInputForm = transformedPayload;
  }

  setInitialEditState() {
    const resultKey = `interview${this.stageId}Result` as keyof typeof this.applicant;
    const result = this.applicant?.[resultKey];

    if (result) {
      if (this.foundisSummary) {
        this.allowEditButton = true;
        this.editReview = false;
      } else {
        this.allowEditButton = false;
        this.editReview = true;
      }
    } else {
      this.allowEditButton = false;
      this.editReview = true;
    }
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

  hasSummary(): number {
    const countIsSummaryTrue = this.reviewHistory.filter(item => item.isSummary === false).length;
    return countIsSummaryTrue;
  }

  onInterviewClick(tab: string) {
    this.reviewHistory = [];
    this.selectedTab = tab;
    const interviewNumber = tab === 'tab1' ? 1 : 2;
    this.stageId = interviewNumber;

    this.setInitialEditState();

    // โหลด reasons + review สำหรับ stage ใหม่
    this.loadReasonsAndReview(this.stageId, this.applicantId);

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
      appointmentId: String(this.appointmentId).trim(),
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
      appointmentId: String(this.appointmentId).trim(),
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
      case 21: return 'btn-pass tw-bg-[#005500] tw-text-white';           // Pass Interview (สีเขียว)
      case 22: return 'btn-notpass tw-bg-red-500 tw-text-white';             // Not Pass Interview (สีแดง)
      case 23: return 'tw-bg-[#7f56d9] tw-text-white';            // No Show
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
      case 21: return 'btn-pass tw-bg-[#005500] tw-text-white';           // Pass Interview (สีเขียว)
      case 22: return 'btn-notpass tw-bg-red-500 tw-text-white';             // Not Pass Interview (สีแดง)
      case 23: return 'tw-bg-[#7f56d9] tw-text-white';            // No Show
      case 24: return 'tw-bg-purple-400 tw-text-white';          // Reschedule
      case 25: return 'tw-bg-pink-400 tw-text-white';            // Candidate Decline
      case 41: return 'tw-bg-green-700 tw-text-white';           // Hire
      case 42: return 'tw-bg-red-700 tw-text-white';             // Not Hire
      case 43: return 'tw-bg-orange-400 tw-text-white';          // Comparison
      default: return 'tw-bg-gray-300 tw-text-black';            // Default สีเทา
    }
  }

  disableInputPass(): string {
    const resultKey = `interview${this.stageId}Result` as keyof typeof this.applicant;

    const result = this.applicant?.[resultKey];

    switch (result) {
      case 21:
        return 'tw-pointer-events-none tw-bg-gray-100 tw-text-[#8b8b8b]'; // Pass Interview
      case 22:
        return 'tw-pointer-events-none tw-bg-gray-100 tw-text-[#8b8b8b]'; // Fail Interview
      case 23:
        return 'tw-pointer-events-none tw-bg-gray-100 tw-text-[#8b8b8b]'; // No show Interview
      case 25:
        return 'tw-pointer-events-none tw-bg-gray-100 tw-text-[#8b8b8b]'; // Applicant Decline Interview
      default:
        return ''; // Default
    }
  }

  hideBtnPass() {
    const resultKey = `interview${this.stageId}Result` as keyof typeof this.applicant;
    const result = this.applicant?.[resultKey];

    this.editReview = result !== 21;
    this.editReview = result !== 22;
  }

  toneFor(nameRaw: string): string {
    const s = (nameRaw ?? '').toLowerCase().trim();

    if (/(accept|accepted|pass|offer|onboarded)/.test(s)) {
      return 'tw-bg-green-500 tw-text-white';
    }
    if (/(decline|rejected|not\s?pass|offer_decline)/.test(s)) {
      return 'tw-bg-red-500 tw-text-white';
    }
    if (/(no[-\s]?show|noshow)/.test(s)) {
      return 'tw-bg-[#7f56d9] tw-text-white';
    }
    if (/(on[-\s]?hold|hold)/.test(s)) {
      return 'tw-bg-amber-500 tw-text-white';
    }
    return 'tw-bg-white tw-text-gray-700';
  }

  getCategoryBtnClass(c: CategoryOption, selectedId?: number | null) {
    const isActive = c.categoryId === selectedId;
    const name = (c.categoryName || '');

    const base =
      'tw-text-sm tw-rounded-lg tw-px-3 tw-py-1.5 tw-border tw-transition';
    const activeTone = this.toneFor(name);
    const inactive =
      'tw-bg-white tw-text-gray-700 tw-border-gray-300 hover:tw-bg-gray-50';

    const ring = isActive ? ' tw-ring-2 tw-ring-white/40' : '';

    return [
      base,
      isActive ? activeTone : inactive,
      ring,
    ].join(' ');
  }

  // label บนปุ่ม group: เช่น "Accept (Accept / On Hold)"
  groupDisplayLabel(g: ResultGroup) {
    const subs = g.items.map(i => i.categoryName).join(' / ');
    return subs ? `${g.label}` : g.label;
  }

  // เรียกตอนกดปุ่ม group
  selectGroup(key: ResultGroupKey) {
    this.selectedGroupKey = (this.selectedGroupKey === key) ? null : key;

    // เคลียร์หมวดย่อยที่เคยเลือก
    this.selectedCategoryId = null;

    // เคลียร์ reason ที่เคยติ๊ก
    this.reasonsInterview1 = this.reasonsInterview1.map((cat: any) => ({
      ...cat,
      rejectionReasons: (cat.rejectionReasons || []).map((r: any) => ({ ...r, checked: false }))
    }));
  }


  // คืนรายการ category ภายใต้ group ที่เลือก (ไว้ใช้ใน html)
  getCurrentGroupItems() {
    if (!this.selectedGroupKey) return this.reasonsInterview1;
    return (this.resultGroups.find(g => g.key === this.selectedGroupKey)?.items) ?? [];
  }

  // ปุ่ม group style
  getGroupBtnClass(g: ResultGroup) {
    const isActive = this.selectedGroupKey === g.key;
    const base = 'tw-text-sm tw-rounded-lg tw-px-3 tw-py-1.5 tw-border tw-font-medium tw-transition';

    const tones = {
      accept: isActive
        ? 'tw-bg-green-500 tw-text-white'
        : '',
      decline: isActive
        ? 'tw-bg-red-500 tw-text-white'
        : '',
    };

    const tone = tones[g.key] || 'tw-text-gray-700 tw-border-gray-300';
    return `${base} ${tone}`;
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

  onInterview2Click() {
    const queryParams = {
      id: this.applicantId
    }
    this.router.navigate(['/interview-scheduling/interview-round-2'], { queryParams });
  }

  onInterviewDetailClick() {
    const queryParams = {
      id: this.applicantId,
      interview: this.stageId,
    }
    this.router.navigate(['/interview-scheduling/interview-form/details'], { queryParams });
  }

  onOfferEmploymentClick() {
    const queryParams = {
      id: this.applicantId,
    }
    this.router.navigate(['/offer-employment'], { queryParams });
  }

  ShowWhenOffer() {
    if (this.resultId1 === 21 && this.resultId2 === 21) return;
    return 'tw-hidden';
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
      panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
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




  // โหลดคอมเมนต์ทั้งหมดของผู้สมัคร
  loadComments(applicantId: number) {
    if (!applicantId) return;
    this.commentsLoading = true;
    this.applicationService.getCommentsById(applicantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const items: ApiComment[] = Array.isArray(res?.items) ? res.items : [];
          this.commentsTree = items.map(c => this.toViewComment(c));
          this.commentsLoading = false;
        },
        error: (e) => {
          console.error('[ApplicationForm] loadComments error:', e);
          this.commentsLoading = false;
        }
      });
  }

  // map API -> view + เตรียม state UI
  private toViewComment(c: ApiComment): ViewComment {
    return {
      id: c.id,
      parentId: c.parentCommentId,
      author: c.commentByUserName || '—',
      text: c.commentText || '',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      commentType: (c.commentType || '').trim(),
      isEdited: !!c.isEdited,
      canDelete: !!c.canDelete,
      replies: (c.replies || []).map(rc => this.toViewComment(rc)),
      ui: {
        isReplying: false,
        replyText: '',
        isEditing: false,
        editText: c.commentText || '',
      }
    };
  }

  // helper: ตัดสินใจชนิดคอมเมนต์
  private resolveCommentType(parent?: ViewComment): string {
    // ถ้าเป็นรีพลาย ให้ใช้ชนิดเดียวกับคอมเมนต์แม่
    if (parent?.commentType) return parent.commentType;

    // ถ้าเป็นคอมเมนต์หลัก คุณเลือกได้: จาก UI / จาก step ปัจจุบัน / หรือ default
    // ตัวอย่าง default:
    return 'application';
  }

  // เพิ่มคอมเมนต์ใหม่ (root)
  onSubmitNewComment() {
    const text = (this.commentCtrl.value || '').trim();
    if (!text || !this.applicantId) return;

    this.applicationService
      .getCurrentStageByCandidateId(this.applicantId)
      .pipe(
        takeUntil(this.destroy$),
        // ดึง typeName จาก response; ถ้าไม่มีให้ fallback เป็น 'Application'
        map((res: any) => (res?.data?.typeName ? String(res.data.typeName).trim() : 'Application')),
        catchError((e) => {
          console.error('[ApplicationForm] current stage error:', e);
          return of('Application');
        }),
        // เอา typeName ที่ได้ไปโพสต์คอมเมนต์
        switchMap((typeName: string) => {
          const body = {
            candidateId: this.applicantId,
            commentText: text,
            commentType: typeName,        // <<<< ใช้ typeName จาก API
            parentCommentId: null
          };
          return this.applicationService.addCommentByCandidateId(body);
        })
      )
      .subscribe({
        next: () => {
          this.commentCtrl.setValue('');
          this.loadComments(this.applicantId);
        },
        error: (e) => console.error('[ApplicationForm] add comment error:', e),
      });
  }

  // toggle reply box (เฉพาะ depth=0 ที่ template เปิดปุ่มให้)
  toggleReply(c: ViewComment) {
    c.ui.isReplying = !c.ui.isReplying;
    if (c.ui.isReplying) c.ui.replyText = '';
  }

  // ส่งรีพลาย (ผูก parentCommentId เป็น id ของคอมเมนต์หลัก)
  onSubmitReply(parent: ViewComment) {
    const text = (parent.ui.replyText || '').trim();
    if (!text || !this.applicantId) return;

    const body = {
      candidateId: this.applicantId,
      commentText: text,
      commentType: this.resolveCommentType(parent),
      parentCommentId: parent.id
    };

    this.applicationService.addCommentByCandidateId(body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          parent.ui.isReplying = false;
          parent.ui.replyText = '';
          this.loadComments(this.applicantId);
        },
        error: (e) => console.error('[ApplicationForm] reply error:', e)
      });
  }

  // เริ่มแก้ไข
  startEdit(c: ViewComment) {
    if (!c.isEdited) return;
    c.ui.isEditing = true;
    c.ui.editText = c.text;
  }

  // บันทึกแก้ไข
  onSaveEdit(c: ViewComment) {
    const text = (c.ui.editText || '').trim();
    if (!text) return;
    this.applicationService.editCommentById(c.id, { commentText: text })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          c.ui.isEditing = false;
          this.loadComments(this.applicantId);
        },
        error: (e) => console.error('[ApplicationForm] edit comment error:', e)
      });
  }

  // helper เปิด dialog
  private openAlert(data: AlertDialogData) {
    return this.dialog
      .open(AlertDialogComponent, {
        data,
        width: '480px',
        disableClose: true, // บังคับให้กดปุ่ม Cancel/Confirm เท่านั้น
        panelClass: ['pp-rounded-dialog'], // ใส่คลาสเพิ่มได้ตามต้องการ
      })
      .afterClosed();
  }

  // ลบคอมเมนต์
  onDeleteComment(c: ViewComment) {
    if (!c.canDelete) return;

    this.openAlert({
      title: 'Delete this comment?',
      message: 'Do you want to delete this comment?',
      confirm: true, // แสดงปุ่ม Cancel/Confirm
    }).subscribe((res) => {
      // AlertDialogComponent จะส่ง false เมื่อกด Cancel
      // และส่งค่าที่เป็น truthy เมื่อกด Confirm (อาจเป็น true หรือ object ก็ได้)
      if (!res) return;

      this.applicationService.deleteCommentById(c.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => this.loadComments(this.applicantId),
          error: (e) => console.error('[ApplicationForm] delete comment error:', e)
        });
    });
  }

  // trackBy
  trackByCommentId = (_: number, c: ViewComment) => c.id;

  // ปรับให้ปุ่มการ์ด "Comment" ทางขวาเลื่อนมาที่ section นี้
  onCommentClick() {
    const el = document.getElementById('comments-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // รวมจำนวนคอมเมนต์ทั้งหมด (รวมรีพลาย)
  get totalComments(): number {
    return this.countAllComments(this.commentsTree);
  }

  private countAllComments(list: ViewComment[] | undefined | null): number {
    if (!Array.isArray(list) || !list.length) return 0;
    let sum = 0;
    for (const c of list) {
      sum += 1;
      if (Array.isArray(c.replies) && c.replies.length) {
        sum += this.countAllComments(c.replies);
      }
    }
    return sum;
  }

  // เทียบ ISO datetime โดยสนใจแค่ถึงระดับวินาที (YYYY-MM-DDTHH:mm:ss)
  private sameIsoSecond(a?: string, b?: string): boolean {
    if (!a || !b) return true; // ถ้าขาดค่าใดค่าหนึ่ง ถือว่า "ไม่แก้ไข"
    const A = String(a).trim().slice(0, 19); // "2025-09-29T10:52:52"
    const B = String(b).trim().slice(0, 19);
    return A === B;
  }

  isEditedAtSecond(createdAt?: string, updatedAt?: string): boolean {
    if (!updatedAt) return false;
    return !this.sameIsoSecond(createdAt, updatedAt);
  }

  // Form Interview Detail
  result1Type = '';
  result2Type = '';
  currentFormId1?: number;
  currentFormId2?: number;
  canSave = false;
  hideDetail1Section = false;
  hideDetail2Section = false;

  fetchPreviewFormRound(items: any, opts?: { useRound1: boolean; useRound2: boolean }) {
    (this.interviewDetailsFormService.previewFormRound(items.roundID, items.userID) as Observable<any[]>)
      .subscribe((response: any[]) => {
        this.currentFormId1 = Number(response?.[0]?.formId ?? this.currentFormId1 ?? 1);
        this.currentFormId2 = Number(response?.[1]?.formId ?? this.currentFormId2 ?? 2);


        const fields = Array.isArray(response[0]?.fields) ? response[0].fields : [];
        this.detailRows = fields
          .filter((item: any) => this.hasRoundAnswer(item, 1))
          .map((item: any, idx: number) => {
            const type = this.mapFieldType(item.fieldType);
            const optsList = Array.isArray(item.options)
              ? item.options.map((o: any) => ({ label: o.optionIdname, value: String(o.optionId) }))
              : [];

            const ansR1 = (item.answers || []).find((a: any) => Number(a.interviewRound) === 1);

            const r1Sel = Array.isArray(ansR1?.existingOptionIds) ? ansR1.existingOptionIds.map((id: any) => String(id)) : [];

            const r1Id = r1Sel.length === 1 ? r1Sel[0] : null;

            const r1Txt = ansR1?.existingAnswer ?? '';

            const row: WarningRow = {
              no: idx + 1,
              warning: item.questionName ?? '-',
              questionId: Number(item.questionId ?? item.id ?? idx + 1),

              result1Type: type,
              result1Options: optsList,

              ...(type === 'multiselect' ? { result1SelectedIds: r1Sel } : {}),
              ...(type === 'select' ? { result1Id: r1Id } : {}),
              ...(type === 'input' || type === 'textarea' ? { result1: r1Txt } : {}),

              result1Readonly: true,
            };
            return row;
          });

        // ===== Round 1 + Round 2 -> แสดงทุกรายการที่มีคำตอบ "อย่างน้อยหนึ่งรอบ"
        // (ถ้ารอบ 1 ไม่มีคำตอบ ให้ขึ้นแถวและปล่อยคอลัมน์ Interview 1 ว่างไว้ => จะโชว์ "—")
        const fields1 = Array.isArray(response[0]?.fields) ? response[0].fields : [];
        const fields1_2 = Array.isArray(response[0]?.fields) ? response[0].fields : [];
        const byKey = new Map<string | number, { f1?: any; f2?: any }>();

        const keyOf = (f: any, idx: number) =>
          (f?.questionId ?? f?.id ?? f?.questionName ?? `q-${idx}`);

        fields1.forEach((f: any, i: number) => {
          const k = keyOf(f, i);
          const cur = byKey.get(k) ?? {};
          cur.f1 = f;
          byKey.set(k, cur);
        });
        fields1_2.forEach((f: any, i: number) => {
          const k = keyOf(f, i);
          const cur = byKey.get(k) ?? {};
          cur.f2 = f;
          byKey.set(k, cur);
        });

        this.detail1Rows = Array.from(byKey.entries())
          .filter(([_, pair]) => {
            const hasR1 = pair.f1 ? this.hasRoundAnswer(pair.f1, 1) : false;
            const hasR2 = pair.f2 ? this.hasRoundAnswer(pair.f2, 2) : false;
            return hasR1 || hasR2;
          })
          .map(([_, pair], idx) => {
            const baseField = pair.f1 ?? pair.f2 ?? {};
            const type = this.mapFieldType(baseField.fieldType);
            const optsList = Array.isArray(baseField.options)
              ? baseField.options.map((o: any) => ({ label: o.optionIdname, value: String(o.optionId) }))
              : [];
            const ansR1 = pair.f1 ? (pair.f1.answers || []).find((a: any) => Number(a.interviewRound) === 1) : null;
            const ansR2 = pair.f2 ? (pair.f2.answers || []).find((a: any) => Number(a.interviewRound) === 2) : null;

            const r1Sel = Array.isArray(ansR1?.existingOptionIds) ? ansR1.existingOptionIds.map((id: any) => String(id)) : [];
            const r2Sel = Array.isArray(ansR2?.existingOptionIds) ? ansR2.existingOptionIds.map((id: any) => String(id)) : [];

            const r1Id = r1Sel.length === 1 ? r1Sel[0] : null;
            const r2Id = r2Sel.length === 1 ? r2Sel[0] : null;

            const r1Txt = ansR1?.existingAnswer ?? '';
            const r2Txt = ansR2?.existingAnswer ?? '';

            const row: WarningRow = {
              no: idx + 1,
              warning: baseField.questionName ?? '-',
              questionId: Number(baseField.questionId ?? baseField.id ?? idx + 1),

              result1Type: type,
              result2Type: type,
              result1Options: optsList,
              result2Options: optsList,

              ...(type === 'multiselect' ? { result1SelectedIds: r1Sel, result2SelectedIds: r2Sel } : {}),
              ...(type === 'select' ? { result1Id: r1Id, result2Id: r2Id } : {}),
              ...(type === 'input' || type === 'textarea' ? { result1: r1Txt, result2: r2Txt } : {}),

              result1Readonly: true,
              result2Readonly: true,
            };
            return row;
          });

        // ===== Round 2 -> เก็บเฉพาะ field ที่มีคำตอบในรอบ 2 =====
        const fields2 = Array.isArray(response[1]?.fields) ? response[1].fields : [];
        this.detail2Rows = fields2
          .filter((item: any) => this.hasRoundAnswer(item, 2))
          .map((item: any, idx: number) => {
            const type = this.mapFieldType(item.fieldType);
            const optsList = Array.isArray(item.options)
              ? item.options.map((o: any) => ({ label: o.optionIdname, value: String(o.optionId) }))
              : [];

            const ansR2 = (item.answers || []).find((a: any) => Number(a.interviewRound) === 2);

            const r2Sel = Array.isArray(ansR2?.existingOptionIds) ? ansR2.existingOptionIds.map((id: any) => String(id)) : [];
            const r2Id = r2Sel.length === 1 ? r2Sel[0] : null;
            const r2Txt = ansR2?.existingAnswer ?? '';

            const row: WarningRow = {
              no: idx + 1,
              warning: item.questionName ?? '-',
              questionId: Number(item.questionId ?? item.id ?? idx + 1),

              result2Type: type,
              result2Options: optsList,

              ...(type === 'multiselect' ? { result2SelectedIds: r2Sel } : {}),
              ...(type === 'select' ? { result2Id: r2Id } : {}),
              ...(type === 'input' || type === 'textarea' ? { result2: r2Txt } : {}),

              result2Readonly: true,
            };
            return row;
          });

        this.toDisplayOnly();
      });
  }

  private hasRoundAnswer(item: any, round: 1 | 2): boolean {
    const ans = (item.answers || []).find((a: any) => Number(a.interviewRound) === round);
    if (!ans) return false;
    const hasOpts = Array.isArray(ans.existingOptionIds) && ans.existingOptionIds.length > 0;
    const hasText = !!String(ans.existingAnswer ?? '').trim();
    return hasOpts || hasText;
  }

  private getOptionLabel(
    opts: Array<{ label: string, value: string }> | undefined,
    id?: string | null
  ) {
    if (!opts || !id) return '';
    const found = opts.find(o => String(o.value) === String(id));
    return found?.label ?? '';
  }

  private uniqStrings(a: any[]): string[] {
    return Array.from(new Set((a || []).map((x: any) => String(x))));
  }

  private buildDisplayText(row: any, which: 'result1' | 'result2'): string {
    const type = row[`${which}Type`];

    if (type === 'multiselect') {
      const ids: string[] = this.uniqStrings(row[`${which}SelectedIds`] || []);
      const labels = ids
        .map(id => this.getOptionLabel(row[`${which}Options`], id))
        .filter(Boolean)
        .filter((t, i, self) => self.indexOf(t) === i);

      if (!labels.length) return '—';
      return labels
        .map((t, i) => `${i + 1}. ${String(t).trim()}`)
        .join('\n');
      // return labels.map(t => `• ${t}`).join('\n');
    }

    if (type === 'select') {
      return this.getOptionLabel(row[`${which}Options`], row[`${which}Id`]) || '—';
    }

    if (type === 'input' || type === 'textarea' || type === 'text') {
      const v = (row[which] ?? '').toString().trim();
      return v || '—';
    }

    return (row[which] ?? '').toString().trim() || '—';
  }

  private toDisplayOnly(): void {
    this.detailRows = (this.detailRows || []).map(r => ({
      ...r,
      result1View: this.buildDisplayText(r, 'result1'),
    }));
    this.detail1Rows = (this.detail1Rows || []).map(r => ({
      ...r,
      result1View: this.buildDisplayText(r, 'result1'),
      result2View: this.buildDisplayText(r, 'result2'),
    }));
    this.detail2Rows = (this.detail2Rows || []).map(r => ({
      ...r,
      result2View: this.buildDisplayText(r, 'result2'),
    }));

    this.detailColumns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Question', field: 'warning', type: 'text', minWidth: '220px', wrapText: true },
      { header: 'Interview 1', field: 'result1View', type: 'text', minWidth: '160px' },
    ];

    this.detail1Columns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Question', field: 'warning', type: 'text', minWidth: '220px', wrapText: true },
      { header: 'Interview 1', field: 'result1View', type: 'text', minWidth: '160px' },
      { header: 'Interview 2', field: 'result2View', type: 'text', minWidth: '160px' },
    ];

    this.detail2Columns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Question', field: 'warning', type: 'text', minWidth: '220px', wrapText: true },
      { header: 'Interview 2', field: 'result2View', type: 'text', minWidth: '160px' },
    ];
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

  mapFieldType(apiType: string): CellType {
    switch ((apiType || '').toLowerCase()) {
      case 'checkbox': return 'multiselect'; // checkbox หลายตัว => multiselect
      case 'dropdown': return 'select';
      case 'textarea': return 'textarea';
      case 'text': return 'input';
      default: return 'text';
    }
  }

  get canOpenDatePicker(): boolean {
    return !!this.editReview && this.isLatestRound;
  }

  onDateBoxMouseDown(picker: HTMLInputElement) {
    if (!this.canOpenDatePicker) return;
    this.openDatePicker(picker);
  }

  openDatePicker(picker: HTMLInputElement) {
    try {
      // ทำให้ interactive ชั่วคราว (กันบาง browser ไม่ยอมเปิด)
      const prevPE = picker.style.pointerEvents;
      const prevOpacity = picker.style.opacity;
      picker.style.pointerEvents = 'auto';
      picker.style.opacity = '0.001';

      picker.focus(); // สำคัญกับ Safari/Firefox
      if (typeof (picker as any).showPicker === 'function') {
        (picker as any).showPicker();         // Chrome/Edge ใหม่ ๆ
      } else {
        // fallback
        picker.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        picker.click();
      }

      // คืนค่า style ใน next tick
      setTimeout(() => {
        picker.style.pointerEvents = prevPE;
        picker.style.opacity = prevOpacity;
      }, 0);
    } catch {
      // fallback สุดท้าย
      picker.click();
    }
  }

  /** ให้ Angular re-render ช่องแสดงผลหลังเลือกวันที่ */
  onNativeDateChanged() {
    // ไม่ต้อง set ค่าเอง เพราะ formControlName จับให้แล้ว
    // แค่กระตุก change detection ถ้าจำเป็น
    // this.cdr.markForCheck(); // ถ้าใช้ OnPush ค่อยเปิดบรรทัดนี้
  }
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
