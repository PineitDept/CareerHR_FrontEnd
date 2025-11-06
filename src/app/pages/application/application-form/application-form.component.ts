import { ChangeDetectorRef, Component, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, map, of, Subject, switchMap, takeUntil } from 'rxjs';
import { ApplicationService } from '../../../services/application/application.service';
import { CandidatePagedResult } from '../../../interfaces/Application/application.interface';
import {
  CandidateTracking,
  CandidateTrackStatus,
} from '../../../interfaces/Application/tracking.interface';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ReasonService } from '../../../services/admin-setting/reason/reason.service';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogData } from '../../../shared/interfaces/dialog/dialog.interface';
import { AlertDialogComponent } from '../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { SlickCarouselComponent, SlickItemDirective } from 'ngx-slick-carousel';
import { NotificationService } from '../../../shared/services/notification/notification.service';

dayjs.extend(utc);

// ====== Types (View) ======
type StepStatus = 'done' | 'pending';
type Risk = 'Normal' | 'Warning';
type ScreeningStatus = 'Accept' | 'Decline' | 'On Hold' | 'Pending' | null;

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
}

interface AssessmentItem {
  no: number;
  review: string;
  result: string;
  score: number | string;
  visibility: any;
  details: any;
  detailsPositive?: boolean;
  isTotalRow?: boolean;
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
  reasons: string[];
  description: string;
}

interface CommentItem {
  id: string;
  author: string;
  date: string;
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

type Variant = 'green' | 'blue' | 'gray' | 'red' | 'white' | 'purple' | 'yellow';
interface StepperItem {
  label: string;
  sub?: string;
  date?: string;
  variant?: Variant;
}

type CategoryOption = { categoryId: number; categoryName: string };
type ReasonOption   = { reasonId: number; reasonText: string; checked?: boolean };

interface StageSection {
  historyId: number;
  stageId: number;
  stageName: string;
  stageNameNormalized: string;
  headerTitle: string;
  hrUserId: string;
  hrUserName: string;
  stageDate: string | Date;
  categories: CategoryOption[];
  selectedCategoryId?: number;
  reasons: ReasonOption[];
  notes?: string | null;
  strength?: string | null;
  concern?: string | null;
  isSummary?: boolean;
  open: boolean;
  isEditing?: boolean;
  canEdit?: boolean;

  uiReadonly?: {
    topChoice: 'Accept' | 'Decline' | null;
    subChoice: string | null;
    reasons: Array<{ reasonId?: number; reasonText: string; checked: boolean }>;
    groups?: Array<{ id: number; name: string; groupType: string; isSelected: boolean }>;
  };
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
  selector: 'app-application-form',
  templateUrl: './application-form.component.html',
  styleUrl: './application-form.component.scss',
})
export class ApplicationFormComponent {
  // ====== Filter ======
  filterButtons: {
    label: string;
    key: string;
    color?: string;
    textColor?: string;
    borderColor?: string;
    outlineBtn?: boolean;
    options?: Array<{ label: string; value: any }>;
  }[] = [];
  disabledKeys: string[] = [];

  // ====== Routing ======
  applicantId: number = 0;
  roundID: number = 0;

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

  steps: { label: string; date?: string; status: StepStatus; sub?: string }[] = [];
  currentIndex = -1;

  assessments: AssessmentItem[] = [];
  assessmentTotalScore = 0;
  assessmentMaxScore = 0;
  assessmentRecommendation = '';

  warnings: WarningItem[] = [];

  screening: Screening = {
    screenedBy: '—',
    screeningDate: '',
    status: null,
    reasons: [],
    description: '',
  };

  comments: CommentItem[] = [];
  currentUserName = '';
  newCommentText = '';

  transcripts: Attachment[] = [];
  certifications: Attachment[] = [];
  historyLogs: HistoryLog[] = [];

  applicationFormSubmittedDate: string | Date = '';

  // ====== Stepper bindings ======
  stepperItems: StepperItem[] = [];
  activeStepIndex = 0;
  disabledStepLabels: string[] = [];

  // Loading/State
  isLoading = false;
  isNotFound = false;

  // ====== Assessment UI/Form ======
  formDetails!: FormGroup;
  isRevOpen = true;
  assessmentRows: any[] = [];
  assessmentColumns: any[] = [];

  // ====== Candidate Warning UI ======
  isWarnOpen = true;
  warningRows: any[] = [];
  warningColumns: any[] = [];

  private destroy$ = new Subject<void>();

  stageSections: StageSection[] = [];
  interviewCount = 0;
  screeningCount = 0;

  // ===== Comments state =====
  commentsLoading = false;
  commentsTree: ViewComment[] = [];
  commentCtrl!: FormControl<string>;

  screeningCardBg: string = '#6C757D';
  private hasScreenedPending = false;

  // ===== Non-summary reviews for Interview 1 & 2 =====
  interview1NonSummary: any[] = [];
  interview2NonSummary: any[] = [];
  screeningNonSummary: any[] = [];

  // ===== สำหรับ Screened Pending =====
  allowEditButton = true;
  editReview = false;
  sessionUserName = '';
  sessionUserId = '';
  today = dayjs().format('YYYY-MM-DD');
  private originalSnapshot: { categoryId?: number; reasons?: ReasonOption[]; notes?: string; date?: string } | null = null;

  // เก็บ reasons ทั้งชุดของแต่ละ stageId
  private reasonsByStage = new Map<number, any[]>();

  // slick
  slideConfigI1: any = {
    slidesToShow: 2, slidesToScroll: 1, dots: false, arrows: false, infinite: false,
    responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: false } }]
  };
  slideConfigI2: any = {
    slidesToShow: 2, slidesToScroll: 1, dots: false, arrows: false, infinite: false,
    responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: false } }]
  };
  slideConfigScreened: any = {
    slidesToShow: 2, slidesToScroll: 1, dots: false, arrows: false, infinite: false,
    responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: false } }]
  };

  @ViewChildren('i1StrengthText') i1StrengthTexts!: QueryList<ElementRef>;
  @ViewChildren('i1ConcernText')  i1ConcernTexts!: QueryList<ElementRef>;
  @ViewChildren('i2StrengthText') i2StrengthTexts!: QueryList<ElementRef>;
  @ViewChildren('i2ConcernText')  i2ConcernTexts!: QueryList<ElementRef>;
  @ViewChildren(SlickItemDirective) slickItems!: QueryList<SlickItemDirective>;
  @ViewChildren('i1Carousel') i1Carousels!: QueryList<SlickCarouselComponent>;
  @ViewChildren('i2Carousel') i2Carousels!: QueryList<SlickCarouselComponent>;
  @ViewChildren('screeningCarousel') screeningCarousels!: QueryList<SlickCarouselComponent>;

  currentSlide: number[] = [];
  totalSlides: number[] = [];
  canGoPrev: boolean[] = [];
  canGoNext: boolean[] = [];

  trackByFileName = (_: number, f: Attachment) => f?.name || f?.file;
  trackByHistory  = (_: number, h: HistoryLog) => `${h.date}-${h.action}`;

  likeState = {
    count: 0,
    liked: false,
    loading: false
  };

  currentCandidateTracking: CandidateTracking | null = null;

  constructor(
    private route: ActivatedRoute,
    private applicationService: ApplicationService,
    private fb: FormBuilder,
    private reasonService: ReasonService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private notify: NotificationService,
    private router: Router,
  ) {}

  // ===================== Lifecycle =====================
  ngOnInit() {
    // อ่าน user จาก session และเตรียมฟอร์ม
    this.readSessionUser();
    this.formDetails = this.fb.group({
      dateInterviewReview: this.fb.control<string>(this.today),
      noteInterviewReview: this.fb.control<string>({ value: '', disabled: true }),
    });

    this.commentCtrl = this.fb.control<string>('', { nonNullable: true });
    this.filterButtons = [{ label: 'Print', key: 'print', color: '#0055FF' }];

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applicantId = Number(params['id'] || 0);
        this.roundID = Number(params['round'] || 0);
        this.fetchCandidateTracking();
      });

    this.initAssessmentColumns();
    this.initWarningColumns();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===================== Data Fetch =====================
  private fetchCandidateTracking() {
    if (!this.applicantId) {
      this.isNotFound = true;
      return;
    }

    this.isLoading = true;

    this.applicationService
      .getTrackingApplications({
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

          const byUser = items.filter(i => Number(i.userID) === this.applicantId);
          let exact = byUser.find(i => Number(i.roundID) === Number(this.roundID));

          if (!exact) {
            exact = byUser.sort((a, b) => Number(b.roundID) - Number(a.roundID))[0] || items[0];
            if (!this.roundID && exact?.roundID != null) {
              this.roundID = Number(exact.roundID);
            }
          }

          if (exact?.roundID != null) {
            this.roundID = Number(exact.roundID);
          }

          const sourceForRounds = byUser.length ? byUser : items;
          const rounds = Array.from(
            new Set(
              sourceForRounds
                .map(i => Number((i as any)?.roundID))
                .filter(n => Number.isFinite(n) && n > 0)
            )
          ).sort((a, b) => a - b);

          const roundButton = (rounds.length > 1)
            ? [{
                key: 'round',
                label: `Round ${this.roundID || 1}`,
                color: '#FFFFFF',
                textColor: '#000000',
                borderColor: '#000000',
                options: rounds.map(r => ({ label: `Round ${r}`, value: r }))
              }]
            : [];

          this.filterButtons = [
            ...roundButton,
            { label: 'Print', key: 'print', color: '#0055FF' }
          ];

          this.mapTrackingToView(exact as any);
          this.isLoading = false;
        },
        error: (err) => {
          console.error('[ApplicationForm] getTrackingApplications error:', err);
          this.isNotFound = true;
          this.isLoading = false;
        },
      });
  }

  // ===================== Mapping =====================
  private mapTrackingToView(ct: CandidateTracking) {
    this.currentCandidateTracking = ct;

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
            .map(p => {
              const name = (p?.namePosition ?? '').trim();
              const loc  = (p?.locationName ?? '').trim();
              if (!name) return null;
              return loc ? `${name} - ${loc}` : name;
            })
            .filter((s): s is string => !!s)
        )
      ),
      grade: ct.gradeCandidate || '—',
      views: Number(ct.countLike ?? 0),
      avatarUrl: '',
      faculty: ct.faculty,
      program: ct.major,
      phone: ct.phoneNumber,
      graduation_year: ct.graduation_year,
    };

    this.applicationFormSubmittedDate = ct.submitDate || '';

    // Screening card
    this.screening.screenedBy = '—';
    this.screening.screeningDate = '';
    this.screening.status = null;
    this.screeningCardBg = '#6C757D';

    // เดิม: เช็ค Pending ของ Screened
    this.hasScreenedPending = isInProcess(ct?.screened?.status);

    // ถ้า Pending → เข้าสู่โหมดแก้ไขทันที (Confirm/Cancel)
    if (this.hasScreenedPending) {
      this.screeningCardBg = '#FFAA00';
      this.screening.status = 'Pending';
      this.screening.screenedBy = this.sessionUserName || '—';
      this.screening.screeningDate = this.today;

      this.editReview = true;
      this.allowEditButton = false;
    } else {
      // ไม่ Pending → ให้สิทธิแก้ไขตามกติกาใหม่
      this.editReview = false;
      this.allowEditButton = this.shouldAllowEditForScreened(ct);
    }

    this.syncNotesEditableByStatus();

    // Steps
    const stepsRaw: Array<{ label: string; date?: string; status: StepStatus; sub?: string; }> = [
      { label: 'Applied',    date: formatDay(ct.applied?.date ?? ct.submitDate), status: stepStatusFrom(ct.applied, ct.submitDate), sub: subFrom(ct.applied, 'Submitted') },
      { label: 'Screened',   date: formatDay(ct.screened?.date ?? ct.lastUpdate), status: stepStatusFrom(ct.screened),              sub: subFrom(ct.screened, 'Screened') },
      { label: 'Interview 1',date: formatDay(ct.interview1?.date),                status: stepStatusFrom(ct.interview1),            sub: subFrom(ct.interview1) },
      { label: 'Interview 2',date: formatDay(ct.interview2?.date),                status: stepStatusFrom(ct.interview2),            sub: subFrom(ct.interview2) },
      { label: 'Offered',    date: formatDay(ct.offer?.date),                     status: stepStatusFrom(ct.offer),                 sub: subFrom(ct.offer) },
      { label: 'Hired',      date: formatDay(ct.hired?.date),                     status: stepStatusFrom(ct.hired),                 sub: subFrom(ct.hired) },
    ];

    const lastDoneIndex = stepsRaw.map((s) => s.status).lastIndexOf('done');
    this.steps = stepsRaw;
    this.currentIndex = lastDoneIndex;

    this.stepperItems = this.steps.map((s) => ({
      label: s.label,
      sub: s.sub || (s.status === 'done' ? 'Accept' : ''),
      date: s.date || '',
      variant: statusToVariant(s.sub),
    }));

    this.activeStepIndex = this.currentIndex >= 0 ? this.currentIndex : 0;
    this.disabledStepLabels = this.steps.map((s, i) => (i > this.currentIndex + 1 ? s.label : '')).filter(Boolean);

    // load details
    this.fetchAssessmentAndWarnings(Number(this.applicant.id || 0));
    this.fetchStageHistoryAndReasons(Number(this.applicant.id || 0));
    this.loadComments(Number(this.applicant.id || 0));
    this.fetchInterest(Number(this.applicant.id || 0));
    this.fetchFiles(Number(this.applicant.id || 0));
  }

  // ===================== Assessment Columns =====================
  private initAssessmentColumns() {
    this.assessmentColumns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Application Review', field: 'review', type: 'text', minWidth: '220px', wrapText: true },
      { header: 'Result', field: 'result', type: 'text', minWidth: '140px', wrapText: true },
      { header: 'Score', field: 'score', type: 'number', align: 'center', width: '90px', minWidth: '90px', maxWidth: '100px' },
      { header: 'Visibility', field: 'visibility', type: 'icon', align: 'center', width: '110px', minWidth: '110px' },
      {
        header: 'Details',
        field: 'details',
        type: 'text',
        minWidth: '220px',
        typeFn: (row: AssessmentItem) => row?.isTotalRow ? 'badge' : 'text',
        wrapText: true
      },
    ];
  }

  private initWarningColumns() {
    this.warningColumns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Warning', field: 'warning', type: 'text', minWidth: '220px', wrapText: true },
      { header: 'Result', field: 'result', type: 'text', minWidth: '140px', wrapText: true },
      { header: 'Risk', field: 'risk', type: 'badge', align: 'center', width: '110px', minWidth: '110px' },
      { header: 'Visibility', field: 'visibility', type: 'icon', align: 'center', width: '110px', minWidth: '110px' },
      { header: 'Detail', field: 'detail', type: 'text', minWidth: '220px', wrapText: true },
    ];
  }

  // ===================== Fetch & Map =====================
  private fetchAssessmentAndWarnings(userId: number) {
    if (!userId) return;
    this.applicationService
      .getApplicationAssessmentAndCandidateWarning(userId, this.roundID)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.mapAssessmentFromApi(res),
        error: (err) => console.error('[ApplicationForm] assessment error:', err),
      });
  }

  private mapAssessmentFromApi(payload: any) {
    const groups = Array.isArray(payload?.validationGroups) ? payload.validationGroups : [];
    const assess = groups.find((g: any) => Number(g?.typeCondition) === 1);

    const rows: AssessmentItem[] = [];
    const list = Array.isArray(assess?.validationResults) ? assess.validationResults : [];

    list.forEach((it: any, idx: number) => {
      const passed = !!it?.isPassed;
      const resultText = has(it?.viewColumnResult) ? String(it.viewColumnResult)
                      : has(it?.columnValue)      ? String(it.columnValue) : '—';
      const detailLabel = passed ? '' : (String(it?.errorMessage || it?.conditionName || 'Failed').trim());

      rows.push({
        no: idx + 1,
        review: String(it?.conditionName || '—').trim(),
        result: resultText,
        score: has(it?.columnValue) ? Number(it.columnValue) : (passed ? 1 : 0),
        visibility: {
          icon: passed ? 'check-circle' : 'xmark-circle',
          fill: passed ? 'green' : 'red',
          size: 18,
        },
        details: detailLabel,
      } as AssessmentItem);
    });

    const noRecommend = list.some(
      (it: { columnName: string; columnValue: string; }) =>
        (it.columnName === 'EQScore' && it.columnValue === '0') ||
        (it.columnName === 'EthicsScore' && it.columnValue === '0')
    );

    console.log(noRecommend);

    const maxScore = rows.length;
    const sumScore = rows.reduce((acc, r) => acc + (Number(r.score) || 0), 0);
    const passRatio = maxScore > 0 ? sumScore / maxScore : 0;
    const recommend = passRatio >= 0.5 ? 'Recommend for Acceptance' : 'Not Recommended for Acceptance';
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));

    rows.push({
      no: '' as any,
      review: 'Total',
      result: '',
      score: `${fmt(sumScore)}/${maxScore}`,
      visibility: {
        icon: passRatio >= 0.5 ? 'check-circle' : 'xmark-circle',
        fill: passRatio >= 0.5 ? 'green' : 'red',
        size: 18,
      },
      details: {
        label: !noRecommend ? recommend : 'Recommend for Decline',
        class: passRatio >= 0.5 && !noRecommend
          ? ['tw-bg-green-50','tw-ring-green-300','tw-text-green-700']
          : ['tw-bg-red-50','tw-ring-red-300','tw-text-red-700'],
      },
      isTotalRow: true,
    } as AssessmentItem);

    this.assessmentRows = rows;

    // Candidate Warning
    const warn = groups.find((g: any) => Number(g?.typeCondition) === 2);
    const wlist = Array.isArray(warn?.validationResults) ? warn.validationResults : [];

    const wrows = wlist.map((it: any, idx: number) => {
      const passed = !!it?.isPassed;
      const riskLabel = passed ? 'Strength' : 'Weakness';
      const resultText = has(it?.viewColumnResult) ? String(it.viewColumnResult)
                       : has(it?.columnValue)      ? String(it?.columnValue) : '—';
      const detailText = passed ? '' : (String(it?.errorMessage || it?.conditionName || 'Needs attention').trim());

      return {
        no: idx + 1,
        warning: String(it?.conditionName || '—').trim(),
        result: resultText,
        risk: {
          label: riskLabel,
          class: passed
            ? ['tw-bg-green-50','tw-ring-green-300','tw-text-green-700']
            : ['tw-bg-red-500','tw-text-white','tw-ring-red-600'],
        },
        visibility: {
          icon: passed ? 'check-circle' : 'xmark-circle',
          fill: passed ? 'green' : 'red',
          size: 18,
        },
        detail: detailText,
      };
    });

    this.warningRows = wrows;
  }

  private fetchStageHistoryAndReasons(appId: number) {
    const SCREENED_STAGE_ID = 1; // Screening stage

    this.applicationService.getCandidateStageHistoryById(appId)
      .pipe(
        map((histories: any[]) =>
          (Array.isArray(histories) ? histories : []).filter(h =>
            Number(h.roundId) === Number(this.roundID)
          )
        ),
        switchMap((histories: any[]) => {
          // รวม stageId จาก history + (ถ้า Pending ให้บังคับดึงของ Screened ด้วย)
          const idSet = new Set<number>(
            histories.map(h => Number(h.stageId)).filter(Boolean)
          );
          if (this.hasScreenedPending) idSet.add(SCREENED_STAGE_ID);

          const uniqStageIds = Array.from(idSet);

          if (uniqStageIds.length === 0) {
            return of({ histories, reasonsPacks: [] as Array<{ stageId: number; cats: any[] }> });
          }

          const reasonsReq = uniqStageIds.map(id =>
            this.reasonService.getRecruitmentStagesWithReasons(id).pipe(
              map((cats: any[]) => ({ stageId: id, cats })),
              catchError(() => of({ stageId: id, cats: [] as any[] }))
            )
          );

          return forkJoin(reasonsReq).pipe(
            map(reasonsPacks => ({ histories, reasonsPacks }))
          );
        }),
        catchError((e) => {
          console.error('[ApplicationForm] stage history error:', e);
          return of({ histories: [] as any[], reasonsPacks: [] as any[] });
        })
      )
      .subscribe({
        next: ({ histories, reasonsPacks }) => {
          // ===== เก็บ reasons ของแต่ละ stage =====
          const packByStage = new Map<number, any[]>(
            (reasonsPacks || []).map((p: any) => [p.stageId, p.cats])
          );
          this.reasonsByStage = packByStage;

          // ===== Non-summary สำหรับ Interview 1 / 2 =====
          const i1 = (histories || []).filter(h =>
            String(h.stageName || '').trim().toLowerCase() === 'interview 1' && !h.isSummary
          );
          const i2 = (histories || []).filter(h =>
            String(h.stageName || '').trim().toLowerCase() === 'interview 2' && !h.isSummary
          );
          const screened = (histories || []).filter(h =>
            ['screened', 'screening'].includes(String(h.stageName || '').trim().toLowerCase()) &&
            !h.isSummary
          );
          const enrich = (arr: any[]) => arr.map(it => ({
            ...it,
            expandState: { strength: false, concern: false },
            overflowState: { strength: false, concern: false },
          }));
          this.interview1NonSummary = enrich(i1);
          this.interview2NonSummary = enrich(i2);
          this.screeningNonSummary = enrich(screened);

          setTimeout(() => {
            const tune = (len: number) => ({ slidesToShow: len === 1 ? 1 : 2, dots: len > 2 });
            this.slideConfigI1 = {
              ...this.slideConfigI1,
              ...tune(this.interview1NonSummary.length),
              responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: this.interview1NonSummary.length > 1 } }]
            };
            this.slideConfigI2 = {
              ...this.slideConfigI2,
              ...tune(this.interview2NonSummary.length),
              responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: this.interview2NonSummary.length > 1 } }]
            };
            this.slideConfigScreened = { 
              ...this.slideConfigScreened, 
              ...tune(this.screeningNonSummary.length),
              responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: this.screeningNonSummary.length > 1 } }]
            };


            console.log(this.slideConfigScreened , '=>this.screeningNonSummary.length')

            setTimeout(() => {
              this.i1Carousels?.forEach(c => { try { c.unslick(); c.initSlick(); } catch {} });
              this.i2Carousels?.forEach(c => { try { c.unslick(); c.initSlick(); } catch {} });
              this.screeningCarousels?.forEach(c => { try { c.unslick(); c.initSlick(); } catch {} });
            }, 0);
            setTimeout(() => this.checkAllOverflowNonSummary(), 0);
          }, 0);

          // ===== สร้าง summary sections จาก histories =====
          this.stageSections = (histories || []).map((h): StageSection => {
            const stageId = Number(h.stageId);
            const stageName = String(h.stageName || '');
            const stageNameNorm = stageName.trim().toLowerCase();

            const headerTitle = this.isScreened(stageNameNorm)
              ? 'Application Screening'
              : `Application ${stageName}`;

            const cats = (packByStage.get(stageId) || []).map(c => ({
              categoryId: c.categoryId,
              categoryName: c.categoryName
            })) as CategoryOption[];

            const selectedCategoryId = Number(h.categoryId) || undefined;
            const selectedCat = (packByStage.get(stageId) || []).find(c => Number(c.categoryId) === selectedCategoryId);
            const allReasons: ReasonOption[] = (selectedCat?.rejectionReasons || []).map((r: any) => ({
              reasonId: r.reasonId,
              reasonText: r.reasonText,
              checked: Array.isArray(h.selectedReasonIds)
                ? h.selectedReasonIds.includes(r.reasonId)
                : false
            }));

            // 🔽🔽 จุดสำคัญ — ให้ใช้ shouldAllowEditForScreened กับข้อมูลเต็ม ct ล่าสุด
            const canEdit =
              this.isScreened(stageNameNorm) &&
              this.shouldAllowEditForScreened(this.currentCandidateTracking || ({} as any));

            return {
              historyId: Number(h.historyId),
              stageId,
              stageName,
              stageNameNormalized: stageNameNorm,
              headerTitle,
              hrUserId: h.hrUserId,
              hrUserName: h.hrUserName || '—',
              stageDate: h.stageDate || '',
              categories: cats,
              selectedCategoryId,
              reasons: allReasons,
              notes: h.notes ?? null,
              strength: h.strength ?? null,
              concern: h.concern ?? null,
              isSummary: h.isSummary,
              open: true,
              isEditing: false,
              canEdit, // ✅ ใช้ค่าที่คำนวณใหม่
            };
          });

          this.stageSections.forEach((s, idx) => {
            const isI1 = s.stageNameNormalized === 'interview 1';
            const isI2 = s.stageNameNormalized === 'interview 2';
            if (!s.isSummary || (!isI1 && !isI2)) return;

            // หา raw history ต้นทางของ section นี้ (ใช้ historyId จับคู่)
            const h = (histories || []).find(x => Number(x.historyId) === Number(s.historyId));
            const selectedIds   = Array.isArray(h?.selectedReasonIds) ? h!.selectedReasonIds as number[] : [];
            const selectedTexts = Array.isArray(h?.selectedReasonTexts) ? h!.selectedReasonTexts as string[] : [];

            // ประกอบ UI read-only
            s.uiReadonly = this.buildInterviewReadonlyUI(
              s.stageId,
              s.selectedCategoryId,
              selectedIds,
              selectedTexts
            );
          });

          // ===== จัดลำดับ =====
          const orderWeight: Record<string, number> = {
            screened: 1,
            'interview 1': 2,
            'interview 2': 3,
            offered: 4,
          };
          this.stageSections.sort((a, b) => {
            const keyA = this.isScreened(a.stageNameNormalized) ? 'screened' : a.stageNameNormalized;
            const keyB = this.isScreened(b.stageNameNormalized) ? 'screened' : b.stageNameNormalized;
            const wa = orderWeight[keyA] ?? 999;
            const wb = orderWeight[keyB] ?? 999;
            if (wa !== wb) return wa - wb;
            return new Date(a.stageDate || 0).getTime() - new Date(b.stageDate || 0).getTime();
          });

          // ===== Fallback: ถ้า Screened = Pending และยังไม่มีการ์ด summary → แทรกการ์ดจำลอง (stageId=1 + categories จาก reasons) =====
          if (this.hasScreenedPending &&
              !this.stageSections.some(s => this.isScreened(s.stageNameNormalized) && s.isSummary !== false)) {

            const screenCats = (packByStage.get(SCREENED_STAGE_ID) || []).map(c => ({
              categoryId: c.categoryId,
              categoryName: c.categoryName
            })) as CategoryOption[];

            this.stageSections = [{
              historyId: 0,
              stageId: SCREENED_STAGE_ID, // <— สำคัญ
              stageName: 'Screened',
              stageNameNormalized: 'screened',
              headerTitle: 'Application Screening',
              hrUserId: this.sessionUserId,
              hrUserName: this.sessionUserName || '—',
              stageDate: this.today,
              categories: screenCats,     // <— เติม categories ให้ปุ่ม Result โชว์
              selectedCategoryId: undefined,
              reasons: [],
              notes: '',
              strength: null,
              concern: null,
              isSummary: true,
              open: true,
            }, ...this.stageSections];

            // เติมค่า default ให้ฟอร์ม
            if (!this.formDetails.get('dateInterviewReview')?.value) {
              this.formDetails.get('dateInterviewReview')?.setValue(this.today);
            }
            this.cdr.detectChanges();
          }

          // ===== อัปเดตการ์ด Screening (เมื่อไม่ Pending) =====
          if (!this.hasScreenedPending) {
            const screenedList = (histories || []).filter(h => {
              const n = String(h.stageName || '').trim().toLowerCase();
              return n === 'screened' || n === 'screening';
            });
            if (screenedList.length) {
              const pickLatest = screenedList
                .slice()
                .sort((a, b) => new Date(b.stageDate || 0).getTime() - new Date(a.stageDate || 0).getTime())[0];

              const hrName = pickLatest?.hrUserName || '—';
              const catName = String(pickLatest?.categoryName || '');
              const status  = this.normalizeCategoryToStatus(catName);
              const bg      = this.categoryToBg(catName);

              this.screening.screenedBy    = hrName;
              this.screening.screeningDate = pickLatest?.stageDate || this.screening.screeningDate || '';
              this.screening.status        = status;
              this.screeningCardBg         = bg;
              this.syncNotesEditableByStatus();
            }
          }

          // ===== Default สำหรับ Screened = Pending: ตั้ง Result อันแรก + โหลด Reasons อัตโนมัติ =====
          // if (this.hasScreenedPending) {
          //   const screenedSection = this.findScreeningSection();
          //   if (screenedSection) {
          //     // ถ้ายังไม่เคยเลือก category ให้เลือกตัวแรกจากรายการ categories ของการ์ดนั้น
          //     // if (!screenedSection.selectedCategoryId && (screenedSection.categories?.length)) {
          //     //   screenedSection.selectedCategoryId = screenedSection.categories[0].categoryId;
          //     // }
          //     // โหลด reasons ของ category ที่ตั้งไว้ (กรองเฉพาะที่ active และไม่ถูกลบ)
          //     screenedSection.reasons = this.buildReasonsFor(screenedSection.stageId, screenedSection.selectedCategoryId);

          //     // เผื่อค่าฟอร์มว่าง → ตั้งวันที่วันนี้
          //     if (!this.formDetails.get('dateInterviewReview')?.value) {
          //       this.formDetails.get('dateInterviewReview')?.setValue(this.today);
          //     }

          //     // เข้าสู่โหมดแก้ไขทันที (ให้มีปุ่ม Confirm/Cancel โผล่เลย)
          //     this.editReview = true;
          //     this.allowEditButton = false;

          //     this.cdr.detectChanges();
          //   }
          // }

          // ===== History log =====
          this.historyLogs = (histories || [])
            .map(h => ({ date: h.stageDate, action: `${h.stageName} ${h.categoryName} by ${h.hrUserName}` }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          this.prefillScreeningFormFromHistory();
          
          if(histories.length) {
            this.allowEditButton = true;
            this.editReview = false;
          }

          this.screeningCount = this.stageSections.filter(item => item.stageId === 1).length;
          this.interviewCount = this.stageSections.filter(item => item.stageId === 2).length;

          // ถ้าไม่มี history เลย → สร้างการ์ด Screened เปล่า
          if ((histories || []).length === 0) {
            const screenCats = (this.reasonsByStage.get(SCREENED_STAGE_ID) || []).map(c => ({
              categoryId: c.categoryId,
              categoryName: c.categoryName
            })) as CategoryOption[];

            const stub: StageSection = {
              historyId: 0,
              stageId: SCREENED_STAGE_ID,
              stageName: 'Screened',
              stageNameNormalized: 'screened',
              headerTitle: 'Application Screening',
              hrUserId: this.sessionUserId,
              hrUserName: this.sessionUserName || '—',
              stageDate: this.today,
              categories: screenCats,
              selectedCategoryId: undefined,
              reasons: [],
              notes: '',
              strength: null,
              concern: null,
              isSummary: true,
              open: true,
              // เปิดแก้ไขตั้งแต่แรก + โชว์ Confirm/Cancel
              isEditing: true,
              canEdit: true,
            };

            this.stageSections = [stub];

            // ตั้งค่า form เริ่มต้น
            if (!this.formDetails.get('dateInterviewReview')?.value) {
              this.formDetails.get('dateInterviewReview')?.setValue(this.today);
            }
            this.syncNotesEditableByStatus(stub); // เปิด textarea
            
            this.screeningCount = 0;

            return; // จบ flow ตรงนี้ได้เลย
          }

        },
        error: (e) => console.error('[ApplicationForm] stage history subscribe error:', e)
      });
  }

  private prefillScreeningFormFromHistory() {
    const s = this.findScreeningSection();
    if (!s) return;
    const noteCtrl = this.formDetails.get('noteInterviewReview');
    const dateCtrl = this.formDetails.get('dateInterviewReview');
    
    if (s.notes != null && noteCtrl?.value !== s.notes) {
      noteCtrl?.setValue(s.notes, { emitEvent: false });
    }
    
    const d = s.stageDate ? dayjs(s.stageDate).format('YYYY-MM-DD') : this.today;
    if (d && dateCtrl?.value !== d) {
      dateCtrl?.setValue(d, { emitEvent: false });
    }
  }

  // ===================== UI Events =====================
  onFilterButtonClick(key: string) {
    if (key === 'print') this.onPrintClicked();
  }

  private buildPrintUrl(userId: number, round = 1): string {
    // const base = 'https://career.pinepacific.com/WebFormApply/WebFormApply.aspx';
    const base = '/form-apply';
    const qs = new URLSearchParams({ UserID: String(userId), Round: String(round) });
    return `${base}?${qs.toString()}`;
  }

  onPrintClicked() {
    if (!this.applicantId || isNaN(this.applicantId)) {
      this.notify?.error?.('Missing applicant ID. Cannot open the printable application form.');
      return;
    }
    const round = 1;
    const url = this.buildPrintUrl(this.applicantId, round);
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }

  onScreeningCardClick() {}

  onViewDetailClick() {
    const id = this.applicantId;
    if (!id) return;
    const flow = this.resolveCurrentFlow();
    const queryParams = { id, round: this.roundID };
    this.router.navigate([`/applications/${flow}/application-form/details`], { queryParams });
  }

  // Comments
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
      ui: { isReplying: false, replyText: '', isEditing: false, editText: c.commentText || '' }
    };
  }

  private resolveCommentType(parent?: ViewComment): string {
    if (parent?.commentType) return parent.commentType;
    return 'application';
  }

  onSubmitNewComment() {
    const text = (this.commentCtrl.value || '').trim();
    if (!text || !this.applicantId) return;

    this.applicationService
      .getCurrentStageByCandidateId(this.applicantId)
      .pipe(
        takeUntil(this.destroy$),
        map((res: any) => (res?.data?.typeName ? String(res.data.typeName).trim() : 'Application')),
        catchError((e) => { console.error('[ApplicationForm] current stage error:', e); return of('Application'); }),
        switchMap((typeName: string) => {
          const body = { candidateId: this.applicantId, commentText: text, commentType: typeName, parentCommentId: null };
          return this.applicationService.addCommentByCandidateId(body);
        })
      )
      .subscribe({
        next: () => { this.commentCtrl.setValue(''); this.loadComments(this.applicantId); },
        error: (e) => console.error('[ApplicationForm] add comment error:', e),
      });
  }

  toggleReply(c: ViewComment) {
    c.ui.isReplying = !c.ui.isReplying;
    if (c.ui.isReplying) c.ui.replyText = '';
  }

  onSubmitReply(parent: ViewComment) {
    const text = (parent.ui.replyText || '').trim();
    if (!text || !this.applicantId) return;

    const body = { candidateId: this.applicantId, commentText: text, commentType: this.resolveCommentType(parent), parentCommentId: parent.id };
    this.applicationService.addCommentByCandidateId(body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { parent.ui.isReplying = false; parent.ui.replyText = ''; this.loadComments(this.applicantId); },
        error: (e) => console.error('[ApplicationForm] reply error:', e)
      });
  }

  startEdit(c: ViewComment) {
    if (!c.isEdited) return;
    c.ui.isEditing = true;
    c.ui.editText = c.text;
  }

  onSaveEdit(c: ViewComment) {
    const text = (c.ui.editText || '').trim();
    if (!text) return;
    this.applicationService.editCommentById(c.id, { commentText: text })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { c.ui.isEditing = false; this.loadComments(this.applicantId); },
        error: (e) => console.error('[ApplicationForm] edit comment error:', e)
      });
  }

  private openAlert(data: AlertDialogData) {
    return this.dialog
      .open(AlertDialogComponent, { data, width: '480px', disableClose: true, panelClass: ['pp-rounded-dialog'] })
      .afterClosed();
  }

  onDeleteComment(c: ViewComment) {
    if (!c.canDelete) return;
    this.openAlert({ title: 'Delete this comment?', message: 'Do you want to delete this comment?', confirm: true })
      .subscribe((res) => {
        if (!res) return;
        this.applicationService.deleteCommentById(c.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => this.loadComments(this.applicantId),
            error: (e) => console.error('[ApplicationForm] delete comment error:', e)
          });
      });
  }

  trackByCommentId = (_: number, c: ViewComment) => c.id;

  onCommentClick() {
    const el = document.getElementById('comments-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  get totalComments(): number {
    return this.countAllComments(this.commentsTree);
  }

  private countAllComments(list: ViewComment[] | undefined | null): number {
    if (!Array.isArray(list) || !list.length) return 0;
    let sum = 0;
    for (const c of list) {
      sum += 1;
      if (Array.isArray(c.replies) && c.replies.length) sum += this.countAllComments(c.replies);
    }
    return sum;
  }

  slugify(str: string): string {
    return (str || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
  }

  private getScrollParent(el: HTMLElement | null): HTMLElement | Window {
    let p = el?.parentElement;
    while (p) {
      const cs = getComputedStyle(p);
      const scrollable = /(auto|scroll|overlay)/.test(cs.overflowY) || /(auto|scroll|overlay)/.test(cs.overflow);
      if (scrollable) return p;
      p = p.parentElement!;
    }
    return window;
  }

  private firstStageId(stageSlug: string): string | null {
    const idx = this.stageSections.findIndex(s => this.slugify(s.stageNameNormalized) === stageSlug && s.isSummary !== false);
    return idx >= 0 ? `section-${stageSlug}-${idx}` : null;
  }

  private scrollToId(id: string) {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const container = this.getScrollParent(el);
      const header = document.querySelector('.tw-sticky.tw-top-0') as HTMLElement | null;
      const offset = (header?.offsetHeight ?? 0) + 12;

      if (container === window) {
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      } else {
        const c = container as HTMLElement;
        const top = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - offset;
        c.scrollTo({ top, behavior: 'smooth' });
      }
    }, 0);
  }

  onStepperChanged(index: number) {
    const item  = this.stepperItems?.[index];
    const label = (item?.label || '').trim();
    const key   = this.slugify(label);

    if (key === 'interview-1' || key === 'interview-2') {
      const sub = String(item?.sub || '').toLowerCase();
      const isFinal = /(pass|passed|fail|failed)/.test(sub);
      const isPending = /(pending|inprocess|scheduled)/.test(sub);
      console.log(isPending)
      if (!isPending && sub && !isFinal) {
        const interview = key === 'interview-1' ? 1 : 2;
        this.router.navigate(['/interview-scheduling/interview-round-'+interview+'/history'], { queryParams: { id: this.applicantId } });
      } else if (isPending && sub) {
        const interview = key === 'interview-1' ? 1 : 2;
        this.router.navigate(['/interview-scheduling/interview-round-'+interview], { queryParams: { id: this.applicantId } });
      } else if (this.applicantId && isFinal && sub) {
        const interview = key === 'interview-1' ? 1 : 2;
        this.router.navigate(['/interview-scheduling/interview-form/result'], { queryParams: { id: this.applicantId, interview, round: this.roundID } });
      }
      return;
    }

    this.activeStepIndex = index;
    let targetId: string | null = null;
    switch (key) {
      case 'applied':   targetId = 'section-applied'; break;
      case 'screened':  targetId = this.firstStageId('screened'); break;
      case 'offered':   targetId = this.firstStageId('offered'); break;
      case 'hired':     targetId = this.firstStageId('hired'); break;
    }
    if (targetId) this.scrollToId(targetId);
  }

  // ===== ISO-second equality =====
  private sameIsoSecond(a?: string, b?: string): boolean {
    if (!a || !b) return true;
    const A = String(a).trim().slice(0, 19);
    const B = String(b).trim().slice(0, 19);
    return A === B;
  }

  isEditedAtSecond(createdAt?: string, updatedAt?: string): boolean {
    if (!updatedAt) return false;
    return !this.sameIsoSecond(createdAt, updatedAt);
  }

  private normalizeCategoryToStatus(cat?: string): ScreeningStatus {
    const s = String(cat || '').trim().toLowerCase();
    if (s === 'accept') return 'Accept';
    if (s === 'decline') return 'Decline';
    if (s === 'on hold' || s === 'hold') return 'On Hold';
    return null;
  }

  private categoryToBg(cat?: string): string {
    const s = String(cat || '').trim().toLowerCase();
    if (s === 'accept')  return '#005500';
    if (s === 'decline') return '#930000';
    if (s === 'on hold' || s === 'hold') return '#FFAA00';
    return '#6C757D';
  }

  // ===== Slick helpers =====
  onCarouselInit(e: any, idx: number) {
    this.totalSlides[idx] = e?.slick?.slideCount ?? 0;
    this.currentSlide[idx] = 0;
    this.updateArrowState(idx);
    this.cdr.detectChanges();
  }

  onSlideChanged(e: any, idx: number) {
    this.currentSlide[idx] = e?.currentSlide ?? 0;
    this.updateArrowState(idx);
  }

  updateArrowState(idx: number) {
    const visible = this.getVisibleSlides();
    const maxStart = (this.totalSlides[idx] || 0) - visible;
    this.canGoPrev[idx] = (this.currentSlide[idx] || 0) > 0;
    this.canGoNext[idx] = (this.currentSlide[idx] || 0) < (maxStart || 0);
  }

  getVisibleSlides(): number {
    const w = window.innerWidth;
    return w < 768 ? 1 : 2;
  }

  // ===== Expand / Overflow check =====
  toggleExpandNonSummary(which: 'i1'|'i2', index: number, field: 'strength'|'concern') {
    const list = which === 'i1' ? this.interview1NonSummary : this.interview2NonSummary;
    const row = list[index];
    if (!row) return;
    row.expandState[field] = !row.expandState[field];
    setTimeout(() => this.checkOverflowNonSummary(which, index, field), 0);
  }

  checkOverflowNonSummary(which: 'i1'|'i2', index: number, field: 'strength'|'concern') {
    const els = which === 'i1'
      ? (field === 'strength' ? this.i1StrengthTexts : this.i1ConcernTexts)
      : (field === 'strength' ? this.i2StrengthTexts : this.i2ConcernTexts);
    const el = els?.toArray?.()[index]?.nativeElement as HTMLElement | undefined;
    const list = which === 'i1' ? this.interview1NonSummary : this.interview2NonSummary;
    if (!el || !list[index]) return;
    list[index].overflowState[field] = el.scrollHeight > el.clientHeight;
  }

  checkAllOverflowNonSummary() {
    this.interview1NonSummary.forEach((_, i) => {
      this.checkOverflowNonSummary('i1', i, 'strength');
      this.checkOverflowNonSummary('i1', i, 'concern');
    });
    this.interview2NonSummary.forEach((_, i) => {
      this.checkOverflowNonSummary('i2', i, 'strength');
      this.checkOverflowNonSummary('i2', i, 'concern');
    });
  }

  // ===== สีป้าย Result =====
  getCategoryBtnClass(c: CategoryOption, selectedId?: number) {
    const isActive = c.categoryId === selectedId;
    const name = (c.categoryName || '').toLowerCase();
    const isDecline = /(decline|rejected?|fail|failed)/.test(name);
    const isHold    = /(on hold|hold)/.test(name);
    const isNoShow  = /no-?show/.test(name);
    const isPositive = /(accept|offer|offered|onboarded?|hired?|hire)/.test(name);

    let tone: string;
    if (isDecline)      tone = 'tw-bg-red-500 tw-text-white tw-border-red-600';
    else if (isHold)    tone = 'tw-bg-amber-500 tw-text-white tw-border-amber-600';
    else if (isNoShow)  tone = 'tw-bg-gray-200 tw-text-gray-800 tw-border-gray-300';
    else if (isPositive)tone = 'tw-bg-green-500 tw-text-white tw-border-green-600';
    else                tone = 'tw-bg-white tw-text-gray-700 tw-border-gray-300';

    const inactive = 'hover:tw-brightness-105';
    const activeRing = 'tw-ring-2 tw-ring-white/40';
    return isActive ? `${tone} ${activeRing}` : `${tone.includes('tw-bg-white') ? tone : 'tw-bg-white tw-text-gray-700 tw-border-gray-300'} ${inactive}`;
  }

  stageLabel(which: 'screened' | 'i1' | 'i2'): string {
    switch (which) {
      case 'screened':
        return 'screened';
      case 'i1':
        return 'interview 1';
      case 'i2':
        return 'interview 2';
      default:
        return '';
    }
  }

  hasStageSummary(which: 'screened' | 'i1'|'i2'): boolean {
    const label = this.stageLabel(which);
    return this.stageSections.some(s => s.stageNameNormalized === label && s.isSummary !== false);
  }

  firstIndexOfStage(which: 'screened' | 'i1'|'i2'): number {
    const label = this.stageLabel(which);
    return this.stageSections.findIndex(s => s.stageNameNormalized === label);
  }

  shouldInsertNonSummary(which: 'screened' | 'i1' | 'i2', s: StageSection, idx: number): boolean {
    const label = this.stageLabel(which);
    if (s.stageNameNormalized !== label) return false;
    const hasSummary = this.hasStageSummary(which);
    if (hasSummary) {
      return s.isSummary !== false;
    }
    return idx === this.firstIndexOfStage(which);
  }

  openAttachment(att: Attachment) {
    if (att?.file) window.open(att.file, '_blank');
  }

  private fetchInterest(id: number) {
    if (!id) return;
    this.applicationService.getInterestByCandidateId(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.likeState.count = Number(res?.countLike ?? 0);
          this.likeState.liked = !!res?.isLikedByCurrentEmployee;
        },
        error: (e) => console.error('[ApplicationForm] fetchInterest error:', e)
      });
  }

  onToggleLike() {
    if (!this.applicantId || this.likeState.loading) return;
    const wantLike = !this.likeState.liked;
    const body = { candidateId: this.applicantId };
    const prev = { ...this.likeState };
    this.likeState.loading = true;
    this.likeState.liked = wantLike;
    this.likeState.count = Math.max(0, this.likeState.count + (wantLike ? 1 : -1));

    const req$ = wantLike ? this.applicationService.addInterest(body) : this.applicationService.deleteInterest(body);
    req$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.fetchInterest(this.applicantId); this.likeState.loading = false; },
      error: (e) => { console.error('[ApplicationForm] toggle like error:', e); this.likeState = prev; }
    });
  }

  private fetchFiles(id: number) {
    if (!id) return;
    this.applicationService.getFileByCandidateId(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          const files = Array.isArray(res) ? res : [];
          const profile = files.find(f => String(f?.fileType).toLowerCase() === 'profile');
          this.applicant.avatarUrl = profile?.filePath || '';
          this.transcripts = files.filter(f => String(f?.fileType).toLowerCase() === 'transcript')
            .map(f => ({ name: f.fileName, file: f.filePath }));
          this.certifications = files.filter(f => String(f?.fileType).toLowerCase() === 'certification')
            .map(f => ({ name: f.fileName, file: f.filePath }));
        },
        error: (e) => console.error('[ApplicationForm] getFileByCandidateId error:', e)
      });
  }

  private resolveCurrentFlow():
    'all-applications' | 'screening' | 'tracking' {
    const url = this.router.url || '';
    if (url.includes('/all-applications/')) return 'all-applications';
    if (url.includes('/screening/'))        return 'screening';
    if (url.includes('/tracking/'))         return 'tracking';
    return 'screening';
  }

  onFilterSelectChanged(e: { key: string; value: number; label: string }) {
    if (!e) return;
    if (e.key === 'round') {
      const r = Number(e.value);
      if (!isNaN(r) && r !== this.roundID) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { round: r },
          queryParamsHandling: 'merge',
        });
      }
    }
  }

  // ===================== Helpers ที่ template เรียกไว้ =====================
  disableInputPass() { return ''; }
  disableWhenNotLatest() { return ''; }
  formatDateDDMMYYYY(d?: string) {
    if (!d) return '';
    const m = dayjs(d);
    return m.isValid() ? m.format('DD/MM/YYYY') : '';
  }
  openDatePicker(el: HTMLInputElement) { try { (el as any).showPicker?.(); } catch { el.click(); } }
  onDateBoxMouseDown(el: HTMLInputElement) { if (this.editReview) this.openDatePicker(el); }
  onNativeDateChanged() {/* ค่าไปอยู่ใน form แล้ว */}

  // อ่าน user จาก sessionStorage
  private readSessionUser() {
    try {
      const raw = sessionStorage.getItem('user');
      const obj = raw ? JSON.parse(raw) : null;
      this.sessionUserName = obj?.username || '';
      this.sessionUserId = obj?.idEmployee || '';
      if (!this.currentUserName) this.currentUserName = this.sessionUserName || this.currentUserName;
    } catch {}
  }

  // ===================== เลือก Result แล้วโหลด Reason =====================
  onSelectCategory(s: StageSection, categoryId: number) {
    s.selectedCategoryId = categoryId;
    s.reasons = this.buildReasonsFor(s.stageId, s.selectedCategoryId);

    const packs = this.reasonsByStage.get(s.stageId) || [];
    const selectedCat = packs.find((c: any) => Number(c.categoryId) === Number(categoryId));
    const reasons = (selectedCat?.rejectionReasons || []) as Array<any>;
    s.reasons = reasons.map(r => ({ reasonId: r.reasonId, reasonText: r.reasonText, checked: false }));
  }

  toggleReason(s: StageSection, index: number) {
    if (!s?.reasons?.length) return;
    s.reasons[index].checked = !s.reasons[index].checked;
  }

  // ===================== ปุ่ม Edit / Confirm / Cancel =====================
  onEditReview(s: StageSection) {
    s.isEditing = true;
    s.canEdit = false;
    this.originalSnapshot = {
      categoryId: s.selectedCategoryId,
      reasons: (s.reasons || []).map(r => ({ ...r })),
      notes: this.formDetails.get('noteInterviewReview')?.value || s.notes || '',
      date: s.stageDate ? dayjs(s.stageDate).format('YYYY-MM-DD') : this.today
    };

    const dateCtrl = this.formDetails.get('dateInterviewReview');
    const prefillDate = s.stageDate ? dayjs(s.stageDate).format('YYYY-MM-DD') : this.today;
    dateCtrl?.setValue(prefillDate);

    if (!this.formDetails.get('noteInterviewReview')?.value && s.notes) {
      this.formDetails.get('noteInterviewReview')?.setValue(s.notes);
    }

    this.allowEditButton = false;
    this.editReview = true;
    this.syncNotesEditableByStatus(s);
  }

  onCancelReview(stage: StageSection) {
    stage.isEditing = false;
    stage.canEdit = true;
    const s = this.stageSections.find(x => this.isScreened(x.stageNameNormalized) && x.isSummary !== false);
    if (s && this.originalSnapshot) {
      s.selectedCategoryId = this.originalSnapshot.categoryId;
      s.reasons = (this.originalSnapshot.reasons || []).map(r => ({ ...r }));
      this.formDetails.get('noteInterviewReview')?.setValue(this.originalSnapshot.notes || '');
      if (this.originalSnapshot.date) {
        this.formDetails.get('dateInterviewReview')?.setValue(this.originalSnapshot.date);
      }
    }
    this.originalSnapshot = null;
    this.editReview = false;
    this.allowEditButton = true; // ให้กลับมาโชว์ปุ่ม Edit ถ้าเป็นกรณีย้อนหลัง
    this.syncNotesEditableByStatus();
  }

  onConfirmReview(s: StageSection) {
    if (!this.applicantId) return;

    const dateStr = this.formDetails.get('dateInterviewReview')?.value || this.today; // 'YYYY-MM-DD'
    const isoDateUTC = dayjs.utc(dateStr, 'YYYY-MM-DD', true).isValid()
      ? dayjs.utc(dateStr, 'YYYY-MM-DD', true).startOf('day').toISOString()
      : dayjs.utc().startOf('day').toISOString();

    const checkedCategoryIds = s.selectedCategoryId ? [s.selectedCategoryId] : [];
    const checkedReasonIds = (s.reasons || []).filter(r => r.checked).map(r => r.reasonId);

    if (!checkedCategoryIds.length) {
      this.notify?.warn?.('Please select a Result.');
      return;
    }

    console.log(s.hrUserId, '=>>sssss')

    // ========= แยกสองกรณี =========
    const isPendingFlow = this.hasScreenedPending || !s.historyId; // ถ้า Pending หรือยังไม่มี historyId → add
    // if (!this.screeningCount || (s.hrUserId !== this.sessionUserId)) {
    if (!this.screeningCount) {
      if (!s.stageId) {
        this.notify?.error?.('Missing stage ID for Screening.');
        return;
      }
      const payloadAdd = {
        applicationId: this.applicantId,
        roundId: this.roundID,
        stageId: s.stageId,
        categoryId: checkedCategoryIds[0],
        isSummary: true,
        stageDate: isoDateUTC,
        appointmentId: '',
        satisfaction: 0,
        notes: this.formDetails.get('noteInterviewReview')?.value || '',
        strength: '',
        concern: '',
        selectedReasonIds: checkedReasonIds
      };

      this.applicationService.addInterviewReview(payloadAdd).subscribe({
        next: () => {
          s.isEditing = false;
          s.canEdit = true;
          this.notify?.success?.('Saved screening result.');
          this.editReview = false;
          this.allowEditButton = this.shouldAllowEditForScreened({ screened: { status: 'Accepted' } } as any) || false; // ปลอดภัยไว้ก่อน
          this.syncNotesEditableByStatus();
          this.fetchStageHistoryAndReasons(Number(this.applicant.id || 0));
          this.fetchCandidateTracking();
        },
        error: (err) => {
          console.error('[ApplicationForm] postInterviewReview error:', err);
          this.notify?.error?.('Cannot save screening result. Please try again.');
        }
      });

    } else {
      // ======= แก้ไขย้อนหลัง → updateInterviewReview =======
      const historyId = s.historyId;
      const payloadUpdate = {
        categoryId: checkedCategoryIds[0],
        stageDate: isoDateUTC,
        notes: this.formDetails.get('noteInterviewReview')?.value || '',
        strength: s.strength || '',
        concern: s.concern || '',
        selectedReasonIds: checkedReasonIds
      };

      this.applicationService.updateInterviewReview(historyId, payloadUpdate).subscribe({
        next: () => {
          s.isEditing = false;
          s.canEdit = true;

          this.notify?.success?.('Updated screening result.');
          this.editReview = false;
          // อนุญาตให้กด Edit ได้ต่อไปถ้ากติกายังผ่าน
          this.allowEditButton = true;
          this.syncNotesEditableByStatus();
          this.fetchStageHistoryAndReasons(Number(this.applicant.id || 0));
          this.fetchCandidateTracking();
        },
        error: (err) => {
          console.error('[ApplicationForm] updateInterviewReview error:', err);
          this.notify?.error?.('Cannot update screening result. Please try again.');
        }
      });
    }
  }

  // ===== alias สำหรับ template เดิม =====
  onComfirmReview() {
    const s = this.stageSections.find(x => this.isScreened(x.stageNameNormalized) && x.isSummary !== false);
    if (s) this.onConfirmReview(s);
  }
  onEditReviewLegacy() {
    const s = this.stageSections.find(x => this.isScreened(x.stageNameNormalized) && x.isSummary !== false);
    if (s) this.onEditReview(s);
  }

  // ===== Utils =====
  private findScreeningSection(): StageSection | undefined {
    return this.stageSections.find(x => x.stageNameNormalized === 'screened' && x.isSummary !== false);
  }

  // ให้ template เปิด date picker ได้เฉพาะตอนแก้ไข
  get canOpenDatePicker() {
    return this.editReview;
  }

  // ใช้จับทั้ง 'screened' และ 'screening'
  private isScreened(norm: string): boolean {
    const s = (norm || '').trim().toLowerCase();
    return s === 'screened' || s === 'screening';
  }

  private buildReasonsFor(stageId: number, categoryId?: number): ReasonOption[] {
    const packs = this.reasonsByStage.get(stageId) || [];
    const selectedCat = packs.find((c: any) => Number(c.categoryId) === Number(categoryId));
    return (selectedCat?.rejectionReasons || [])
      .filter((r: any) => r?.isActive)
      .map((r: any) => ({
        reasonId: r.reasonId,
        reasonText: r.reasonText,
        checked: false
      }));
  }

  private syncNotesEditableByStatus(s?: StageSection) {
    const notesCtrl = this.formDetails.get('noteInterviewReview');
    const can = !!s?.isEditing;
    can ? notesCtrl?.enable({ emitEvent: false }) : notesCtrl?.disable({ emitEvent: false });
  }

  private shouldAllowEditForScreened(ct: CandidateTracking): boolean {
    const scr = String(ct?.screened?.status || '').trim().toLowerCase();     // e.g. 'accepted' | 'decline' | 'on hold' | 'pending'
    const i1  = String(ct?.interview1?.status || '').trim().toLowerCase();   // e.g. 'pending', 'pass', ...
    const isDecline = scr.includes('decline');
    const isHold    = scr.includes('hold');
    const isAccept  = scr.includes('accept');
    const i1Pending = isInProcess(ct?.interview1?.status) || i1 === 'pending';
    return isDecline || isHold || (isAccept && i1Pending);
  }

  isEditingScreened(s: StageSection): boolean {
    return s?.stageNameNormalized === 'screened' && !!s.isEditing;
  }

  // ใช้กับ badge ผลลัพธ์ของ review ใน non-summary card
  badgeClassForCategory(name?: string): string {
    const s = String(name || '').trim().toLowerCase();
    if (!s) return 'tw-border-[#E5E7EB] tw-text-[#374151] tw-bg-[#F3F4F6]'; // default gray

    // No Show → ม่วง
    if (/\bno[\s-]?show\b/.test(s)) {
      return 'tw-border-[#E9D5FF] tw-text-[#6B21A8] tw-bg-[#e9d5ff63]';
    }
    // On Hold / Hold → เหลือง
    if (/\b(on\s*hold|hold)\b/.test(s)) {
      return 'tw-border-[#FDE68A] tw-text-[#92400E] tw-bg-[#fde68a63]';
    }
    // Positive → เขียว (Accept / Pass / Offer / Hired)
    if (/(accept|pass|offer|offered|hired?)/.test(s)) {
      return 'tw-border-[#D3F3DF] tw-text-[#16A34A] tw-bg-[#d3f3df63]';
    }
    // Negative → แดง (Decline / Reject / Fail)
    if (/(decline|rejected?|fail|failed)/.test(s)) {
      return 'tw-border-[#FCA5A5] tw-text-[#B91C1C] tw-bg-[#fca5a563]';
    }
    // อื่น ๆ → เทา
    return 'tw-border-[#E5E7EB] tw-text-[#374151] tw-bg-[#F3F4F6]';
  }

  private buildInterviewReadonlyUI(
    stageId: number,
    selectedCategoryId?: number,
    selectedReasonIds?: number[] | null,
    selectedReasonTexts?: string[] | null
  ) {
    const packs = this.reasonsByStage.get(stageId) || [];
    const selectedCat = packs.find(c => Number(c.categoryId) === Number(selectedCategoryId));
    if (!selectedCat) return { topChoice: null, subChoice: null, reasons: [], groups: [] };

    const n = selectedCat.categoryName?.toLowerCase() || '';
    const topChoice: 'Accept' | 'Decline' | null =
      /(pass|on\s*hold)/.test(n)
        ? 'Accept'
        : /(decline|no\s*show)/.test(n)
        ? 'Decline'
        : null;

    // กรอง reason จริงเฉพาะ active + !deleted
    const ids = selectedReasonIds ?? [];
    const txt = selectedReasonTexts ?? [];
    const reasons = (selectedCat.rejectionReasons || [])
      .filter((r: any) => r.isActive && !r.isDeleted)
      .map((r: any) => ({
        reasonId: r.reasonId,
        reasonText: r.reasonText,
        checked: ids.includes(r.reasonId) || txt.includes(r.reasonText),
      }));

    // สร้าง group dynamic สำหรับทุก category ใน stage นี้
    const groups = packs.map(c => {
      const name = c.categoryName;
      const gtype = /(pass|on\s*hold)/i.test(name)
        ? 'Accept'
        : /(decline|no\s*show)/i.test(name)
        ? 'Decline'
        : 'Other';
      return {
        id: c.categoryId,
        name,
        groupType: gtype,
        isSelected: Number(c.categoryId) === Number(selectedCategoryId),
      };
    });

    return { topChoice, subChoice: selectedCat.categoryName, reasons, groups };
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
  return ['inprocess','in process','pending','scheduled','schedule','in schedule','awaiting','waiting'].includes(s);
}

function stepStatusFrom(s?: CandidateTrackStatus, fallbackDate?: string): StepStatus {
  if (!s) return has(fallbackDate) ? 'done' : 'pending';
  if (isInProcess(s.status)) return 'pending';
  return has(s.status) || has(s.date) ? 'done' : 'pending';
}

function subFrom(s?: CandidateTrackStatus, fallback = ''): string {
  return (s?.status && String(s.status)) || fallback;
}

function statusToVariant(raw?: string|null): 'green'|'blue'|'gray'|'red'|'white'|'purple'|'yellow' {
  const s = String(raw || '').trim().toLowerCase();

  if (/(didn?['’]?t|did\s*not)\s*interview.*\(pine\)/.test(s)) return 'purple';
  if (/\bno[\s-]?show\b/.test(s)) return 'purple';
  if (/(on\s*hold|hold)\b/.test(s)) return 'yellow';

  if (/\b(not\s*pass(ed)?|did\s*not\s*pass|not\s*selected|unsuccessful)\b/.test(s)) return 'red';
  if (/(decline|rejected?|fail|failed|decline offer)/.test(s)) return 'red';
  if (/(inprocess|in process|scheduled|schedule|in schedule|inprogress)/.test(s)) return 'blue';
  if (/(pending|awaiting|waiting)/.test(s)) return 'gray';
  if (/(accept|accepted|pass|passed|hired?|hire|applied|submitted|screened|offer|offered|onboarded?)/.test(s)) return 'green';
  return 'white';
}

