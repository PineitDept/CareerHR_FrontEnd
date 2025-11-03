import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApplicationService } from '../../../services/application/application.service';
import { Subject, takeUntil } from 'rxjs';

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
}

@Component({
  selector: 'app-form-apply',
  templateUrl: './form-apply.component.html',
  styleUrl: './form-apply.component.scss'
})
export class FormApplyComponent {

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
  };

  eduLevelsOrder = [
    { id: 'ES', th: 'ประถมศึกษา' },
    { id: 'MS', th: 'มัธยมศึกษาตอนต้น' },
    { id: 'HD', th: 'มัธยมศึกษาตอนปลาย / ปวช.' },
    { id: 'VC', th: 'อุดปริญญา / ปวส.' },
    { id: 'BD', th: 'ปริญญาตรี' },
  ];

  applicantDetails: any;
  applicantInfo: any;
  currentAddress: any;
  permanentAddress: any;
  familyInfo: any;
  diverInfo: any;
  generalInfo: any;
  generalInfo1: any;
  generalInfo2: any;
  generalInfo3: any;
  generalInfo4: any;
  generalInfo5: any;
  generalInfo6: any;
  jobApplications: any;
  trainingRecords: any[] = [];
  siblings: any[] = [];
  emergencyInfo: any;
  educationRecords: any[] = [];
  commentsTree: any;

  // ===== Skills =====
  skillsInfo: any;
  languageSkills: any[] = [];
  computerSkills: any[] = [];
  specialSkills: any[] = [];
  feedbackOnMyself: Array<{ questionId: number; questionName: string; answer: string }> = [];
  feedbackMap: Record<number, string[]> = {};

  // ===== Work Motivation =====
  workMotivation: any = {};
  wmMap: Record<number, string> = {};

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private applicationService: ApplicationService
  ) { }

  ngOnInit() {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applicantId = Number(params['UserID'] || 0);
        this.roundID = Number(params['Round'] || 0);
        this.fetchApplicantDetails();
        this.fetchComment();
        this.fetchFiles(Number(this.applicantId || 0));
      });
  }

  private fetchApplicantDetails() {
    if (!this.applicantId) return;

    this.applicationService.getApplicantDetailById(this.applicantId, this.roundID)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          console.log(res);
          this.applicantDetails = (res);
          this.applicantInfo = this.replaceDashWithEmpty(res.personalInfo);
          this.currentAddress = this.formatAddress(res.addressInfo?.currentAddress);
          this.permanentAddress = this.formatAddress(res.addressInfo?.permanentAddress);

          this.familyInfo = res.familyInfo;
          this.emergencyInfo = res.emergencyInfo;
          this.siblings = this.familyInfo?.siblings ?? [];

          this.educationRecords = res?.educationInfo?.educationRecords ?? [];

          // ✅ Skills
          this.skillsInfo = res?.skillsInfo ?? {};
          this.languageSkills = Array.isArray(this.skillsInfo?.languageSkills) ? this.skillsInfo.languageSkills : [];
          this.computerSkills = Array.isArray(this.skillsInfo?.computerSkills) ? this.skillsInfo.computerSkills : [];
          this.specialSkills = Array.isArray(this.skillsInfo?.specialSkills) ? this.skillsInfo.specialSkills : [];

          this.diverInfo = res.diverInfo;
          this.trainingRecords = Array.isArray(res.trainingInfo?.trainingRecords) ? res.trainingInfo.trainingRecords : [];

          this.jobApplications = res.jobApplicationInfo.jobApplications[0]

          this.generalInfo = res.generalInfo.lookupQuestions;
          this.generalInfo1 = this.generalInfo.filter((s: { questionId?: number }) => s.questionId === 2)[0].answer
          this.generalInfo2 = this.generalInfo.filter((s: { questionId?: number }) => s.questionId === 4)[0].answer
          this.generalInfo3 = this.generalInfo.filter((s: { questionId?: number }) => s.questionId === 6)[0].answer
          this.generalInfo4 = this.generalInfo.filter((s: { questionId?: number }) => s.questionId === 8)[0].answer
          this.generalInfo5 = this.generalInfo.filter((s: { questionId?: number }) => s.questionId === 10)[0].answer
          this.generalInfo6 = this.generalInfo.filter((s: { questionId?: number }) => s.questionId === 12)[0].answer

          this.feedbackOnMyself = Array.isArray(res?.feedbackOnMyself?.lookupQuestions)
            ? res.feedbackOnMyself.lookupQuestions
            : [];
          this.buildFeedbackMap(this.feedbackOnMyself);

          this.workMotivation = res?.workMotivation ?? {};
          const wmList = Array.isArray(this.workMotivation?.lookupQuestions)
            ? this.workMotivation.lookupQuestions
            : [];
          this.buildWMMap(wmList);
        },
        error: (err) => console.error(err)
      });
  }

  private fetchComment() {
    this.applicationService.getCommentsById(this.applicantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const items = Array.isArray(res?.items) ? res.items : [];
          this.commentsTree = items;
          console.log(this.commentsTree)
        },
        error: (e) => {
          console.error('[ApplicationForm] loadComments error:', e);
        }
      });
  }

  private buildFeedbackMap(list: any[]) {
    this.feedbackMap = (list ?? []).reduce((acc: Record<number, string[]>, cur: any) => {
      const id = Number(cur?.questionId);
      const ans = (cur?.answer ?? '').toString().trim();
      if (!acc[id]) acc[id] = [];
      if (ans) acc[id].push(ans);
      return acc;
    }, {});
  }

  private buildWMMap(list: any[]) {
    this.wmMap = (list ?? []).reduce((acc: Record<number, string>, cur: any) => {
      const id = Number(cur?.questionId);
      const ans = (cur?.answer ?? '').toString().trim(); // เก็บเป็น string
      if (id && ans) acc[id] = ans;
      return acc;
    }, {});
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
        },
        error: (e) => console.error('[ApplicationForm] getFileByCandidateId error:', e)
      });
  }

  // ใช้ใน template เพื่อให้ได้ array พร้อมข้อความระดับ
  get computerSkillsDisplay() {
    return (this.computerSkills ?? []).map((s) => ({
      name: (s?.skillName || '').trim(),
      levelText: (s?.skillLevelName || '').trim(),
    }));
  }

  // helpers ใช้ใน template
  getAns(id: number, index = 0): string {
    return (this.feedbackMap[id]?.[index] ?? '');
  }
  getAnsOrDash(id: number, index = 0): string {
    const t = this.getAns(id, index);
    return t ? t : '-';
  }

  private wmIndexToQid(idx: number): number | null {
    // ตามข้อมูลที่ให้มา: 1->28, 2->30, ..., 9->44 (เพิ่มทีละ 2)
    if (idx < 1 || idx > 9) return null;
    return 26 + (idx * 2); // 1=>28, 2=>30, ... 9=>44
  }

  getWMRank(idx: number): string {
    const qid = this.wmIndexToQid(idx);
    if (!qid) return '';
    return this.wmMap[qid] ?? ''; // ถ้าไม่มีคำตอบให้ว่าง
  }

  // (ถ้าอยากโชว์สรุป % ด้วยก็เตรียม helper ไว้)
  getIntrinsicPercent(): string {
    const v = Number(this.workMotivation?.intrinsic);
    return isFinite(v) ? `${v.toFixed(2)}%` : '-';
  }
  getExtrinsicPercent(): string {
    const v = Number(this.workMotivation?.extrinsic);
    return isFinite(v) ? `${v.toFixed(2)}%` : '-';
  }

  get trainingRows() {
    const rows = (this.trainingRecords ?? []).map((t) => ({
      courseName: this.clean(t?.courseName),
      institution: this.clean(t?.institution),
      duration: this.clean(t?.duration),
    }));

    // อย่างน้อย 3 แถว
    while (rows.length < 3) {
      rows.push({ courseName: '', institution: '', duration: '' });
    }
    return rows;
  }

  getFamilySummary(familyInfo: any): { male: number; female: number; myOrder: number } {
    if (!familyInfo) return { male: 0, female: 0, myOrder: 1 };

    const siblings = familyInfo.siblings ?? [];
    const myAge = this.applicantInfo.age;

    const male = siblings.filter((s: { gender?: string }) => s.gender?.toLowerCase() === 'male').length;
    const female = siblings.filter((s: { gender?: string }) => s.gender?.toLowerCase() === 'female').length;

    // รวมพี่น้อง + ตัวเราเข้า array เดียวกัน เพื่อจัดเรียงตามอายุ
    const all = [
      ...siblings.map((s: any) => ({ name: `${s.firstName} ${s.lastName}`, age: Number(s.age) || 0 })),
      { name: 'me', age: Number(myAge) || 0 }
    ];

    // เรียงอายุจากมากไปน้อย
    const sorted = all.sort((a, b) => b.age - a.age);

    // หาลำดับของเรา (index + 1)
    const myIndex = sorted.findIndex(p => p.name === 'me');
    const myOrder = myIndex >= 0 ? myIndex + 1 : sorted.length;

    return { male, female, myOrder };
  }

  get languageRows() {
    const rows = (this.languageSkills ?? []).map(l => ({
      languageName: this.clean(l?.languageName),
      speakingLevel: this.clean(l?.speakingLevel),
      readingLevel: this.clean(l?.readingLevel),
      writingLevel: this.clean(l?.writingLevel),
    }));

    while (rows.length < 3) {
      rows.push({ languageName: '', speakingLevel: '', readingLevel: '', writingLevel: '' });
    }
    return rows;
  }

  // ====== สำหรับ Computer Skills ======

  // map level (number) -> ข้อความ (ไทย/อังกฤษ ปรับได้)
  mapComputerLevel(level?: number, nameFallback?: string): string {
    // ถ้ามีชื่อระดับมาอยู่แล้ว (เช่น "Intermediate") ให้ใช้ก่อน
    if (nameFallback && nameFallback.trim()) return nameFallback;

    const n = Number(level);
    if (!isFinite(n)) return '-';

    // ตัวอย่าง mapping
    // 0: None, 1: Basic, 2: Intermediate, 3: Advanced, 4: Expert
    const map: Record<number, string> = {
      0: 'None',
      1: 'Basic',
      2: 'Intermediate',
      3: 'Advanced',
      4: 'Expert',
    };
    return map[n] ?? String(n);
  }

  // utility: ตัดแถวเป็นกลุ่มละ 3 สกิล (1 แถวมี 6 ช่อง: ชื่อ-ระดับ × 3)
  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // เตรียม rows สำหรับเรนเดอร์ในตาราง: 1 แถวมีได้สูงสุด 3 สกิล
  get computerRows(): Array<Array<{ name: string; levelText: string }>> {
    const list = (this.computerSkills ?? []).map(s => ({
      name: this.clean(s?.skillName),
      levelText: this.mapComputerLevel(s?.skillLevel, this.clean(s?.skillLevelName)),
    }));

    // อย่างน้อยให้มีอย่างน้อย 2 แถว (เผื่อเคยเผื่อหน้าแบบฟอร์มที่คาดหวังช่อง)
    while (list.length < 6) {
      list.push({ name: '', levelText: '' });
    }

    // กลุ่มละ 3 (เพื่อ 1 แถวแสดง 3 สกิล)
    const rows = this.chunk(list, 3);

    // เติมแถวสุดท้ายให้ครบ 3 ช่องเสมอ
    const last = rows[rows.length - 1];
    if (last && last.length < 3) {
      while (last.length < 3) last.push({ name: '', levelText: '' });
    }
    return rows;
  }

  // แปลงระดับให้อ่านง่าย/มี fallback (เตรียมไว้ใช้ซ้ำ)
  displayLevel(v: string | undefined | null): string {
    const t = (v || '').toString().trim();
    if (!t || t === 'None') return '-';
    return t;
  }

  formatAddress(a?: any) {
    if (!a) return '';
    const parts = [
      a.houseNo && `${a.houseNo}`,
      a.alley && a.alley !== '-' && `${a.alley}`,
      a.villageNo && a.villageNo !== '-' && `${a.villageNo}`,
      a.road && a.road !== '-' && a.road,
      a.district,
      a.amphoe && `${a.amphoe}`,
      a.province,
      a.zipcode && String(a.zipcode),
    ].filter(Boolean);
    return parts.join(', ');
  }

  private replaceDashWithEmpty(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    const cleaned: any = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'string') {
          cleaned[key] = value === '-' ? '' : value;
        } else if (typeof value === 'object' && value !== null) {
          cleaned[key] = this.replaceDashWithEmpty(value); // recursive clean
        } else {
          cleaned[key] = value;
        }
      }
    }

    return cleaned;
  }

  get siblingsPadded(): any[] {
    const rows = Array.isArray(this.siblings) ? [...this.siblings] : [];
    while (rows.length < 3) {
      rows.push({
        firstName: '', lastName: '', occupation: '', phone: '', address: null
      });
    }
    return rows;
  }

  getEduById(id: string) {
    return this.educationRecords.find(r => r?.idLevel === id) ?? {};
  }

  // ล้าง string ทั่วไป
  clean(v: any): string {
    if (v === null || v === undefined) return '';
    const s = String(v).trim();
    return (s === '-' || s === '0' || s === '') ? '' : s;
  }

  // ✅ แสดงโรงเรียน/มหาลัย (ระดับล่างใช้ school, ระดับปริญญาใช้ universityName ถ้ามี)
  getSchoolText(row: any): string {
    // ถ้าเป็นปริญญาตรีขึ้นไป ใช้ universityName เป็นหลัก (ถ้าไม่มีค่อย fallback school)
    if (row?.idLevel === 'BD' || row?.degree >= 4) {
      return this.clean(row?.universityName) || this.clean(row?.school);
    }
    return this.clean(row?.school) || this.clean(row?.universityName);
  }

  // ✅ วิชาเอก/สาขา => แสดง major / faculty (ถ้าใดใดว่างก็ข้าม)
  getMajorFaculty(row: any): string {
    const major = this.clean(row?.major);
    const faculty = this.clean(row?.faculty);
    if (major && faculty) return `${major} / ${faculty}`;
    return major || faculty || '';
  }

  // ✅ GPA: ถ้า 0 หรือค่าว่างให้เป็น '-'
  formatGpa(gpa: any): string {
    const n = Number(gpa);
    if (!isFinite(n) || n === 0) return '-';
    return String(n);
  }

  // ✅ ปีที่จบ: ถ้า 0 หรือว่างให้เป็น '-'
  formatYear(y: any): string {
    const n = Number(y);
    if (!isFinite(n) || n === 0) return '-';
    return String(n);
  }

  formatDateToDDMMYY(dateString: string): string {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}/${month}/${year}`;
  }

  // ===== Work History helpers =====
  get workRows(): any[] {
    const info = this.applicantDetails?.workHistoryInfo;
    const emptyRow = { company: '', position: '', salary: null, reasonForLeaving: '', workStart: '', workEnd: '', workDurationMonths: null, currentJob: 0 };

    // ไม่มีข้อมูลเลย -> คืน 3 แถวว่าง
    if (!info) return [emptyRow, emptyRow, emptyRow];

    // ไม่มีประสบการณ์ (2) -> คืน 3 แถวว่าง
    if (Number(info.haveWorkExperience) === 2) {
      return [emptyRow, emptyRow, emptyRow];
    }

    const records = Array.isArray(info.workRecords) ? info.workRecords : [];
    const rows = records.map((r: { company: any; position: any; salary: any; reasonForLeaving: any; workStart: any; workEnd: any; workDurationMonths: any; currentJob: any; }) => ({
      company: this.clean(r?.company),
      position: this.clean(r?.position),
      salary: r?.salary ?? null,
      reasonForLeaving: this.clean(r?.reasonForLeaving),
      workStart: r?.workStart || '',
      workEnd: r?.workEnd || '',
      workDurationMonths: (typeof r?.workDurationMonths === 'number') ? r.workDurationMonths : null,
      currentJob: Number(r?.currentJob) || 0,
    }));

    // อย่างน้อย 3 แถว
    while (rows.length < 3) rows.push({ ...emptyRow });

    return rows;
  }
  // ===== skills helpers =====
  get skills(): any[] {
    const info = this.applicantDetails?.skillsInfo;
    const emptyRow = { company: '', position: '', salary: null, reasonForLeaving: '', workStart: '', workEnd: '', workDurationMonths: null, currentJob: 0 };

    // ไม่มีข้อมูลเลย -> คืน 3 แถวว่าง
    if (!info) return [emptyRow, emptyRow, emptyRow];

    // ไม่มีประสบการณ์ (2) -> คืน 3 แถวว่าง
    if (Number(info.haveWorkExperience) === 2) {
      return [emptyRow, emptyRow, emptyRow];
    }

    const records = Array.isArray(info.workRecords) ? info.workRecords : [];
    const rows = records.map((r: { company: any; position: any; salary: any; reasonForLeaving: any; workStart: any; workEnd: any; workDurationMonths: any; currentJob: any; }) => ({
      company: this.clean(r?.company),
      position: this.clean(r?.position),
      salary: r?.salary ?? null,
      reasonForLeaving: this.clean(r?.reasonForLeaving),
      workStart: r?.workStart || '',
      workEnd: r?.workEnd || '',
      workDurationMonths: (typeof r?.workDurationMonths === 'number') ? r.workDurationMonths : null,
      currentJob: Number(r?.currentJob) || 0,
    }));

    // อย่างน้อย 3 แถว
    while (rows.length < 3) rows.push({ ...emptyRow });

    return rows;
  }

  private toDDMMYYYY(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private formatDurationFromMonths(months: number | null | undefined): string {
    if (months == null || !isFinite(Number(months))) return '';
    const y = Math.floor(Number(months) / 12);
    const m = Number(months) % 12;
    if (y > 0 && m > 0) return `${y} ปี ${m} เดือน`;
    if (y > 0) return `${y} ปี`;
    if (m > 0) return `${m} เดือน`;
    return '';
  }

  formatMoney(n: number | null | undefined): string {
    if (n == null || !isFinite(Number(n))) return '';
    return Number(n).toLocaleString('th-TH');
  }

  getWorkPeriodText(row: any): string {
    const start = this.toDDMMYYYY(row?.workStart);
    const isCurrent = Number(row?.currentJob) === 1 || Number(row?.currentJob) === 2; // มีบางระบบให้ 1=ปัจจุบัน หรือ 2=ปัจจุบัน
    const end = isCurrent ? 'ปัจจุบัน' : this.toDDMMYYYY(row?.workEnd);
    const duration = this.formatDurationFromMonths(row?.workDurationMonths);
    if (start || end) {
      return duration ? `${start} - ${end}\n(${duration})` : `${start} - ${end}`;
    }
    return '';
  }
}
