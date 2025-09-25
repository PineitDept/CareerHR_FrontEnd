import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ApplicationService } from '../../../services/application/application.service';
import { CandidatePagedResult } from '../../../interfaces/Application/application.interface';
import {
  CandidateTracking,
  CandidateTrackStatus,
} from '../../../interfaces/Application/tracking.interface';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { FormBuilder, FormGroup } from '@angular/forms';
dayjs.extend(utc);

// ====== Types สำหรับฝั่ง View ======
type StepStatus = 'done' | 'pending';
type Risk = 'Normal' | 'Warning';
type ScreeningStatus = 'Accept' | 'Decline' | 'Hold';

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
    status: 'Accept',
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

  constructor(
    private route: ActivatedRoute,
    private applicationService: ApplicationService,
    private fb: FormBuilder
  ) {}

  // ===================== Lifecycle =====================
  ngOnInit() {
    // ฟอร์มเปล่าหุ้มการ์ดตาราง (ตามโครง ScoreDetails)
    this.formDetails = this.fb.group({});

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

    // ----- โหลด Assessment/Warning จาก API จริง -----
    this.fetchAssessmentAndWarnings(Number(this.applicant.id || 0));
  }

  // ===================== Assessment Columns =====================
  private initAssessmentColumns() {
    this.assessmentColumns = [
      { header: 'No', field: 'no', type: 'text', align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Application Review', field: 'review', type: 'text', minWidth: '220px' },
      { header: 'Result', field: 'result', type: 'text', minWidth: '140px' },
      { header: 'Score', field: 'score', type: 'number', align: 'center', width: '90px', minWidth: '90px', maxWidth: '100px' },
      { header: 'Visibility', field: 'visibility', type: 'icon', align: 'center', width: '110px', minWidth: '110px' },
      { header: 'Details', field: 'details', type: 'badge', minWidth: '220px' },
    ];
  }

  private initWarningColumns() {
    this.warningColumns = [
      { header: 'No',        field: 'no',       type: 'text',  align: 'center', width: '56px', minWidth: '56px' },
      { header: 'Warning',   field: 'warning',  type: 'text',  minWidth: '220px' },
      { header: 'Result',    field: 'result',   type: 'text',  minWidth: '160px' },
      { header: 'Risk',      field: 'risk',     type: 'badge', align: 'center', minWidth: '120px' },
      { header: 'Visibility',field: 'visibility', type: 'icon', align: 'center', width: '110px', minWidth: '110px' },
      { header: 'Detail',    field: 'detail',   type: 'text',  minWidth: '220px' },
    ];
  }

  // ===================== Fetch & Map Assessment =====================
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
        ? (resultText || 'Pass')
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
        details: {
          label: detailLabel,
          class: passed
            ? ['tw-bg-green-50', 'tw-ring-green-300', 'tw-text-green-700']
            : ['tw-bg-red-50', 'tw-ring-red-300', 'tw-text-red-700'],
        },
      });
    });

    // แถว Total + Recommendation
    const total = Number(assess?.summary?.totalConditions || rows.length || 0);
    const passedCnt = Number(assess?.summary?.passedConditions || 0);
    const totalScoreText = `${passedCnt}/${total || rows.length || 1}`;
    const passPct = Number(assess?.summary?.passPercentage || (total ? (passedCnt * 100) / total : 0));
    const recommend = passPct >= 50 ? 'Recommend for Acceptance' : 'Not Recommended for Acceptance';

    rows.push({
      no: '' as any,
      review: 'Total',
      result: '',
      score: totalScoreText,
      visibility: {
        icon: passPct >= 50 ? 'check-circle' : 'xmark-circle',
        fill: passPct >= 50 ? 'green' : 'red',
        size: 18,
      },
      details: {
        label: recommend,
        class: passPct >= 50
          ? ['tw-bg-green-50','tw-ring-green-300','tw-text-green-700']
          : ['tw-bg-red-50','tw-ring-red-300','tw-text-red-700'],
      },
    });

    this.assessmentRows = rows;

    // ===== Candidate Warning (typeCondition: 2) =====
    const warn = groups.find((g: any) => Number(g?.typeCondition) === 2);
    const wlist = Array.isArray(warn?.validationResults) ? warn.validationResults : [];

    const wrows = wlist.map((it: any, idx: number) => {
      const passed = !!it?.isPassed; // ผ่าน = ไม่มีความเสี่ยง
      const riskLabel = passed ? 'Normal' : 'Warning';

      // Result แสดง viewColumnResult ถ้ามี ไม่งั้นใช้ columnValue
      const resultText =
        has(it?.viewColumnResult) ? String(it.viewColumnResult) :
        has(it?.columnValue)      ? String(it.columnValue)      : '—';

      // Detail: ถ้าผ่าน ใส่ข้อความกลางๆ, ถ้าไม่ผ่าน ใช้ errorMessage หรือ conditionName
      const detailText = passed
        ? 'No issue detected'
        : (String(it?.errorMessage || it?.conditionName || 'Needs attention').trim());

      return {
        no: idx + 1,
        warning: String(it?.columnName || it?.conditionName || '—').trim(),
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

  onCommentClick() {
    console.log('Comment card clicked');
  }

  // ====== Stepper events ======
  onStepperChanged(index: number) {
    this.activeStepIndex = index;
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
    /(accept|accepted|pass|passed|hired|hire|applied|submitted|screened|offer|offered)/.test(
      s
    )
  )
    return 'green';
  return 'white';
}
