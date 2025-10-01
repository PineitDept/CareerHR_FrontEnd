import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
dayjs.extend(utc);

// ====== Types สำหรับฝั่ง View ======
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

// ===== Stage History (view) =====
type CategoryOption = { categoryId: number; categoryName: string };
type ReasonOption   = { reasonId: number; reasonText: string; checked?: boolean };

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

  steps: { label: string; date?: string; status: StepStatus; sub?: string }[] =
    [];
  currentIndex = -1; // ไม่มีขั้นไหนเสร็จ = -1

  // (ไม่ใช้ mock assessments เดิมแล้ว จะ map จาก API แทน)
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

  // UI: ขนาดรอยบั้งของ chevron (สำหรับ pipeline เดิม)
  chevW = 28;

  // ====== Stepper bindings ======
  stepperItems: StepperItem[] = [];
  activeStepIndex = 0;
  disabledStepLabels: string[] = [];

  // Loading/State
  isLoading = false;
  isNotFound = false;

  // ====== Assessment UI/Form ======
  formDetails!: FormGroup;
  isRevOpen = true; // ปุ่ม chevron พับ/กาง
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

  screeningCardBg: string = '#6C757D'; // สีพื้นฐานตอนยังไม่รู้ผล
  private hasScreenedPending = false;   // จาก getTrackingApplications

  constructor(
    private route: ActivatedRoute,
    private applicationService: ApplicationService,
    private fb: FormBuilder,
    private reasonService: ReasonService,
    private dialog: MatDialog,
  ) {}

  // ===================== Lifecycle =====================
  ngOnInit() {
    // ฟอร์มเปล่าหุ้มการ์ดตาราง (ตามโครง ScoreDetails)
    this.formDetails = this.fb.group({});
    this.commentCtrl = this.fb.control<string>('', { nonNullable: true });

    this.filterButtons = [{ label: 'Print', key: 'print', color: '#0055FF' }];
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applicantId = Number(params['id'] || 0);
        this.fetchCandidateTracking();
      });

    // ตารางคะแนน (Assessment)
    this.initAssessmentColumns();
    // ตาราง Warning
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
        search: String(this.applicantId), // ใช้ applicantId เป็น search filter
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
          console.error(
            '[ApplicationForm] getTrackingApplications error:',
            err
          );
          this.isNotFound = true;
          this.isLoading = false;
        },
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
    };

    this.applicationFormSubmittedDate = ct.submitDate || '';

    // reset ค่าเริ่มต้นของการ์ด Screening ทุกครั้ง
    this.screening.screenedBy = '—';
    this.screening.screeningDate = '';
    this.screening.status = null;
    this.screeningCardBg = '#6C757D'; // สีกลาง

    // ----- Screening card color by tracking (Pending -> ดำ) -----
    this.hasScreenedPending = String(ct?.screened?.status || '').trim().toLowerCase() === 'pending';
    if (this.hasScreenedPending) {
      this.screeningCardBg = '#000000';
      this.screening.status = 'Pending';
    }

    // ----- Steps / Pipeline -----
    const stepsRaw: Array<{
      label: string;
      date?: string;
      status: StepStatus;
      sub?: string;
    }> = [
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

    // ===== Map -> StepperComponent =====
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

    // ----- โหลด Assessment/Warning/StageHistory -----
    this.fetchAssessmentAndWarnings(Number(this.applicant.id || 0));
    this.fetchStageHistoryAndReasons(Number(this.applicant.id || 0));

    // ----- โหลด Comments -----
    this.loadComments(Number(this.applicant.id || 0));
  }

  // ===================== Assessment Columns =====================
  private initAssessmentColumns() {
    this.assessmentColumns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Application Review', field: 'review', type: 'text', minWidth: '220px' },
      { header: 'Result', field: 'result', type: 'text', minWidth: '140px' },
      { header: 'Score', field: 'score', type: 'number', align: 'center', width: '90px', minWidth: '90px', maxWidth: '100px' },
      { header: 'Visibility', field: 'visibility', type: 'icon', align: 'center', width: '110px', minWidth: '110px' },
      {
        header: 'Details',
        field: 'details',
        type: 'text',              // default คือ text
        minWidth: '220px',
        typeFn: (row: AssessmentItem) => row?.isTotalRow ? 'badge' : 'text',
      },
    ];
  }

  private initWarningColumns() {
    this.warningColumns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Warning', field: 'warning', type: 'text', minWidth: '220px' },
      { header: 'Result', field: 'result', type: 'text', minWidth: '140px' },
      { header: 'Risk', field: 'risk', type: 'badge', align: 'center', width: '110px', minWidth: '110px' },
      { header: 'Visibility', field: 'visibility', type: 'icon', align: 'center', width: '110px', minWidth: '110px' },
      { header: 'Detail', field: 'detail', type: 'text', minWidth: '220px' },
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
    // ===== Assessment (typeCondition: 1) =====
    const groups = Array.isArray(payload?.validationGroups) ? payload.validationGroups : [];
    const assess = groups.find((g: any) => Number(g?.typeCondition) === 1);

    const rows: AssessmentItem[] = [];
    const list = Array.isArray(assess?.validationResults) ? assess.validationResults : [];

    list.forEach((it: any, idx: number) => {
      const passed = !!it?.isPassed;
      const resultText = has(it?.viewColumnResult) ? String(it.viewColumnResult) :
                         has(it?.columnValue) ? String(it.columnValue) : '—';
      const detailLabel = passed
        ? ''
        : (String(it?.errorMessage || it?.conditionName || 'Failed').trim());

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

    // ===== คำนวณ Total แบบผลรวมคะแนน =====
    const maxScore = rows.length; // คะแนนเต็ม = จำนวนเงื่อนไข (เช่น 4)
    const sumScore = rows.reduce((acc, r) => {
      const n = typeof r.score === 'number' ? r.score : Number(r.score);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);

    const passRatio = maxScore > 0 ? sumScore / maxScore : 0;
    const recommend = passRatio >= 0.5 ? 'Recommend for Acceptance' : 'Not Recommended for Acceptance';
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2))); // 1.5 ไม่ใช่ 1.50

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

    // ===== Candidate Warning (typeCondition: 2) =====
    const warn = groups.find((g: any) => Number(g?.typeCondition) === 2);
    const wlist = Array.isArray(warn?.validationResults) ? warn.validationResults : [];

    const wrows = wlist.map((it: any, idx: number) => {
      const passed = !!it?.isPassed; // ผ่าน = ไม่มีความเสี่ยง
      const riskLabel = passed ? 'Strength' : 'Weakness';

      // Result แสดง viewColumnResult ถ้ามี ไม่งั้นใช้ columnValue
      const resultText =
        has(it?.viewColumnResult) ? String(it.viewColumnResult) :
        has(it?.columnValue)      ? String(it.columnValue)      : '—';

      // Detail: ถ้าผ่าน ใส่ข้อความกลางๆ, ถ้าไม่ผ่าน ใช้ errorMessage หรือ conditionName
      const detailText = passed
        ? ''
        : (String(it?.errorMessage || it?.conditionName || 'Needs attention').trim());

      return {
        no: idx + 1,
        warning: String(it?.conditionName || '—').trim(),
        result: resultText,

        // Badge สีตามความเสี่ยง
        risk: {
          label: riskLabel,
          class: passed
            ? ['tw-bg-green-50','tw-ring-green-300','tw-text-green-700']
            : ['tw-bg-red-500','tw-text-white','tw-ring-red-600'], // โทนแดงชัดแบบในภาพ
        },

        // ไอคอนสถานะ
        visibility: {
          icon: passed ? 'check-circle' : 'xmark-circle',
          fill: passed ? 'green' : 'red',
          size: 18,
        },

        // รายละเอียด
        detail: detailText,
      };
    });

    this.warningRows = wrows;
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

          this.stageSections = histories.map((h, idx): StageSection => {
            const stageId = Number(h.stageId);
            const stageName = String(h.stageName || '');
            const stageNameNorm = stageName.trim().toLowerCase();

            // header title
            const headerTitle = stageNameNorm === 'screened'
              ? 'Application Screening'
              : `Application ${stageName}`;

            // categories (from reasons API)
            const cats = (packByStage.get(stageId) || []).map(c => ({
              categoryId: c.categoryId,
              categoryName: c.categoryName
            })) as CategoryOption[];

            // selected category
            const selectedCategoryId = Number(h.categoryId) || undefined;

            // reasons list for the selected category
            const selectedCat = (packByStage.get(stageId) || []).find(c => Number(c.categoryId) === selectedCategoryId);
            const allReasons: ReasonOption[] = (selectedCat?.rejectionReasons || []).map((r: any) => ({
              reasonId: r.reasonId,
              reasonText: r.reasonText,
              checked: Array.isArray(h.selectedReasonIds) ? h.selectedReasonIds.includes(r.reasonId) :
                      Array.isArray(h.selectedReasonTexts) ? h.selectedReasonTexts.includes(r.reasonText) : false
            }));

            // notes/strength/concern (API มีแต่ notes -> แยกไว้รองรับอนาคต)
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
              open: true
            };
          });

          this.stageSections.sort((a, b) => {
            const wa = orderWeight[a.stageNameNormalized] ?? 999;
            const wb = orderWeight[b.stageNameNormalized] ?? 999;
            return wa - wb;
          });

          // ===== Apply Screening card from Stage History (ถ้า tracking ไม่ได้ pending) =====
          if (!this.hasScreenedPending) {
            const screenedList = (Array.isArray(histories) ? histories : [])
              .filter(h => String(h.stageName || '').trim().toLowerCase() === 'screened');

            if (screenedList.length) {
              // เลือกรายการล่าสุดตาม stageDate
              const pickLatest = screenedList
                .slice()
                .sort((a, b) => new Date(b.stageDate || 0).getTime() - new Date(a.stageDate || 0).getTime())[0];

              const hrName = pickLatest?.hrUserName || '—';
              const catName = String(pickLatest?.categoryName || '');
              const status  = this.normalizeCategoryToStatus(catName); // 'Accept' | 'Decline' | 'Hold' | null
              const bg      = this.categoryToBg(catName);              // สีตาม category

              this.screening.screenedBy   = hrName;
              this.screening.screeningDate = pickLatest?.stageDate || this.screening.screeningDate || '';
              this.screening.status       = status;    // อนุญาต null ได้
              this.screeningCardBg        = bg;        // ปรับสีการ์ดตาม category
            }
          }
        },
        error: (e) => console.error('[ApplicationForm] stage history error:', e)
      });
  }

  // ===================== UI Events =====================
  onFilterButtonClick(key: string) {
    switch (key) {
      case 'print':
        this.onPrintClicked();
        break;
    }
  }

  onPrintClicked() {
    console.log('Print clicked');
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

  onScreeningCardClick() {
    console.log('Screening card clicked');
  }

  onViewDetailClick() {
    console.log('View detail clicked');
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

  getCategoryBtnClass(c: CategoryOption, selectedId?: number) {
    const isActive = c.categoryId === selectedId;

    // โทนสีโดยชื่อ category (แก้เพิ่มได้ตามระบบจริง)
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

  // ทำ string ให้เป็นรูปแบบ id ได้
  slugify(str: string): string {
    return (str || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
  }

  /** หา scroll container ที่แท้จริงของ element (ถ้าไม่เจอให้ใช้ window) */
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

  /** หา id ของ section อันแรกของ stage (ใช้ slug เท่านั้น) */
  private firstStageId(stageSlug: string): string | null {
    const idx = this.stageSections.findIndex(s => this.slugify(s.stageNameNormalized) === stageSlug);
    return idx >= 0 ? `section-${stageSlug}-${idx}` : null;
  }

  /** เลื่อนไปยัง element ตาม id (รองรับทั้ง window และ scroll container) */
  private scrollToId(id: string) {
    // เผื่อให้ DOM/render เสร็จก่อน
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
    this.activeStepIndex = index;

    const label = (this.stepperItems?.[index]?.label || '').trim();
    const key = this.slugify(label); // applied, screened, interview-1, interview-2, offered, hired
    let targetId: string | null = null;

    switch (key) {
      case 'applied':
        targetId = 'section-applied';
        break;
      case 'screened':
        targetId = this.firstStageId('screened');
        break;
      case 'interview-1':
        targetId = this.firstStageId('interview-1');
        break;
      case 'interview-2':
        targetId = this.firstStageId('interview-2');
        break;
      case 'offered':
        targetId = this.firstStageId('offered');
        break;
      case 'hired':
        // ตาม requirement ให้ไป Offered อันแรก
        targetId = this.firstStageId('offered');
        break;
    }

    if (targetId) this.scrollToId(targetId);
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

  private normalizeCategoryToStatus(cat?: string): ScreeningStatus {
    const s = String(cat || '').trim().toLowerCase();
    if (s === 'accept') return 'Accept';
    if (s === 'decline') return 'Decline';
    if (s === 'on hold' || s === 'hold') return 'On Hold';
    return null; // ไม่รู้จัก -> แสดง "—"
  }

  private categoryToBg(cat?: string): string {
    const s = String(cat || '').trim().toLowerCase();
    if (s === 'accept')  return '#005500';
    if (s === 'decline') return '#930000';
    if (s === 'on hold' || s === 'hold') return '#FFAA00';
    return '#6C757D';
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
    /(accept|accepted|pass|passed|hired|hire|applied|submitted|screened|offer|offered|onboarded|onboard)/.test(
      s
    )
  )
    return 'green';
  return 'white';
}
