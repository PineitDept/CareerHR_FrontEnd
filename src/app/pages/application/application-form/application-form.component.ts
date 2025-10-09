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
  reasons: string[]; // list ของ key
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

type Variant = 'green' | 'blue' | 'gray' | 'red' | 'white' | 'purple';
interface StepperItem {
  label: string;
  sub?: string;
  date?: string;
  variant?: Variant;
}

// ===== Stage History (view) =====
type CategoryOption = { categoryId: number; categoryName: string };
type ReasonOption   = { reasonId: number; reasonText: string; checked?: boolean };

interface StageSection {
  historyId: number;
  stageId: number;
  stageName: string;
  stageNameNormalized: string;  // lower-cased
  headerTitle: string;

  hrUserName: string;
  stageDate: string | Date;

  categories: CategoryOption[];
  selectedCategoryId?: number;

  reasons: ReasonOption[];

  notes?: string | null;      // Screened/Offered
  strength?: string | null;   // Interview 1/2
  concern?: string | null;    // Interview 1/2

  isSummary?: boolean;        // << สำคัญสำหรับแยกแสดง
  open: boolean;
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
  filterButtons: { label: string; key: string; color: string }[] = [];
  disabledKeys: string[] = [];

  // ====== Routing ======
  applicantId: number = 0;

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

  screeningReasonOptions: { key: string; label: string }[] = [
    { key: 'cant-contact', label: 'ติดต่อไม่ได้/ปิดเครื่อง/ไม่รับสาย' },
    { key: 'education-mismatch', label: 'ศึกษาไม่ตรงสายที่รับสมัคร' },
    { key: 'education-wrong', label: 'ข้อมูลประวัติการศึกษาไม่ถูกต้อง' },
    { key: 'work-wrong', label: 'ข้อมูลประวัติการทำงานไม่ถูกต้อง' },
  ];

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

  // ===== Comments state =====
  commentsLoading = false;
  commentsTree: ViewComment[] = [];
  commentCtrl!: FormControl<string>;

  screeningCardBg: string = '#6C757D';
  private hasScreenedPending = false;

  // ===== Non-summary reviews for Interview 1 & 2 =====
  interview1NonSummary: any[] = [];
  interview2NonSummary: any[] = [];

  // Slide configs
  slideConfigI1: any = {
    slidesToShow: 2, slidesToScroll: 1, dots: false, arrows: false, infinite: false,
    responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: false } }]
  };
  slideConfigI2: any = {
    slidesToShow: 2, slidesToScroll: 1, dots: false, arrows: false, infinite: false,
    responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: false } }]
  };

  // overflow/expand helpers
  @ViewChildren('i1StrengthText') i1StrengthTexts!: QueryList<ElementRef>;
  @ViewChildren('i1ConcernText')  i1ConcernTexts!: QueryList<ElementRef>;
  @ViewChildren('i2StrengthText') i2StrengthTexts!: QueryList<ElementRef>;
  @ViewChildren('i2ConcernText')  i2ConcernTexts!: QueryList<ElementRef>;
  @ViewChildren(SlickItemDirective) slickItems!: QueryList<SlickItemDirective>;
  @ViewChildren('i1Carousel') i1Carousels!: QueryList<SlickCarouselComponent>;
  @ViewChildren('i2Carousel') i2Carousels!: QueryList<SlickCarouselComponent>;

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

    this.formDetails = this.fb.group({});
    this.commentCtrl = this.fb.control<string>('', { nonNullable: true });

    this.filterButtons = [{ label: 'Print', key: 'print', color: '#0055FF' }];

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applicantId = Number(params['id'] || 0);
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

          const exact =
            items.find((i) => Number(i.userID) === this.applicantId) ||
            items[0];

          this.mapTrackingToView(exact);
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
    // Header
    this.applicant = {
      id: String(ct.userID ?? ''),
      name: ct.fullName || ct.fullNameTH || '—',
      gpa: Number(ct.gpa ?? 0),
      university: ct.university || '—',
      appliedDate: ct.submitDate || '',
      email: ct.email || '—',
      positions: Array.from(
        new Set((ct.positions ?? [])
          .map((p) => p?.namePosition)
          .filter((n): n is string => !!n))
      ),
      grade: ct.gradeCandidate || '—',
      views: Number(ct.countLike ?? 0),
      avatarUrl: '',
      faculty: ct.faculty,
      program: ct.major,
      phone: ct.phoneNumber,
    };

    this.applicationFormSubmittedDate = ct.submitDate || '';

    // Screening card (Pending -> black)
    this.screening.screenedBy = '—';
    this.screening.screeningDate = '';
    this.screening.status = null;
    this.screeningCardBg = '#6C757D';

    this.hasScreenedPending = String(ct?.screened?.status || '').trim().toLowerCase() === 'pending';
    if (this.hasScreenedPending) {
      this.screeningCardBg = '#000000';
      this.screening.status = 'Pending';
    }

    // Steps / Pipeline
    const stepsRaw: Array<{ label: string; date?: string; status: StepStatus; sub?: string; }> = [
      {
        label: 'Applied',
        date: formatDay(ct.applied?.date ?? ct.submitDate),
        status: stepStatusFrom(ct.applied, ct.submitDate),
        sub: subFrom(ct.applied, 'Submitted'),
      },
      {
        label: 'Screened',
        date: formatDay(ct.screened?.date ?? ct.lastUpdate),
        status: stepStatusFrom(ct.screened),
        sub: subFrom(ct.screened, 'Screened'),
      },
      {
        label: 'Interview 1',
        date: formatDay(ct.interview1?.date),
        status: stepStatusFrom(ct.interview1),
        sub: subFrom(ct.interview1),
      },
      {
        label: 'Interview 2',
        date: formatDay(ct.interview2?.date),
        status: stepStatusFrom(ct.interview2),
        sub: subFrom(ct.interview2),
      },
      {
        label: 'Offered',
        date: formatDay(ct.offer?.date),
        status: stepStatusFrom(ct.offer),
        sub: subFrom(ct.offer),
      },
      {
        label: 'Hired',
        date: formatDay(ct.hired?.date),
        status: stepStatusFrom(ct.hired),
        sub: subFrom(ct.hired),
      },
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
    this.disabledStepLabels = this.steps
      .map((s, i) => (i > this.currentIndex + 1 ? s.label : ''))
      .filter(Boolean);

    // Load detail sections
    this.fetchAssessmentAndWarnings(Number(this.applicant.id || 0));
    this.fetchStageHistoryAndReasons(Number(this.applicant.id || 0));

    // Comments
    this.loadComments(Number(this.applicant.id || 0));

    // Interest
    this.fetchInterest(Number(this.applicant.id || 0));

    // Attachments
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
      .getApplicationAssessmentAndCandidateWarning(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.mapAssessmentFromApi(res),
        error: (err) => console.error('[ApplicationForm] assessment error:', err),
      });
  }

  private mapAssessmentFromApi(payload: any) {
    // Assessment
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
        label: recommend,
        class: passRatio >= 0.5
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
                       : has(it?.columnValue)      ? String(it.columnValue)      : '—';
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
    console.log(this.warningRows, '=>this.warningRows')
  }

  private fetchStageHistoryAndReasons(appId: number) {
    this.applicationService.getCandidateStageHistoryById(appId)
      .pipe(
        switchMap((histories: any[]) => {
          const uniqStageIds = Array.from(new Set(histories.map(h => Number(h.stageId))));
          const reasonsReq = uniqStageIds.map(id =>
            this.reasonService.getRecruitmentStagesWithReasons(id).pipe(
              map((cats: any[]) => ({ stageId: id, cats }))
            )
          );
          return forkJoin(reasonsReq).pipe(map(reasonsPacks => ({ histories, reasonsPacks })));
        })
      )
      .subscribe({
        next: ({ histories, reasonsPacks }) => {
          const packByStage = new Map<number, any[]>(reasonsPacks.map(p => [p.stageId, p.cats]));

          const orderWeight: Record<string, number> = {
            screened: 1,
            'interview 1': 2,
            'interview 2': 3,
            offered: 4,
          };

          // ===== Non-Summary Reviews (Interview 1/2) =====
          const i1 = (histories || []).filter(h =>
            String(h.stageName || '').trim().toLowerCase() === 'interview 1' && !h.isSummary
          );
          const i2 = (histories || []).filter(h =>
            String(h.stageName || '').trim().toLowerCase() === 'interview 2' && !h.isSummary
          );

          const enrich = (arr: any[]) => arr.map(it => ({
            ...it,
            expandState: { strength: false, concern: false },
            overflowState: { strength: false, concern: false },
          }));

          this.interview1NonSummary = enrich(i1);
          this.interview2NonSummary = enrich(i2);

          // ปรับ dots/slidesToShow ตามจำนวน
          const tuneConfig = (len: number) => ({
            slidesToShow: len === 1 ? 1 : 2,
            dots: len > 2,
          });

          setTimeout(() => {
            this.slideConfigI1 = {
              ...this.slideConfigI1,
              ...tuneConfig(this.interview1NonSummary.length),
              responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: this.interview1NonSummary.length > 1 } }]
            };
            this.slideConfigI2 = {
              ...this.slideConfigI2,
              ...tuneConfig(this.interview2NonSummary.length),
              responsive: [{ breakpoint: 768, settings: { slidesToShow: 1, dots: this.interview2NonSummary.length > 1 } }]
            };

            setTimeout(() => {
              this.i1Carousels?.forEach(c => { try { c.unslick(); c.initSlick(); } catch {} });
              this.i2Carousels?.forEach(c => { try { c.unslick(); c.initSlick(); } catch {} });
            }, 0);

            setTimeout(() => this.checkAllOverflowNonSummary(), 0);
          }, 0);

          // ===== Stage Sections (summary + เดิม) =====
          this.stageSections = histories.map((h): StageSection => {
            const stageId = Number(h.stageId);
            const stageName = String(h.stageName || '');
            const stageNameNorm = stageName.trim().toLowerCase();

            const headerTitle = stageNameNorm === 'screened'
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
              checked: Array.isArray(h.selectedReasonIds) ? h.selectedReasonIds.includes(r.reasonId)
                    : Array.isArray(h.selectedReasonTexts) ? h.selectedReasonTexts.includes(r.reasonText) : false
            }));

            const notes = h.notes ?? null;

            return {
              historyId: Number(h.historyId),
              stageId,
              stageName,
              stageNameNormalized: stageNameNorm,
              headerTitle,
              hrUserName: h.hrUserName || '—',
              stageDate: h.stageDate || '',
              categories: cats,
              selectedCategoryId,
              reasons: allReasons,
              notes,
              strength: h.strength ?? null,
              concern:  h.concern ?? null,
              isSummary: h.isSummary,     // << เก็บ flag ไว้ให้ template ใช้ซ่อน non-summary
              open: true
            };
          });

          // sort ตามลำดับ stage
          this.stageSections.sort((a, b) => {
            const wa = orderWeight[a.stageNameNormalized] ?? 999;
            const wb = orderWeight[b.stageNameNormalized] ?? 999;
            if (wa !== wb) return wa - wb;

            // ภายใน stage เดียวกัน: ให้ summary มาก่อน/หลังอะไรก็ได้
            // แต่เราแสดงเฉพาะ summary ในการ์ดเดิม (*ngIf ใน template จะซ่อน non-summary)
            const da = new Date(a.stageDate || 0).getTime();
            const db = new Date(b.stageDate || 0).getTime();
            return da - db;
          });

          // ===== Screening card จาก Stage History (ถ้า tracking ไม่ pending) =====
          if (!this.hasScreenedPending) {
            const screenedList = (Array.isArray(histories) ? histories : [])
              .filter(h => String(h.stageName || '').trim().toLowerCase() === 'screened');

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
            }
          }

          // ===== Build History Log =====
          this.historyLogs = (histories || [])
            .map(h => ({
              date: h.stageDate,
              action: `${h.stageName} ${h.categoryName} by ${h.hrUserName}`
            }))
            // เรียงเก่าสุดอยู่บน: เปลี่ยนเครื่องหมายเป็น (b - a) หากอยากใหม่ก่อน
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        },
        error: (e) => console.error('[ApplicationForm] stage history error:', e)
      });
  }

  // ===================== UI Events =====================
  onFilterButtonClick(key: string) {
    if (key === 'print') this.onPrintClicked();
  }

  private buildPrintUrl(userId: number, round = 1): string {
    const base = 'https://career.pinepacific.com/WebFormApply/WebFormApply.aspx';
    const qs = new URLSearchParams({
      UserID: String(userId),
      Round: String(round),
    });
    return `${base}?${qs.toString()}`;
  }

  onPrintClicked() {
    // กันเคสไม่มี applicantId
    if (!this.applicantId || isNaN(this.applicantId)) {
      this.notify?.error?.('Missing applicant ID. Cannot open the printable application form.');
      return;
    }

    // ถ้าระบบมี round จาก API สามารถเปลี่ยนจาก 1 เป็นค่าจริงได้
    const round = 1;
    const url = this.buildPrintUrl(this.applicantId, round);

    // เปิดแท็บใหม่แบบเชื่อถือได้กว่าการใช้ window.open
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener'; // ปลอดภัย และไม่พาแท็บเดิมไปยุ่งกับหน้าใหม่
    document.body.appendChild(a);
    a.click();
    a.remove();

  }

  onScreeningCardClick() {
    console.log('Screening card clicked');
  }

  onViewDetailClick() {
    const id = this.applicantId;
    if (!id) return;

    const flow = this.resolveCurrentFlow();
    const queryParams = { id };

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
      ui: {
        isReplying: false,
        replyText: '',
        isEditing: false,
        editText: c.commentText || '',
      }
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
        catchError((e) => {
          console.error('[ApplicationForm] current stage error:', e);
          return of('Application');
        }),
        switchMap((typeName: string) => {
          const body = {
            candidateId: this.applicantId,
            commentText: text,
            commentType: typeName,
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

  toggleReply(c: ViewComment) {
    c.ui.isReplying = !c.ui.isReplying;
    if (c.ui.isReplying) c.ui.replyText = '';
  }

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
        next: () => {
          c.ui.isEditing = false;
          this.loadComments(this.applicantId);
        },
        error: (e) => console.error('[ApplicationForm] edit comment error:', e)
      });
  }

  private openAlert(data: AlertDialogData) {
    return this.dialog
      .open(AlertDialogComponent, {
        data,
        width: '480px',
        disableClose: true,
        panelClass: ['pp-rounded-dialog'],
      })
      .afterClosed();
  }

  onDeleteComment(c: ViewComment) {
    if (!c.canDelete) return;

    this.openAlert({
      title: 'Delete this comment?',
      message: 'Do you want to delete this comment?',
      confirm: true,
    }).subscribe((res) => {
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
      if (Array.isArray(c.replies) && c.replies.length) {
        sum += this.countAllComments(c.replies);
      }
    }
    return sum;
  }

  slugify(str: string): string {
    return (str || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
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
    const key   = this.slugify(label); // applied, screened, interview-1, interview-2, offered, hired

    // เฉพาะ Interview 1/2: นำทางเมื่อผลเป็น Pass/Fail เท่านั้น
    if (key === 'interview-1' || key === 'interview-2') {
      const sub = String(item?.sub || '').toLowerCase();
      const isFinal = /(pass|passed|fail|failed)/.test(sub);

      if (!this.applicantId) return;
      if (!isFinal) return; // ยังไม่ Final → ไม่ต้อง navigate

      const interview = key === 'interview-1' ? 1 : 2;

      // ไม่เปลี่ยน activeIndex (คงพฤติกรรมเดิม)
      this.router.navigate(
        ['/interview-scheduling/interview-form/result'],
        { queryParams: { id: this.applicantId, interview } }
      );
      return;
    }

    // สเต็ปอื่น ๆ = พฤติกรรมเดิม (scroll ไป section)
    this.activeStepIndex = index;

    let targetId: string | null = null;

    switch (key) {
      case 'applied':
        targetId = 'section-applied';
        break;
      case 'screened':
        targetId = this.firstStageId('screened');
        break;
      // case 'interview-1':
      //   targetId = this.firstStageId('interview-1');
      //   break;
      // case 'interview-2':
      //   targetId = this.firstStageId('interview-2');
      //   break;
      case 'offered':
        targetId = this.firstStageId('offered');
        break;
      case 'hired':
        // ตาม requirement ให้ไป Offered อันแรก
        targetId = this.firstStageId('hired');
        break;
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

  // ===== สีป้าย Result ใน Stage History (Summary Card) =====
  getCategoryBtnClass(c: CategoryOption, selectedId?: number) {
    const isActive = c.categoryId === selectedId;
    const name = (c.categoryName || '').toLowerCase();

    // จัดลำดับความสำคัญ: “ปฏิเสธ” ก่อน “รอ/hold/อื่นๆ” ก่อน “บวก”
    const isDecline = /(decline|rejected?|fail|failed)/.test(name); // ครอบคลุม 'decline offer' ด้วย
    const isHold    = /(on hold|hold)/.test(name);
    const isNoShow  = /no-?show/.test(name);
    const isPositive = /(accept|offer|offered|onboarded?|hired?|hire)/.test(name);

    let tone: string;
    if (isDecline) {
      tone = 'tw-bg-red-500 tw-text-white tw-border-red-600';
    } else if (isHold) {
      tone = 'tw-bg-amber-500 tw-text-white tw-border-amber-600';
    } else if (isNoShow) {
      tone = 'tw-bg-gray-200 tw-text-gray-800 tw-border-gray-300';
    } else if (isPositive) {
      tone = 'tw-bg-green-500 tw-text-white tw-border-green-600';
    } else {
      tone = 'tw-bg-white tw-text-gray-700 tw-border-gray-300';
    }

    const inactive = 'hover:tw-brightness-105';
    const activeRing = 'tw-ring-2 tw-ring-white/40';
    return isActive ? `${tone} ${activeRing}` : `${tone.includes('tw-bg-white') ? tone : 'tw-bg-white tw-text-gray-700 tw-border-gray-300'} ${inactive}`;
  }

  private stageLabel(which: 'i1'|'i2'): string {
    return which === 'i1' ? 'interview 1' : 'interview 2';
  }

  hasStageSummary(which: 'i1'|'i2'): boolean {
    const label = this.stageLabel(which);
    return this.stageSections.some(s => s.stageNameNormalized === label && s.isSummary !== false);
  }

  firstIndexOfStage(which: 'i1'|'i2'): number {
    const label = this.stageLabel(which);
    return this.stageSections.findIndex(s => s.stageNameNormalized === label);
  }

  /** ควรแทรกคารูเซลของ i1/i2 ที่ตำแหน่งของ s,idx นี้หรือไม่ */
  shouldInsertNonSummary(which: 'i1'|'i2', s: StageSection, idx: number): boolean {
    const label = this.stageLabel(which);
    if (s.stageNameNormalized !== label) return false;

    const hasSummary = this.hasStageSummary(which);
    if (hasSummary) {
      // ถ้ามี summary ให้แทรก "ก่อนการ์ดสรุป" → แปลว่า s ต้องเป็น summary
      return s.isSummary !== false;
    } else {
      // ถ้าไม่มี summary เลย ให้แทรกก่อน occurrence แรกของ stage นี้
      return idx === this.firstIndexOfStage(which);
    }
  }

  openAttachment(att: Attachment) {
    // ถ้า backend คืนเป็น URL ให้เปิดแท็บใหม่
    if (att?.file) {
      window.open(att.file, '_blank');
    }
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

          // 2) Transcripts จาก fileType = 'Transcript'
          this.transcripts = files
            .filter(f => String(f?.fileType).toLowerCase() === 'transcript')
            .map(f => ({ name: f.fileName, file: f.filePath } as Attachment));

          // 3) Certifications จาก fileType = 'Certification'
          this.certifications = files
            .filter(f => String(f?.fileType).toLowerCase() === 'certification')
            .map(f => ({ name: f.fileName, file: f.filePath } as Attachment));
        },
        error: (e) => {
          console.error('[ApplicationForm] getFileByCandidateId error:', e);
          // ไม่เปลี่ยน state ถ้า error
        }
      });
  }

  private resolveCurrentFlow():
    'all-applications' | 'screening' | 'tracking' {
    const url = this.router.url || '';
    if (url.includes('/all-applications/')) return 'all-applications';
    if (url.includes('/screening/'))        return 'screening';
    if (url.includes('/tracking/'))         return 'tracking';

    // เผื่อกรณี URL แปลก ๆ ล้มกลับไปที่ screening
    return 'screening';
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
function statusToVariant(raw?: string|null): 'green'|'blue'|'gray'|'red'|'white'|'purple' {
  const s = String(raw || '').trim().toLowerCase();

  // 1) เคสพิเศษ PINE
  if (/(didn?['’]?t|did\s*not)\s*interview.*\(pine\)/.test(s)) return 'purple';

  // 2) เคส "Not Pass" และคำใกล้เคียง → ต้องมาก่อน rule "pass"
  if (/\b(not\s*pass(ed)?|did\s*not\s*pass|not\s*selected|unsuccessful)\b/.test(s)) return 'red';

  // 3) เคสลบอื่น ๆ
  if (/(decline|rejected?|fail|failed|decline offer)/.test(s)) return 'red';

  // 4) ระหว่างดำเนินการ
  if (/(inprocess|in process|scheduled|schedule|in schedule|inprogress)/.test(s)) return 'blue';

  // 5) รอผล
  if (/(pending|awaiting|waiting)/.test(s)) return 'gray';

  // 6) เคสบวก
  if (/(accept|accepted|pass|passed|hired?|hire|applied|submitted|screened|offer|offered|onboarded?)/.test(s)) return 'green';

  return 'white';
}

