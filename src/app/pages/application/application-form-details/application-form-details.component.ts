import { Component } from '@angular/core';
import { NotificationService } from '../../../shared/services/notification/notification.service';
import { ActivatedRoute } from '@angular/router';
import { ApplicationService } from '../../../services/application/application.service';
import { FormBuilder, FormControl } from '@angular/forms';
import { catchError, map, of, Subject, switchMap, takeUntil } from 'rxjs';
import { Columns } from '../../../shared/interfaces/tables/column.interface';
import { SortState } from '../../../shared/components/tables/tables.component';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogData } from '../../../shared/interfaces/dialog/dialog.interface';
import { AlertDialogComponent } from '../../../shared/components/dialogs/alert-dialog/alert-dialog.component';

type ScreeningStatus = 'Accept' | 'Decline' | 'On Hold' | 'Pending' | null;

interface Screening {
  screenedBy: string;
  screeningDate: string | Date;
  status: ScreeningStatus;
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
  selector: 'app-application-form-details',
  templateUrl: './application-form-details.component.html',
  styleUrl: './application-form-details.component.scss'
})
export class ApplicationFormDetailsComponent {
  // ====== Filter ======
  filterButtons: { label: string; key: string; color: string }[] = [];
  disabledKeys: string[] = [];

  // ====== Routing ======
  applicantId: number = 0;
  roundID: number = 0;

  private destroy$ = new Subject<void>();

  private hasScreenedPending = false;
  screening: Screening = {
    screenedBy: '—',
    screeningDate: '',
    status: null,
  };
  screeningCardBg: string = '#6C757D';

  // ===== ViewModel (แสดงผลเท่านั้น) =====
  vm = {
    fullNameEn: '—',
    fullNameTh: '—',
    email: '—',
    phone: '—',
    birthDate: '—',
    ageText: '—',
    citizenId: '—',
    nationality: '—',
    ethnicity: '—',
    religion: '—',
    weightText: '—',
    heightText: '—',
    bloodGroup: '—',
    bmiText: '—',
    maritalStatus: '—',
    childrenText: '—',
    facebook: '',
    instagram: '',
    twitter: '',
    linkedin: '',
    currentAddress: '',
    permanentAddress: '',
  };

  // ===== Family =====
  familyColumns: Columns = [
    { header: 'No', field: '__index', type: 'number', width: '6%',  align: 'center', sortable: false },
    { header: 'Relationship', field: 'relationship', type: 'text',   width: '14%', minWidth: '140px', wrapText: true  },
    { header: 'Name',         field: 'name',         type: 'text',   width: '20%', minWidth: '180px', wrapText: true },
    { header: 'Occupation',   field: 'occupation',   type: 'text',   width: '14%', minWidth: '160px', wrapText: true },
    { header: 'Age',          field: 'age',          type: 'number', width: '8%',  align: 'center' },
    { header: 'Address',      field: 'address',      type: 'text',   width: '26%', minWidth: '260px', wrapText: true },
    { header: 'Phone Number', field: 'phone',        type: 'text',   width: '12%', minWidth: '160px' },
  ];
  familyRows: any[] = [];
  familySort: SortState = {};

  // ===== Education =====
  educationColumns: Columns = [
    { header: 'No',               field: '__index',        type: 'number', width: '6%',  align: 'center', sortable: false },
    { header: 'Graduation Year',  field: 'graduationYear', type: 'number', width: '14%', align: 'center' },
    { header: 'Education Level',  field: 'levelName',      type: 'text',   width: '22%', minWidth: '220px', wrapText: true },
    { header: 'Institution/Location', field: 'institution', type: 'text',  width: '26%', minWidth: '260px', wrapText: true },
    { header: 'Major/Faculty',    field: 'majorFaculty',   type: 'text',   width: '22%', minWidth: '260px', wrapText: true },
    { header: 'GPA',              field: 'gpa',            type: 'number', width: '10%', align: 'center' },
  ];
  educationRows: any[] = [];
  educationSort: SortState = {};

  // ===== toggles =====
  isGpaOpen = true;
  isWorkOpen = true;
  isLangOpen = true;
  isCompOpen = true;
  isBonusOpen = true;
  isSpecialOpen = true;
  isTrainOpen = true;
  isPersonalOpen  = true;
  isSocialOpen    = true;
  isAddressOpen   = true;
  isFamilyOpen    = true;
  isEducationOpen = true;
  isDrivingOpen   = true;
  isGeneralOpen   = true;
  isFeedbackOpen  = true;
  isMotivationOpen= true;

  // ===== GPA Analysis =====
  gpaColumns: Columns = [
    { header: 'Type',       field: 'type',       type: 'text',   width: '60%', minWidth: '180px' },
    { header: 'GPA',        field: 'gpa',        type: 'number', width: '20%', align: 'center' },
    { header: 'Visibility', field: 'visibility', type: 'icon',   width: '20%', align: 'center' },
  ];
  gpaRows: any[] = [];

  // ===== Work History =====
  workColumns: Columns = [
    { header: 'No', field: '__index',    type: 'number', width: '6%',  align: 'center', sortable: false },
    { header: 'Date (From - To)',        field: 'date',     type: 'text',   width: '16%', minWidth: '220px', wrapText: true },
    { header: 'Company Name and Address',field: 'company',  type: 'text',   width: '26%', minWidth: '260px', wrapText: true },
    { header: 'Position / Job Description', field: 'position', type: 'text', width: '18%', minWidth: '200px', wrapText: true },
    { header: 'Salary', field: 'salary', type: 'text',   width: '10%', align: 'center' },
    { header: 'Reason for Leaving',      field: 'reason',  type: 'text',   width: '24%', minWidth: '220px', wrapText: true },
  ];
  workRows: any[] = [];
  workSort: SortState = {};

  // ===== Language Skills =====
  langColumns: Columns = [
    { header: 'No',        field: 'no',       type: 'number', width: '6%',  align: 'center', sortable: false },
    { header: 'Language',  field: 'language', type: 'text',   width: '24%', minWidth: '160px', wrapText: true },
    { header: 'Speaking',  field: 'speaking', type: 'badge',  width: '18%', align: 'center' },
    { header: 'Reading',   field: 'reading',  type: 'badge',  width: '18%', align: 'center' },
    { header: 'Writing',   field: 'writing',  type: 'badge',  width: '18%', align: 'center' },
    { header: 'Score',     field: 'score',    type: 'number', width: '16%', align: 'center' },
  ];
  langRows: any[] = [];

  // ===== Computer / Bonus / Special Skills =====
  compColumns: Columns = [
    { header: 'No',          field: 'no',    type: 'number', width: '6%',  align: 'center', sortable: false },
    { header: 'Skills Type', field: 'type',  type: 'text',   width: '16%', wrapText: true },
    { header: 'Skills',      field: 'skill', type: 'text',   width: '44%', minWidth: '220px', wrapText: true },
    { header: 'Level',       field: 'level', type: 'badge',  width: '20%', align: 'center' },
    { header: 'Score',       field: 'score', type: 'number', width: '14%', align: 'center' },
  ];
  compRows: any[] = [];
  bonusRows: any[] = [];
  specialRows: any[] = [];

  // ===== Training & Certificate =====
  trainColumns: Columns = [
    { header: 'No',                 field: '__index', type: 'number', width: '6%',  align: 'center', sortable: false },
    { header: 'Course / Subject',   field: 'course',  type: 'text',   width: '42%', minWidth: '260px', wrapText: true },
    { header: 'Institution / Company', field: 'org',  type: 'text',   width: '32%', minWidth: '240px', wrapText: true },
    { header: 'Duration',           field: 'duration',type: 'text',   width: '20%', align: 'center' },
  ];
  trainRows: any[] = [];

  // ===== Driving view =====
  driving = {
    carSkill: '—',
    carLicense: '—',
    motorcycleSkill: '—',
    motorcycleLicense: '—',
  };

  // ===== General Info (view only) =====
  general = {
    workRegular: '—',
    workOccasional: '—',
    smoking: '—',
    alcohol: '—',
    disease: '—',
    legalCase: '—',
  };

  // ===== Feedback on Myself =====
  feedbackColumns: Columns = [
    { header: 'No', field: '__index', type: 'number', width: '6%',  align: 'center', sortable: false },
    { header: 'Question', field: 'question', type: 'text', width: '44%', minWidth: '320px', wrapText: true },
    { header: 'Answer',   field: 'answer',   type: 'text', width: '50%', minWidth: '320px', wrapText: true },
  ];
  feedbackRows: any[] = [];

  // ===== Work Motivation =====
  motivationColumns: Columns = [
    { header: 'Answer',   field: 'answer',   type: 'number', width: '10%', align: 'center' },
    { header: 'Question', field: 'question', type: 'text',   width: '70%', minWidth: '420px', wrapText: true },
    { header: 'Motivation Type', field: 'type', type: 'text', width: '20%', align: 'center', wrapText: true },
  ];
  motivationRows: any[] = [];
  motivationStat = { intrinsic: 0, extrinsic: 0 };

  // ===== Comments state =====
  commentsLoading = false;
  commentsTree: ViewComment[] = [];
  commentCtrl!: FormControl<string>;
  currentUserName = '';

  // ===== Emergency Contact (view only) =====
  emergency = {
    name: '—',
    relationship: '—',
    phone: '—',
    address: ''
  };

  private testInfo = {
    userID: 0,
    userNameEn: '',
    thaiName: '',
    round: 1
  };

  constructor(
    private route: ActivatedRoute,
    private applicationService: ApplicationService,
    private fb: FormBuilder,
    private notify: NotificationService,
    private dialog: MatDialog,
  ) { }

  ngOnInit() {
    this.filterButtons = [{ label: 'Print', key: 'print', color: '#0055FF' }];

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applicantId = Number(params['id'] || 0);
        this.roundID = Number(params['round'] || 0);
        this.fetchApplicantDetails();
        this.fetchCandidateTracking();

        // load comments
        if (this.applicantId) this.loadComments(this.applicantId);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private fetchApplicantDetails() {
    if (!this.applicantId) return;

    this.applicationService
      .getApplicantDetailById(this.applicantId, this.roundID)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const p = res?.personalInfo ?? {};
          const s = res?.socialInfo ?? {};
          const a = res?.addressInfo ?? {};

          // ----- Personal VM -----
          const fullEn = [p.engFirstname, p.engLastname].filter(Boolean).join(' ');
          const fullTh = [p.thaiFirstname, p.thaiLastname].filter(Boolean).join(' ');
          const age = Number(p.age ?? this.calcAge(p.birthdate));
          const bmi = this.calcBmi(Number(p.weight), Number(p.height));
          const bmiCat = this.bmiCategoryAsian(bmi);

          this.testInfo = {
            userID: Number(p?.userID || this.applicantId || 0),
            userNameEn: fullEn.trim(),
            thaiName: fullTh.trim(),
            round: Number(res?.jobApplicationInfo?.jobApplications?.[0]?.round || 1)
          };

          this.vm = {
            ...this.vm,
            fullNameEn: fullEn || '—',
            fullNameTh: fullTh || '—',
            email: p.email || '—',
            phone: p.phoneNumber || '—',
            birthDate: this.formatDate(p.birthdate),
            ageText: age ? `${age} Year` : '—',
            citizenId: p.citizenID || '—',
            nationality: p.nationality || '—',
            ethnicity: p.ethnicity || '—',
            religion: p.religion || '—',
            weightText: this.safeVal(p.weight, 'kg'),
            heightText: this.safeVal(p.height, 'cm'),
            bloodGroup: p.bloodGroup || '—',
            bmiText: bmi ? `${bmi.toFixed(1)} (${bmiCat})` : '—',
            maritalStatus: p.maritalStatus || '—',
            childrenText: (res?.familyInfo?.numChildren ?? 0) > 0 ? String(res.familyInfo.numChildren) : 'No',
            facebook: s.facebook || '',
            instagram: s.instagram || '',
            twitter: s.xTwitter || '',
            linkedin: s.linkedin || '',
            currentAddress: this.formatAddress(a.currentAddress),
            permanentAddress: this.formatAddress(a.permanentAddress),
          };

          // ----- Emergency Contact -----
          const ec = res?.emergencyInfo ?? {};
          // เลือกที่อยู่ฉุกเฉิน: ถ้า payload มีค่าให้ใช้เลย,
          // มิฉะนั้น fallback ตาม typeAddressEmergency (1=Current, อื่นๆ=Permanent)
          const emergencyAddrRaw =
            (ec?.address && Object.values(ec.address || {}).some(Boolean))
              ? ec.address
              : (ec?.typeAddressEmergency === 1 ? a.currentAddress : a.permanentAddress);

          this.emergency = {
            name: [ec.firstName, ec.lastName].filter(Boolean).join(' ') || '—',
            relationship: ec.relationship || '—',
            phone: ec.phone || '—',
            address: this.formatAddress(emergencyAddrRaw)
          };

          // ----- Family Rows -----
          this.familyRows = this.mapFamilyRows(res?.familyInfo);

          // ----- Education Rows -----
          this.educationRows = (res?.educationInfo?.educationRecords ?? [])
            .filter((x: any) => (x.graduationYear ?? 0) !== 0 || (x.levelName ?? '') !== '')
            .sort((a: any, b: any) => (a.graduationYear ?? 0) - (b.graduationYear ?? 0))
            .map((e: any, idx: number) => ({
              __index: idx + 1,
              graduationYear: e.graduationYear || '',
              levelName: e.levelName || '',
              institution: e.universityName || e.school || '',
              majorFaculty: [e.major, e.faculty].filter(Boolean).join(' / ') || '',
              gpa: e.gpa || '',
            }));

          // ====== GPA Analysis ======
          const ana = res?.gpaAnalysisInfo ?? null;

          this.gpaRows = ana ? [
            {
              type: 'Core Subjects',
              gpa: this.fmtGpa(ana.coreGpa),
              visibility: this.iconOk(ana.coreSubjectCount)
            },
            {
              type: 'Elective Subjects',
              gpa: this.fmtGpa(ana.electiveGpa),
              visibility: this.iconOk(ana.electiveSubjectCount)
            },
            {
              type: 'Overall',
              gpa: this.fmtGpa(ana.overallGpa),
              visibility: this.iconOk(ana.totalSubjects)
            },
          ] : [
            {
              type: 'No GPA analysis provided',
              gpa: '—',
              visibility: { icon: 'xmark-circle', fill: 'gray', size: 18 }
            }
          ];

          // ====== Work History ======
          const wr: any[] = res?.workHistoryInfo?.workRecords ?? [];
          this.workRows = wr.map((w, i) => ({
            __index: i + 1,
            date: this.humanRange(w.workStart, w.workEnd, Number(w.workDurationMonths)),
            company: w.company || '',
            position: w.position || '',
            salary: this.fmtMoney(Number(w.salary)),
            reason: w.reasonForLeaving || '',
          }));

          // ====== Language Skills ======
          const langs: any[] = res?.skillsInfo?.languageSkills ?? [];
          const langMapped = langs.map((lg, i) => {
            const s1 = this.langView(lg?.speakingLevel);
            const s2 = this.langView(lg?.readingLevel);
            const s3 = this.langView(lg?.writingLevel);
            return {
              no: i + 1,
              language: lg?.languageName || '',
              speaking: s1.badge,
              reading:  s2.badge,
              writing:  s3.badge,
              score: +(s1.score + s2.score + s3.score).toFixed(2),
            };
          });
          const langTotal = this.sum(langMapped, r => r.score);
          this.langRows = [
            ...langMapped,
            {
              no: '',
              language: 'Total',
              speaking: this.hiddenBadge(),
              reading: this.hiddenBadge(),
              writing: this.hiddenBadge(),
              score: +langTotal.toFixed(2)
            },
          ];

          // ====== Computer / Bonus / Special Skills ======
          const comp: any[] = res?.skillsInfo?.computerSkills ?? [];
          const bonus: any[] = res?.skillsInfo?.bonusSkills ?? [];      // อาจไม่มีใน payload
          const special: any[] = res?.skillsInfo?.specialSkills ?? [];

          const asTable = (list: any[], typeLabel: string, nameKey?: string) => {
            const rows = (list || []).map((it, i) => {
              const name =
                (nameKey && it?.[nameKey]) ??
                it?.skillName ??           // computer / bonus
                it?.specialSkill ??        // special
                '';
              const v = this.compView(it?.skillLevelName);
              return {
                no: i + 1,
                type: typeLabel,
                skill: name,
                level: v.badge,
                score: +v.score.toFixed(2),
              };
            });
            const total = this.sum(rows, r => r.score);
            return [
              ...rows,
              { no: '', type: '', skill: 'Total', level: this.hiddenBadge(), score: +total.toFixed(2) }
            ];
          };

          this.compRows    = asTable(res?.skillsInfo?.computerSkills ?? [], 'Core',   'skillName');
          this.bonusRows   = asTable(res?.skillsInfo?.bonusSkills    ?? [], 'Bonus',  'skillName');
          this.specialRows = asTable(res?.skillsInfo?.specialSkills  ?? [], 'Support','specialSkill');

          // ====== Training & Certificate ======
          const tr: any[] = res?.trainingInfo?.trainingRecords ?? [];
          this.trainRows = tr.map((t, i) => ({
            __index: i + 1,
            course: t?.courseName || t?.subject || '',
            org: t?.institution || t?.organization || t?.company || '',
            duration: t?.duration || '',
          }));

          // ====== Driving ======
          this.driving = {
            carSkill: p?.carSkill || res?.diverInfo?.carSkill?.haveSkill || '—',
            carLicense: p?.carLicense || res?.diverInfo?.carSkill?.haveLicense || '—',
            motorcycleSkill: p?.motorcycleSkill || res?.diverInfo?.motorcycleSkill?.haveSkill || '—',
            motorcycleLicense: p?.motorcycleLicense || res?.diverInfo?.motorcycleSkill?.haveLicense || '—',
          };

          // ====== General Information ======
          const giList: any[] = res?.generalInfo?.lookupQuestions ?? [];
          const byId = (id: number) => giList.find(x => Number(x.questionId) === id)?.answer;

          this.general = {
            workRegular:    this.yesNo(byId(2)),     // Working in another province on a regular basis
            workOccasional: this.yesNo(byId(4)),     // Working in another province occasionally
            smoking:        this.smokerLabel(byId(6)),
            alcohol:        this.drinkerLabel(byId(8)),
            disease:        this.yesNo(byId(10)),
            legalCase:      this.yesNo(byId(12)),
          };

          // ====== Feedback on Myself (table) ======
          const fbList: any[] = res?.feedbackOnMyself?.lookupQuestions ?? [];
          this.feedbackRows = fbList.map((q, i) => ({
            __index: i + 1,
            question: (q?.questionName || '').trim(),
            answer:   (q?.answer || '').trim(),
          }));

          // ====== Work Motivation (table + summary) ======
          const wmList: any[] = res?.workMotivation?.lookupQuestions ?? [];
          this.motivationRows = wmList.map((q, i) => ({
            __index: i + 1,
            answer: Number(q?.answer) || 0,
            question: (q?.questionName || '').trim(),
            type: this.classifyMotivation(q?.questionName),
          }));

          // ใช้ % ที่มาจาก API ตรง ๆ (แม่นที่สุด)
          this.motivationStat = {
            intrinsic: Number(res?.workMotivation?.intrinsic ?? 0),
            extrinsic: Number(res?.workMotivation?.extrinsic ?? 0),
          };

        },
        error: () => {
          // เงียบ ๆ หรือแสดง notify ก็ได้
        }
      });
  }

  private fetchCandidateTracking() {
    if (!this.applicantId) return;

    this.applicationService
      .getTrackingApplications({ page: 1, pageSize: 1, search: String(this.applicantId) })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const it = (res?.items || []).find(i => Number(i.userID) === this.applicantId) || res?.items?.[0];
          // default เทา
          this.screening = { screenedBy: '—', screeningDate: '', status: null };
          this.screeningCardBg = '#6C757D';

          this.hasScreenedPending = String(it?.screened?.status || '').trim().toLowerCase() === 'pending';
          if (this.hasScreenedPending) {
            this.screeningCardBg = '#000000';
            this.screening.status = 'Pending';
          }

          // ต่อด้วยดึง stage history เพื่ออัปเดตการ์ด (กรณีไม่ pending)
          this.fetchAndMapScreeningFromHistory();
        },
        error: () => {
          // fallback เงียบ ๆ
        }
      });
  }

  private fetchAndMapScreeningFromHistory() {
    if (this.hasScreenedPending) return; // คงไว้เป็น Pending สีดำ

    this.applicationService.getCandidateStageHistoryById(this.applicantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (histories: any[]) => {
          const screenedList = (histories || [])
            .filter(h => String(h.stageName || '').trim().toLowerCase() === 'screened');

          if (!screenedList.length) return;

          const latest = screenedList
            .slice()
            .sort((a, b) => new Date(b.stageDate || 0).getTime() - new Date(a.stageDate || 0).getTime())[0];

          const hrName = latest?.hrUserName || '—';
          const catName = String(latest?.categoryName || '');
          const status  = this.normalizeCategoryToStatus(catName);
          const bg      = this.categoryToBg(catName);

          this.screening.screenedBy    = hrName;
          this.screening.screeningDate = latest?.stageDate || '';
          this.screening.status        = status;
          this.screeningCardBg         = bg;
        },
        error: () => { /* เงียบ ๆ */ }
      });
  }

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
        error: () => { this.commentsLoading = false; }
      });
  }

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

  private safeVal(n: any, unit: string) {
    const v = Number(n);
    return Number.isFinite(v) ? `${v} ${unit}` : '—';
  }
  private formatDate(d: string | Date | undefined) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-GB'); // dd/MM/yyyy
  }
  private calcAge(d?: string | Date) {
    if (!d) return null;
    const birth = new Date(d); if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }
  private calcBmi(weightKg?: number, heightCm?: number) {
    if (!weightKg || !heightCm) return 0;
    const h = heightCm / 100;
    return weightKg / (h * h);
  }
  // Asian BMI cutoff
  private bmiCategoryAsian(bmi: number) {
    if (!bmi) return '—';
    if (bmi < 18.5) return 'Under';
    if (bmi < 23) return 'Normal';
    if (bmi < 25) return 'Over';
    if (bmi < 30) return 'Obese I';
    return 'Obese II';
  }
  private formatAddress(a?: any) {
    if (!a) return '';
    const parts = [
      a.houseNo && `House No. ${a.houseNo}`,
      a.alley && a.alley !== '-' && `Soi ${a.alley}`,
      a.villageNo && a.villageNo !== '-' && `Moo ${a.villageNo}`,
      a.road && a.road !== '-' && a.road,
      a.district,
      a.amphoe && `Khet/Amphoe ${a.amphoe}`,
      a.province,
      a.zipcode && String(a.zipcode),
    ].filter(Boolean);
    return parts.join(', ');
  }
  private mapFamilyRows(info?: any) {
    if (!info) return [];
    const rows: any[] = [];

    const pushPerson = (rel: string, p?: any) => {
      if (!p) return;
      rows.push({
        relationship: rel,
        name: [p.firstName, p.lastName].filter(Boolean).join(' '),
        occupation: p.occupation || '',
        age: p.age || '',
        address: this.formatAddress(p.address),
        phone: p.phone || '',
      });
    };

    pushPerson('Father', info.fatherInfo);
    pushPerson('Mother', info.motherInfo);

    (info.siblings ?? []).forEach((s: any) => {
      rows.push({
        relationship: s.relationship || 'Sibling',
        name: [s.firstName, s.lastName].filter(Boolean).join(' '),
        occupation: s.occupation || '',
        age: s.age || '',
        address: this.formatAddress(s.address),
        phone: s.phone || '',
      });
    });

    return rows.map((r, i) => ({ ...r, __index: i + 1 }));
  }

  // ===== helpers for badges/scores =====
  private langView(level?: string) {
    const norm = (level || '').toLowerCase().trim();
    // normalize label
    const label =
      norm === 'excellent' || norm === 'very good' ? 'Very Good' :
      norm === 'good' ? 'Good' :
      norm === 'fair' ? 'Fair' : 'Normal';
    // score map (ปรับง่าย ๆ : VG=1, Good=0.5, Fair=0.25, Normal=0)
    const score = label === 'Very Good' ? 1 : label === 'Good' ? 0.5 : label === 'Fair' ? 0.25 : 0;

    const klass =
      label === 'Very Good' ? ['tw-bg-[#00aa0024]','tw-ring-[#68e817]','tw-text-[#007a00]'] :
      label === 'Good'      ? ['tw-bg-green-50','tw-ring-green-300','tw-text-green-700'] :
      label === 'Fair'      ? ['tw-bg-amber-100','tw-ring-amber-300','tw-text-amber-700'] :
                              ['tw-bg-gray-100','tw-ring-gray-300','tw-text-gray-700'];

    return { badge: { label: score ? `${label} (${score})` : label, class: klass }, score };
  }

  private compView(level?: string) {
    // ใช้ mappingเดียวกับภาษา
    return this.langView(level);
  }

  private sum<T>(arr: T[], fn: (t: T) => number) {
    return arr.reduce((a, x) => a + (fn(x) || 0), 0);
  }

  private fmtMoney(n?: number) {
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '—';
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  private humanRange(from?: string, to?: string, months?: number) {
    if (!from && !to) return '—';
    const f = from ? new Date(from) : null;
    const t = to ? new Date(to) : null;
    const left = f ? f.toLocaleDateString('en-GB') : '—';
    const right = t ? t.toLocaleDateString('en-GB') : 'Present';
    const hint = months && months > 0 ? ` (${months} months)` : '';
    return `${left} - ${right}${hint}`;
  }

  isSkillValueInvalid(v?: string) {
    const s = (v || '').trim().toLowerCase();
    // ถ้ามีลักษณะเหมือน URL ให้ถือว่าใส่ผิดช่อง (ตามภาพตัวอย่าง)
    return /(http|www\.|\.com|\.net|instagram|facebook)/.test(s);
  }

  toBool(val?: any): boolean {
    if (typeof val === 'boolean') return val;
    const s = String(val ?? '').trim().toLowerCase();

    // สัญญาณเชิงลบมาก่อน
    if (
      /(don'?t\s*have|donot\s*have|don'?t|no|ไม่มี|false|0|not)/.test(s)
    ) return false;

    // สัญญาณเชิงบวก
    if (/(have|yes|มี|true|1|pass|passed)/.test(s)) return true;

    return false; // ค่าอื่น ๆ ถือว่าไม่มีก่อน
  }

  private hiddenBadge() {
    return { label: '\u00A0', class: ['tw-hidden'] }; // label เป็น NBSP + ซ่อนไปเลย
  }

  private yesNo(a?: any) {
    const s = String(a ?? '').trim().toLowerCase();
    return /^(y|yes|1|true)$/i.test(s) ? 'Yes' : /^(n|no|0|false)$/i.test(s) ? 'No' : (s || '—');
  }

  private smokerLabel(a?: any) {
    const yn = this.yesNo(a);
    if (yn === '—') return '—';
    return yn === 'Yes' ? 'Smoker' : 'Non-smoker';
  }

  private drinkerLabel(a?: any) {
    const yn = this.yesNo(a);
    if (yn === '—') return '—';
    return yn === 'Yes' ? 'Drinker' : 'Non-drinker';
  }

  // จัดประเภท Intrinsic/Extrinsic แบบกฎง่าย ๆ (ปรับได้ในอนาคต)
  private classifyMotivation(q?: string): 'Intrinsic'|'Extrinsic' {
    const s = (q || '').toLowerCase();
    if (/(supervisor|recognized|promoted|appreciated|lead a team)/.test(s)) return 'Extrinsic';
    return 'Intrinsic';
  }

  private fmtGpa(n?: number) {
    return (typeof n === 'number' && isFinite(n) && n > 0) ? n.toFixed(2) : '—';
  }
  private iconOk(has?: number | any) {
    const ok = Number(has) > 0;
    return { icon: ok ? 'check-circle' : 'xmark-circle', fill: ok ? 'green' : 'red', size: 18 };
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
    return 'Application';
  }

  onSubmitNewComment() {
    const text = (this.commentCtrl.value || '').trim();
    if (!text || !this.applicantId) return;

    this.applicationService
      .getCurrentStageByCandidateId(this.applicantId)
      .pipe(
        takeUntil(this.destroy$),
        map((res: any) => (res?.data?.typeName ? String(res.data.typeName).trim() : 'Application')),
        catchError(() => of('Application')),
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
        error: () => {}
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
        error: () => {}
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
        error: () => {}
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
          error: () => {}
        });
    });
  }

  trackByCommentId = (_: number, c: ViewComment) => c.id;

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

  onCommentClick() {
    const el = document.getElementById('comments-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onEqTestClick() {
    if (!this.testInfo.userID && !this.applicantId) {
      this.notify?.error?.('Missing applicant ID. Cannot open the EQ Test.');
      return;
    }
    this.openInNewTab(this.buildTestUrl(1));
  }

  onEthicsTestClick() {
    if (!this.testInfo.userID && !this.applicantId) {
      this.notify?.error?.('Missing applicant ID. Cannot open the Ethics Test.');
      return;
    }
    this.openInNewTab(this.buildTestUrl(2));
  }

  // ===== เมธอดช่วย: สร้าง URL ของแบบทดสอบ =====
  private buildTestUrl(quiz: 1 | 2): string {
    const base = 'https://career.pinepacific.com/screen/front-end/applyFormPageTest.php';

    // ใช้ URLSearchParams เพื่อเข้ารหัสชื่อ (รวมภาษาไทย) ให้เรียบร้อย
    const qs = new URLSearchParams({
      quiz: String(quiz),
      UserID: String(this.testInfo.userID || this.applicantId || ''),
      userName: this.testInfo.userNameEn || '',
      thaiName: this.testInfo.thaiName || '',
      round: String(this.testInfo.round || 1),
      result: '1'
    });

    return `${base}?${qs.toString()}`;
  }

  // ===== เมธอดช่วย: เปิดลิงก์ในแท็บใหม่ แบบไม่บล็อกหน้าเดิม =====
  private openInNewTab(url: string) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ===== เมธอดช่วย: สร้าง URL ไปหน้าแก้ไข GPAX (เปิดในแท็บใหม่) =====
  private buildGpaEditUrl(): string {
    const base = 'https://career.pinepacific.com/screen/Back-end/editGPAX.php';
    const qs = new URLSearchParams({
      // ใช้ userID จาก API (fallback เป็น applicantId ถ้ามี)
      UserId: String(this.testInfo.userID || this.applicantId || ''),
      // ใช้ชื่ออังกฤษ; ถ้าไม่มีให้เว้นว่างไว้
      name: this.testInfo.userNameEn || this.vm.fullNameEn.replace('—','') || ''
    });
    return `${base}?${qs.toString()}`;
  }

  // ===== กดปุ่ม "Evaluation" ใน GPA Analysis =====
  onGpaEvaluate() {
    if (!this.testInfo.userID && !this.applicantId) {
      this.notify?.error?.('Missing applicant ID. Cannot open the GPA Evaluation.');
      return;
    }
    this.openInNewTab(this.buildGpaEditUrl());
  }
}
