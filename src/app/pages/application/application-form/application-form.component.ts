import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

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

@Component({
  selector: 'app-application-form',
  templateUrl: './application-form.component.html',
  styleUrl: './application-form.component.scss',
})
export class ApplicationFormComponent {
  filterButtons: { label: string; key: string; color: string }[] = [];
  disabledKeys: string[] = [];

  applicantId: number = 0;

  // ====== DATA (กำหนดค่า default ให้ไม่เป็น null/undefined) ======
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
    avatarUrl: '', // ปล่อยว่างไว้ได้ ถ้าไม่มีรูป
  };

  steps: { label: string; date?: string; status: StepStatus; sub?: string }[] =
    [
      { label: 'Applied', sub: 'Accept', date: '07 Aug 2025', status: 'done' },
      { label: 'Screened', sub: 'Accept', date: '08 Aug 2025', status: 'done' },
      {
        label: 'Interview 1',
        sub: 'In Schedule',
        date: '10 Aug 2025',
        status: 'done',
      },
      { label: 'Interview 2', status: 'pending' },
      { label: 'Offered', status: 'pending' },
      { label: 'Hired', status: 'pending' },
    ];

  assessments: AssessmentItem[] = [];
  assessmentTotalScore = 0;
  assessmentMaxScore = 0;
  assessmentRecommendation = '';

  warnings: WarningItem[] = [];

  screening: Screening = {
    screenedBy: '',
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

  applicationFormSubmittedDate: string | Date = '2025-07-09';

  // เพิ่มฟิลด์ sub และ index ปัจจุบันของกระบวนการ
  currentIndex = 2; // 0-based: Applied(0), Screened(1), Interview 1(2) -> ตามรูป

  chevW = 28;

  private destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.filterButtons = [{ label: 'Print', key: 'print', color: '#0055FF' }];

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applicantId = Number(params['id'] || 0);

        console.log('Applicant ID:', this.applicantId);
      });

    this.loadDataFromService();
    this.recomputeAssessmentTotals();
  }

  

  // ====== ตัวอย่างโหลดข้อมูลจาก service/route (ใส่ของจริงแทนได้) ======
  private loadDataFromService() {
    // สมมติว่าคุณดึงมาจาก API แล้วเซ็ตค่า (ตัวอย่างข้อมูลเพื่อแสดงโครงสร้างเท่านั้น)
    this.applicant = {
      id: 'U123',
      name: 'Mr. Pisitpong Dammoneonswat',
      gpa: 3.41,
      university: 'สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง', // ✅ อัปเดต
      faculty: 'คณะวิศวกรรมศาสตร์', // ✅ เพิ่ม
      program: 'สาขาเครื่องมือวัด', // ✅ เพิ่ม
      appliedDate: '2025-07-08',
      email: 'pisitpong.mail@gmail.com',
      positions: ['Maintenance Engineer', 'Maintenance Engineer'],
      grade: 'Applicant Grade A',
      views: 440,
      avatarUrl: '', // ถ้ามี url รูปก็ใส่
      phone: '081-234-5678',
    };

    this.steps = [
      { label: 'Applied', date: '08 Jul 2025', status: 'done' },
      { label: 'Screened', date: '08 Aug 2025', status: 'done' },
      { label: 'Interview 1', date: '15 Aug 2025', status: 'done' },
      { label: 'Interview 2', status: 'pending' },
      { label: 'Offered', status: 'pending' },
      { label: 'Hired', status: 'pending' },
    ];

    this.assessments = [
      {
        no: 1,
        review: 'University Education',
        result: this.applicant.university,
        score: 1,
        visibility: true,
        details: 'ผ่านเกณฑ์',
        detailsPositive: true,
      },
      {
        no: 2,
        review: 'Graduation GPA',
        result: String(this.applicant.gpa),
        score: 1,
        visibility: true,
        details: 'เกิน 3.20',
        detailsPositive: true,
      },
      {
        no: 3,
        review: 'EQ Test Result',
        result: '85/100',
        score: 0.5,
        visibility: true,
        details: 'EQ ดี',
      },
      {
        no: 4,
        review: 'Ethics Test Result',
        result: '10/10/10',
        score: 0.5,
        visibility: true,
        details: 'เต็ม',
      },
    ];

    this.warnings = [
      {
        no: 1,
        warning: 'BMI',
        result: '21.2',
        risk: 'Normal',
        visibility: true,
        detail: 'ปกติ',
      },
      {
        no: 2,
        warning: 'Religion',
        result: 'No Religion',
        risk: 'Warning',
        visibility: true,
        detail: 'ตามสมควร',
      },
      {
        no: 3,
        warning: 'Address',
        result: 'ยะลา/เบตง',
        risk: 'Normal',
        visibility: true,
        detail: 'ใกล้เคียง',
      },
      {
        no: 4,
        warning: 'Work History',
        result: '6 Company',
        risk: 'Warning',
        visibility: true,
        detail: 'เปลี่ยนงานหลายครั้ง',
      },
      {
        no: 5,
        warning: 'Diseases',
        result: 'No',
        risk: 'Normal',
        visibility: true,
        detail: 'ไม่มีโรคประจำตัว',
      },
    ];

    this.screening = {
      screenedBy: 'Pattisara Chongsermkong',
      screeningDate: '2025-07-07',
      status: 'Accept',
      reasons: ['cant-contact'], // key จาก screeningReasonOptions
      description: 'รายละเอียดประกอบการพิจารณา…',
    };

    this.comments = [
      {
        id: 'c1',
        author: 'Wihadi Yingasif',
        date: '9 September 2025, 10:02 AM',
        text: 'Kings put on your head…',
      },
      {
        id: 'c2',
        author: 'Wihadi Yingasif',
        date: '9 September 2025, 10:07 AM',
        text: 'Kings put on your head…',
      },
    ];

    this.currentUserName = 'Wihadi Yingasif';

    this.transcripts = [
      { name: 'Official_Degree_Transcript_01.pdf', file: 'Official_P.pdf' },
      { name: 'Official_Degree_Transcript_02.pdf', file: 'Official_P.pdf' },
      { name: 'Official_Degree_Transcript_03.pdf', file: 'Official_P.pdf' },
    ];

    this.certifications = [
      { name: 'Certified_Electrician_2024.pdf', file: 'Official_P.pdf' },
      { name: 'Certified_Maintenance_2025.pdf', file: 'Official_P.pdf' },
      { name: 'Certified_Safety_2025.pdf', file: 'Official_P.pdf' },
    ];

    this.historyLogs = [
      { date: '24/09/2024 10:26', action: 'Approved: Transfer to QC, Staff' },
      { date: '31/10/2024 09:02', action: 'QC: Go to NewShop' },
    ];
  }

  private recomputeAssessmentTotals() {
    this.assessmentTotalScore = this.assessments.reduce(
      (s, it) => s + (Number(it.score) || 0),
      0
    );
    // สมมติ max = 4 (คุณจะปรับตามกติกาจริง/ค่าวิชันได้)
    this.assessmentMaxScore = 4;
    this.assessmentRecommendation =
      this.assessmentTotalScore >= 3 ? 'Recommend for Acceptance' : '—';
  }

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
    // ✅ เพิ่ม
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

  // helper: ขั้นที่ “เสร็จ/เขียว”
  isDone(i: number) {
    // ทำเขียวจนถึง currentIndex (รวม)
    return i <= this.currentIndex;
  }

  clipLastGreen(i: number, last: boolean) {
    if (!(this.isDone(i) && i === this.currentIndex) || last) return {};
    const notch = this.chevW + 2; // เดิม +1 หรือเท่ากับ chevW -> เพิ่มเป็น +2
    const poly = `polygon(0 0, calc(100% - ${notch}px) 0, 100% 50%, calc(100% - ${notch}px) 100%, 0 100%)`;
    return {
      clipPath: poly,
      WebkitClipPath: poly,
      backfaceVisibility: 'hidden',
      transform: 'translateZ(0)',
    };
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
