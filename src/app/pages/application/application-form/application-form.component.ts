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

  // UI: ขนาดรอยบั้งของ chevron (ไม่ใช้แล้ว แต่คงไว้หากต้องกลับไปใช้ pipeline เดิม)
  chevW = 28;

  // ====== Stepper bindings ======
  stepperItems: StepperItem[] = [];
  activeStepIndex = 0;
  disabledStepLabels: string[] = [];

  // Loading/State
  isLoading = false;
  isNotFound = false;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private applicationService: ApplicationService
  ) {}

  // ===================== Lifecycle =====================
  ngOnInit() {
    this.filterButtons = [{ label: 'Print', key: 'print', color: '#0055FF' }];
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applicantId = Number(params['id'] || 0);
        this.fetchCandidateTracking();
      });
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
        search: String(this.applicantId), // ใช้ applicantId เป็น search filter ตามโจทย์
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

          // * ถ้า API อาจคืนมาหลายคน ให้เลือกตัวที่ userID ตรงที่สุดก่อน
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

    // ----- Steps / Pipeline (ข้อมูลต้นทาง) -----
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

    // index สุดท้ายที่เป็น done
    const lastDoneIndex = stepsRaw.map((s) => s.status).lastIndexOf('done');

    this.steps = stepsRaw;
    this.currentIndex = lastDoneIndex;

    // ===== Map -> StepperComponent (เวอร์ชันมี sub/date/variant) =====
    this.stepperItems = this.steps.map((s) => ({
      label: s.label,
      sub: s.sub || (s.status === 'done' ? 'Accept' : ''),
      date: s.date || '',
      variant: statusToVariant(s.sub), // ใช้ฟังก์ชันเดิมของไฟล์นี้
    }));

    // active = ขั้นล่าสุดที่ "done" ถ้ายังไม่มี done ให้ชี้สเต็ปแรก
    this.activeStepIndex = this.currentIndex >= 0 ? this.currentIndex : 0;

    // disable: คลิกได้สูงสุดถึง "ถัดจาก currentIndex" (i <= currentIndex + 1)
    this.disabledStepLabels = this.steps
      .map((s, i) => (i > this.currentIndex + 1 ? s.label : ''))
      .filter(Boolean);

    // ----- Assessments (ตัวอย่าง) -----
    this.assessments = [
      {
        no: 1,
        review: 'University Education',
        result: this.applicant.university,
        score: this.applicant.university ? 1 : 0,
        visibility: true,
        details: this.applicant.university ? 'ผ่านเกณฑ์' : '—',
        detailsPositive: Boolean(this.applicant.university),
      },
      {
        no: 2,
        review: 'Graduation GPA',
        result: String(this.applicant.gpa ?? ''),
        score: this.applicant.gpa >= 3.2 ? 1 : this.applicant.gpa > 0 ? 0.5 : 0,
        visibility: true,
        details:
          this.applicant.gpa >= 3.2
            ? 'เกิน 3.20'
            : this.applicant.gpa > 0
            ? 'ต่ำกว่า 3.20'
            : '—',
        detailsPositive: this.applicant.gpa >= 3.2,
      },
      {
        no: 3,
        review: 'EQ Test Result',
        result: '—',
        score: 0,
        visibility: true,
        details: '—',
      },
      {
        no: 4,
        review: 'Ethics Test Result',
        result: '—',
        score: 0,
        visibility: true,
        details: '—',
      },
    ];
    this.recomputeAssessmentTotals();

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

    // ----- Screening Card -----
    this.screening = {
      screenedBy: '—',
      screeningDate: (ct.screened?.date ||
        ct.lastUpdate ||
        ct.submitDate ||
        '') as string,
      status: 'Accept',
      reasons: [],
      description: '',
    };

    // ----- Attachments / Comments / Logs -----
    this.comments = [];
    this.currentUserName = '';
    this.transcripts = [];
    this.certifications = [];
    this.historyLogs = [];
  }

  private recomputeAssessmentTotals() {
    this.assessmentTotalScore = this.assessments.reduce(
      (s, it) => s + (Number(it.score) || 0),
      0
    );
    this.assessmentMaxScore = 4;
    this.assessmentRecommendation =
      this.assessmentTotalScore >= 3 ? 'Recommend for Acceptance' : '—';
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
    // อัปเดต active เฉพาะใน UI
    // ถ้าต้องโหลดข้อมูลของสเต็ปนั้นเพิ่ม สามารถใส่ logic เพิ่มได้ที่นี่
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
    /(accept|accepted|pass|passed|hired|applied|submitted|screened|offer|offered)/.test(
      s
    )
  )
    return 'green';
  return 'white';
}
