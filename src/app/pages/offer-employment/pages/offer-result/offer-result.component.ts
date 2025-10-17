import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, Observable, of, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { COMPOSITION_BUFFER_MODE, FormBuilder, FormControl, FormGroup } from '@angular/forms';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { ApplicationService } from '../../../../services/application/application.service';
import { CandidatePagedResult } from '../../../../interfaces/Application/application.interface';
import { CandidateTracking } from '../../../../interfaces/Application/tracking.interface';
import { AlertDialogComponent } from '../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { ReasonService } from '../../../../services/admin-setting/reason/reason.service';
import { AlertDialogData } from '../../../../shared/interfaces/dialog/dialog.interface';
import { InterviewFormService } from '../../../../services/interview-scheduling/interview-form/interview-form.service';
import { DropdownOption } from '../../../../shared/components/cdk-dropdown/cdk-dropdown.component';
import { AppointmentsService } from '../../../../services/interview-scheduling/appointment-interview/appointments.service';
import { NotificationService } from '../../../../shared/services/notification/notification.service';
import { SelectDialogComponent, SelectOption } from '../../../../shared/components/dialogs/select-dialog/select-dialog.component';
import { MailDialogComponent } from '../../../../shared/components/dialogs/mail-dialog/mail-dialog.component';
import { IBenefitsFilterRequest } from '../../../../interfaces/admin-setting/general-benefits.interface';

dayjs.extend(timezone);

// ===== Types (view) =====
type ResultGroupKey = 'accept' | 'decline'; // kept only if needed later (no UI usage now)
type CategoryOption = { categoryId: number; categoryName: string };

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
  selector: 'app-offer-result',
  templateUrl: './offer-result.component.html',
  styleUrl: './offer-result.component.scss'
})
export class OfferResultComponent {
  // ===== Routing =====
  applicantId = 0;
  round: number = 1;
  isLatestRound = true;
  stageId = 0;
  idEmployee = 0;
  appointmentId: string | undefined;
  resultName: string | undefined;
  appointmentsItem: any
  historyData: any[] = [];
  dropdownConfigs: any[] = [];
  dataOptions: any[] = [];
  dataStatusCall: any[] = [];
  dataStatusCallFirst: any[] = [];
  dataStatusCallSecond: any[] = [];

  // ===== Applicant (header) =====
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

  // ===== Forms & basic state =====
  formDetails!: FormGroup;
  commentCtrl!: FormControl<string>;
  today: string | undefined;
  usernameLogin: string | undefined;

  // ===== Hire details state =====
  reasonsInterview1: any[] = [];
  selectedCategoryId: number | null = null;

  reviewHistory: any[] = [];
  foundisSummary: any;

  editReview = false;
  allowEditButton = true;

  // ===== Comments state =====
  commentsLoading = false;
  commentsTree: ViewComment[] = [];
  currentUserName = '';

  // ===== Cache/Snapshot =====
  snapshotInputForm: any;
  private readonly cacheKeyBase = 'offer-result:';
  private destroy$ = new Subject<void>();

  payloadPositionChange: any;

  companyValue: number | null = null;
  departmentValue: number | null = null;
  divisionValue: number | null = null;
  levelValue: string | null = null;
  managerValue: string | null = null;
  isActiveDepartment: boolean = true;
  isActiveDivision: boolean = true;
  isActiveLevel: boolean = true;
  isActivePosition: boolean = true;
  isActiveManager: boolean = true;
  isActiveStartDate: boolean = true;
  isActiveProbation: boolean = true;
  positionOptions: DropdownOption[] = [];
  positionOptions2: DropdownOption[] = [];
  companyOptions: DropdownOption[] = [];
  departmentOptions: DropdownOption[] = [];
  divisionOptions: DropdownOption[] = [];
  LevelOptions: DropdownOption[] = [];
  probationOptions: DropdownOption[] = [];
  managerOptions: DropdownOption[] = [];
  selectedPositionId: number | null = null;
  selectedPositionId2: any | null = null;
  selectedCompanyId: number | null = null;
  selectedDepartmentId: number | null = null;
  selectedDivisionId: number | null = null;
  selectedLevelId: string | null = null;
  selectedProbation: number | null = null;
  selectedManagerId: number | null = null;
  confirmedStartDate: string | null = null;
  payloadforPosition: any;

  private levelsRaw: any[] = [];
  private positionsRaw: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private fb: FormBuilder,
    private interviewFormService: InterviewFormService,
    private appointmentsService: AppointmentsService,
    private applicationService: ApplicationService,
    private notificationService: NotificationService,
    private reasonService: ReasonService
  ) { }

  // ===================== Lifecycle =====================
  ngOnInit() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    this.today = `${year}-${month}-${day}`;

    this.commentCtrl = this.fb.control<string>('', { nonNullable: true });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.applicantId = Number(params['id'] || 0);
      this.stageId = 3;
      this.idEmployee = Number(params['idEmployee']);

      this.fetchCandidateTracking();
      this.fetchRecruitmentStagesWithReasons(4); // offer state
      this.fetchCompanyDetails();
      this.fetchStatusCall();
      this.fetchLevelDetails();
      this.fetchProbationDetails();
      this.fetchPositionDetails();
      this.fetchManagerDetails();
    });

    const userString = sessionStorage.getItem('user');
    if (userString) {
      const user = JSON.parse(userString);
      this.usernameLogin = user.username;
    }

    this.initializeForm();

    this.formDetails.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.saveCache();
    });

    this.formDetails
      .get('noteInterviewReview')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.saveCache());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===================== Init & Fetch =====================
  initializeForm() {
    this.formDetails = this.fb.group(
      {
        userInterviewReview: [this.foundisSummary?.hrUserName || this.usernameLogin],
        dateInterviewReview: [this.today],
        noteInterviewReview: [this.foundisSummary?.notes || ''],
        confirmedStartDate: [this.formatDateForInput(this.foundisSummary?.confirmedStartDate) || null],
      },
      { updateOn: 'change' }
    );
  }

  private fetchCandidateTracking() {
    if (!this.applicantId) return;

    this.applicationService.getTrackingApplications({
      page: 1, pageSize: 20, search: String(this.applicantId),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: CandidatePagedResult<CandidateTracking>) => {
          const items = res?.items ?? [];
          if (!items.length) return;

          // เฉพาะของ user นี้
          const byUser = items.filter(i => Number(i.userID) === this.applicantId);
          const pool = byUser.length ? byUser : items;

          const roundParam = Number(this.round) || null;
          const getRound = (x: any) => Number(x?.roundID ?? x?.round ?? 0);

          let exact: CandidateTracking;

          exact = pool.reduce((best, cur) => {
            const br = getRound(best);
            const cr = getRound(cur);
            if (cr !== br) return cr > br ? cur : best;
            return this.getLastTs(cur) > this.getLastTs(best) ? cur : best;
          }, pool[0]);
          // อัปเดต this.round ให้เป็นรอบที่เลือกมา เพื่อให้หน้าอื่นใช้ต่อได้
          this.round = getRound(exact) || 1;

          const latestRound = pool.reduce((mx, cur) => Math.max(mx, getRound(cur)), 0);
          const selectedRound = getRound(exact) || 1;
          this.isLatestRound = selectedRound === latestRound;
          if (!this.isLatestRound) {
            this.allowEditButton = false;
            this.editReview = false;
          }

          this.mapTrackingToView(exact);

          this.fetchFiles(Number(this.applicantId || 0));
          const appointmentIdKey = `interview${this.stageId}AppointmentId`;
          (this as any)[appointmentIdKey] = (exact as any)?.[appointmentIdKey];

          // ✅ positions เป็น array ต้อง map ซ้อน
          this.positionOptions = (exact.positions ?? [])
            .map((p: any) => ({ label: p?.namePosition ?? '', value: p?.iDjobPST }))
            .filter(o => o.label && o.value != null);
        },
        error: (err) => console.error('[ApplicationForm] getTrackingApplications error:', err),
      });

    const updatedParams = {
      search: String(this.applicantId),
    };

    this.appointmentsService.getInterviewOffer<any>(updatedParams).subscribe({
      next: (response) => {
        this.appointmentId = response.items[0].profile.appointmentId
        this.appointmentsItem = response.items[0]
        
        this.resultName = response.items[0].result.offerResult.toLowerCase();

        const jobList = this.appointmentsItem?.jobPosition?.jobList ?? [];
        const activeJob = jobList.find((j: any) => j?.isActive === true);

        this.selectedPositionId = activeJob?.jobId ?? jobList[0]?.jobId ?? null;

        this.fetchOfferEmploymentsByID()

      },
      error: (error) => console.error('Error fetching Recruitment Stages with reasons:', error),
    });
  }

  isOffer() {
    return this.resultName === 'offer'
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

  private fetchOfferEmploymentsByID() {
    if (!this.applicantId) return;

    this.interviewFormService.getOfferEmploymentsByID(this.applicantId).subscribe({
      next: (o) => {
        if (!o) return;

        // probationDay
        if (o.probationDay) {
          this.selectedProbation = o.probationDay;
        }

        // Company
        if (o.companyId) {
          this.selectedCompanyId = o.companyId;
          this.companyValue = o.companyId;
          this.isActiveDepartment = false;

          // โหลด options ที่เหลือให้พร้อม
          this.fetchDepartmentDetails(o.companyId);
          // this.fetchManagerDetails();
          // this.fetchLevelDetails();
          // this.fetchPositionDetails();
        }

        // Department
        if (o.companyId && o.departmentId) {
          this.selectedDepartmentId = o.departmentId;
          this.departmentValue = o.departmentId;
          this.isActiveDivision = false;

          // ต้องมี dept ก่อน ถึงจะโหลด division
          this.fetchDivisionDetails(o.companyId, o.departmentId);
        }

        // Division
        if (o.divisionId) {
          this.selectedDivisionId = o.divisionId;
          this.divisionValue = o.divisionId;
          this.isActiveLevel = false;
        }

        // Level: map จาก levelId -> levelNameEn (value ของ dropdown เป็นชื่อ EN แบบ lower-case)
        if (o.levelId) {
          this.selectedLevelId = o.levelId;
          this.levelValue = o.levelId;
          this.isActivePosition = false;
        }

        // Position: map จาก positionId -> positionNameEN (value เป็น lower-case เหมือนกัน)
        if (o.positionId) {
          const setPositionFromId = () => {
            const hit = (this.positionsRaw || []).find((p: any) => p.newPositionId === o.positionId);
            if (hit?.positionNameEN) {
              const label = `${hit.positionNameTH}${hit.positionNameEN ? ` (${hit.positionNameEN})` : ''}`.trim() || '-';
              const key = label.toLowerCase();


              // const value = String(hit.positionNameEN).toLowerCase().trim();
              this.selectedPositionId2 = key;
              this.isActiveManager = false;
            }
          };
          // this.selectedPositionId2 = o.positionId;
          // this.isActiveManager = false;
          setPositionFromId()

          // if (this.positionsRaw?.length) setPositionFromId();
          // else {
          //   this.interviewFormService.getCompanyPositions().subscribe({
          //     next: (res) => { this.positionsRaw = Array.isArray(res) ? res : []; setPositionFromId(); }
          //   });
          // }
        }

        // Manager
        if (o.managerId != null) {
          this.selectedManagerId = Number(o.managerId);
          this.managerValue = String(o.managerId);
          this.isActiveStartDate = false;
        }

        // Start date
        if (o.comfirmDate) {
          this.formDetails.patchValue(
            { confirmedStartDate: this.formatDateForInput(o.comfirmDate) },
            { emitEvent: false }
          );
        }
      },
      error: (error) => console.error('Error fetchOfferEmploymentsByID:', error),
    });
  }

  fetchRecruitmentStagesWithReasons(interview: number) {
    this.reasonService.getRecruitmentStagesWithReasons(interview).subscribe({
      next: (response) => {
        this.reasonsInterview1 = response.map((category: any) => ({
          ...category,
          rejectionReasons: category.rejectionReasons.map((reason: any) => ({
            ...reason,
            checked: false,
          })),
        }));

        this.fetchInterviewer();
      },
      error: (error) => console.error('Error fetching Recruitment Stages with reasons:', error),
    });
  }

  fetchInterviewer() {
    this.interviewFormService
      .getApplicantReview(Number(this.applicantId), Number(this.stageId) + 1)
      .subscribe({
        next: (res) => {
          // 0) store reviewHistory
          this.reviewHistory = res;

          // 1) pick summary
          if (this.idEmployee) {
            this.foundisSummary = this.reviewHistory.find((u) => u.hrUserId === this.idEmployee);
          } else {
            this.foundisSummary = this.reviewHistory.find((u) => u.isSummary === true) ?? null;
          }

          // 2) init form
          this.initializeForm();

          if (!this.foundisSummary) {
            this.editReview = true;
            this.allowEditButton = false;
            this.setReviewEditing(true);
          } else {
            const editing = this.isReviewEditing();
            this.editReview = editing;
            this.allowEditButton = !editing;
          }

          // 3) read cache
          let rawObj: any = null;
          const rawString = sessionStorage.getItem(this.cacheKey());
          if (rawString) {
            try {
              rawObj = JSON.parse(rawString);
            } catch {
              rawObj = null;
            }
          }

          // 4) apply reasons (cache > server)
          this.reasonsInterview1.forEach((category: any) => {
            (category.rejectionReasons || []).forEach((reason: any) => {
              const fromCache = rawObj?.selectedReasonIds?.includes(reason.reasonId);
              const fromServer = this.foundisSummary?.selectedReasonIds?.includes(reason.reasonId);
              reason.checked = !!(fromCache ?? fromServer);
            });
          });

          // 5) selected category (cache > server)
          this.selectedCategoryId = rawObj?.categoryId ?? this.foundisSummary?.categoryId ?? null;

          // 6) if cache exists, patch and set baseline from server
          if (rawObj) {
            const editing = this.isReviewEditing();     // <-- อ่านสถานะจาก session
            this.editReview = editing;
            this.allowEditButton = !editing;

            if (editing) {
              // patch เฉพาะส่วน review ที่เกี่ยวกับการแก้ไข
              this.formDetails.patchValue(
                {
                  dateInterviewReview: this.formatDateForInput(rawObj?.stageDate),
                  noteInterviewReview: rawObj?.notes ?? '',
                },
                { emitEvent: false }
              );

              this.snapshotInputForm = this.buildServerBaselinePayload();

              this.selectedPositionId = rawObj?.jobpositionId ?? this.foundisSummary?.jobpositionId ?? null;
              this.companyValue = rawObj?.companyId ?? null;
              this.departmentValue = rawObj?.departmentId ?? null;
              this.divisionValue = rawObj?.divisionId ?? null;
              this.levelValue = rawObj?.level ?? null;
              this.managerValue = rawObj?.managerId ?? null;
              this.selectedPositionId2 = rawObj?.jobpositionId2 ?? null;

              if (this.companyValue != null) {
                this.fetchDepartmentDetails(this.companyValue);
                // this.fetchManagerDetails();
                // this.fetchLevelDetails();
                // this.fetchPositionDetails();
                if (this.departmentValue != null) {
                  this.fetchDivisionDetails(this.companyValue, this.departmentValue);
                }
              }

              if (rawObj?.confirmedStartDate) {
                this.formDetails.patchValue(
                  { confirmedStartDate: this.formatDateForInput(rawObj.confirmedStartDate) },
                  { emitEvent: false }
                );
              }
            }

            this.rehydrateOfferPositionDraft(rawObj);
          } else {
            this.takeSnapshotFromUI();
          }

        },
        error: (error) => console.error('Error fetching applicant review:', error),
      });
  }

  private fetchFiles(id: number) {
    if (!id) return;
    this.applicationService
      .getFileByCandidateId(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          const files = Array.isArray(res) ? res : [];
          const profile = files.find((f) => String(f?.fileType).toLowerCase() === 'profile');
          this.applicant.avatarUrl = profile?.filePath || '';
        },
        error: (e) => console.error('[ApplicationForm] getFileByCandidateId error:', e),
      });
  }

  fetchCompanyDetails() {
    this.interviewFormService.getCompany().subscribe({
      next: (res) => {
        const companyMap = new Map<number, DropdownOption>(
          (res ?? []).map((x: any): [number, DropdownOption] => [
            x.companyId,
            { label: x.companyNameEn, value: x.companyId },
          ])
        );

        this.companyOptions = Array.from(companyMap.values());
      },
      error: (error) => {
        console.error('Error fetching education levels:', error);
      },
    });
  }

  fetchDepartmentDetails(companyId: number) {
    this.interviewFormService.getCompanyById(companyId).subscribe({
      next: (res) => {
        const deptMap = new Map<number, DropdownOption>(
          (res ?? []).map((x: any): [number, DropdownOption] => [
            x.departmentId,
            { label: x.departmentNameTh, value: x.departmentId },
          ])
        );

        this.departmentOptions = Array.from(deptMap.values());
      },
      error: (error) => {
        console.error('Error fetching education levels:', error);
      },
    });
  }

  fetchDivisionDetails(companyId: number, departmentId: number) {
    this.interviewFormService.getCompanyDepartmentById(companyId, departmentId).subscribe({
      next: (res) => {
        const divisionMap = new Map<number, DropdownOption>(
          (res ?? []).map((x: any): [number, DropdownOption] => [
            x.divisionId,
            { label: x.divisionNameTh, value: x.divisionId },
          ])
        );

        this.divisionOptions = Array.from(divisionMap.values());
      },
      error: (error) => {
        console.error('Error fetching education levels:', error);
      },
    });
  }

  fetchLevelDetails() {
    this.interviewFormService.getCompanyLevels().subscribe({
      next: (res) => {
        this.levelsRaw = Array.isArray(res) ? res : [];
        const levelMap = new Map<string, DropdownOption>(
          this.levelsRaw.map((x: any): [string, DropdownOption] => [
            x.levelId,
            { label: x.levelNameTh, value: x.levelId },
          ])
        );
        this.LevelOptions = Array.from(levelMap.values());
      },
      error: (error) => console.error('Error fetching education levels:', error),
    });
  }

  fetchProbationDetails() {
    this.interviewFormService.getProbation().subscribe({
      next: (res) => {
        const probationMap = new Map<number, DropdownOption>(
          (res ?? []).map((x: any): [number, DropdownOption] => [
            x.probationId,
            { label: x.probationPeriod, value: x.probationPeriod },
          ])
        );
        this.probationOptions = Array.from(probationMap.values());
      },
      error: (error) => console.error('Error fetching education levels:', error),
    });
  }

  fetchPositionDetails() {
    this.interviewFormService.getCompanyPositions().subscribe({
      next: (res) => {
        const items = Array.isArray(res) ? res : [];
        this.positionsRaw = items; // <- เก็บ raw ไว้ด้วย

        const map = new Map<string, { label: string; value: string }>();
        for (const x of items) {
          const th = (x?.positionNameTH ?? '').trim();
          const en = (x?.positionNameEN ?? '').trim();
          const label = `${th}${en ? ` (${en})` : ''}`.trim() || '-';
          if (!label) continue;
          const key = label.toLowerCase(); // value = key แบบเดิม
          if (!map.has(key)) map.set(key, { label, value: key });
        }

        const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
        const options = Array.from(map.values()).sort((a, b) => collator.compare(a.label, b.label));
        this.positionOptions2 = options as unknown as DropdownOption[];
      },
      error: (error) => console.error('Error fetching positions:', error),
    });
  }


  fetchManagerDetails() {
    this.interviewFormService.getManager().subscribe({
      next: (res) => {
        const ManagerMap = new Map<number, DropdownOption>(
          (res ?? []).map((x: any): [number, DropdownOption] => [
            x.managerId,
            { label: x.mgrFullnameTH, value: x.managerId },
          ])
        );
        this.managerOptions = Array.from(ManagerMap.values());
      },
      error: (error) => console.error('Error fetching education levels:', error),
    });
  }

  protected currentFilterParams: IBenefitsFilterRequest = {
    page: 1,
    pageSize: 5,
  };

  fetchStatusCall() {
    const updatedParams = {
      ...this.currentFilterParams,
      page: this.currentFilterParams.page ?? 1,
      search: this.currentFilterParams.search,
    };

    this.appointmentsService.getStatus<any>(updatedParams).subscribe({
      next: (res) => {
        const allMapped = res.map((item: { reasonMissCall: any; missCallId: number }) => ({
          label: item.reasonMissCall,
          value: item.missCallId
        }));

        this.dataStatusCallFirst = allMapped.filter((item: { value: number; }) => item.value >= 0 && item.value <= 49);
        this.dataStatusCallSecond = allMapped.filter((item: { value: number; }) => item.value >= 50 && item.value <= 99);

        this.dataStatusCall = [...this.dataStatusCallFirst, ...this.dataStatusCallSecond];
      },
      error: (err) => {
        console.error('Error fetching appointments:', err);
      }
    });
  }

  private getOptionLabelByValue(val: string): string {
    const list = (this.positionOptions2 ?? []) as any[];

    const hit = list.find((o) => {
      // ถ้าเป็น object ที่มี value -> เทียบกับ selectedValue
      if (o && typeof o === 'object' && 'value' in o) {
        return String(o.value) === String(val);
      }
      // ถ้าเป็น string (หรือ primitive) -> เทียบ lowercase
      return String(o).toLowerCase() === String(val).toLowerCase();
    });

    if (hit == null) return val ?? '';
    if (typeof hit === 'string') return hit;
    if (typeof hit.label === 'string') return hit.label;

    return val ?? '';
  }

  private parsePositionLabel(label: string): { th: string; en: string } {
    const m = label.match(/^(.*?)(?:\s*\((.*?)\))?$/);
    const th = (m?.[1] ?? '').trim();
    const en = (m?.[2] ?? '').trim();
    return { th, en: en || th };
  }


  // input change
  onPositionChange(selectedValue: number) {
    this.selectedPositionId = selectedValue;
    this.payloadPositionChange = {
      userId: this.applicantId,
      selectedPositionId: selectedValue
    };
    this.saveCache();
  }

  onPositionChange2(selectedValue: string) {
    const label = this.getOptionLabelByValue(selectedValue);
    const { th, en } = this.parsePositionLabel(label);

    const payload = {
      userId: this.applicantId,
      positionNameTh: th,
      positionNameEn: en,
    };

    this.selectedPositionId2 = selectedValue;
    this.isActiveManager = false;
    // this.saveCache();

    this.interviewFormService.updatePosition(payload).subscribe({
      next: () => {
        this.fetchInterviewer();
        this.foundisSummary = this.reviewHistory.find((user) => user.isSummary === true);
        this.editReview = false;
        this.allowEditButton = true;
      },
      error: (err) => console.error('Error Rescheduled:', err),
    });
  }

  onCompanyChange(selectedValue: number) {
    const payload = { userId: this.applicantId, companyId: selectedValue };

    this.companyValue = payload.companyId;
    this.selectedCompanyId = selectedValue;
    this.isActiveDepartment = false;
    this.fetchDepartmentDetails(this.companyValue!);
    // this.fetchManagerDetails();
    // this.fetchLevelDetails();
    // this.fetchPositionDetails();
    // this.saveCache();

    this.interviewFormService.getCompanyUserInfo(payload).subscribe({
      error: (err) => {
        console.error('Error update compony:', err);

        this.notificationService.error('Error update compony');
      }
    });
  }

  onDepartmentChange(selectedValue: number) {
    const payload = { userId: this.applicantId, departmentId: selectedValue };

    this.departmentValue = payload.departmentId;
    this.selectedDepartmentId = selectedValue;
    this.isActiveDivision = false;
    if (this.companyValue) {
      this.fetchDivisionDetails(this.companyValue, this.departmentValue!);
    }

    // this.saveCache();

    this.interviewFormService.updateDepartment(payload).subscribe({
      error: (err) => {
        console.error('Error update department:', err);

        this.notificationService.error('Error update department');
      }
    });
  }

  onDivisionChange(selectedValue: number) {
    const payload = { userId: this.applicantId, divisionId: selectedValue };

    this.divisionValue = selectedValue;
    this.selectedDivisionId = selectedValue;
    this.isActiveLevel = false;
    // this.saveCache();

    this.interviewFormService.updateDivision(payload).subscribe({
      error: (err) => {
        console.error('Error update division:', err);

        this.notificationService.error('Error update division');
      }
    });
  }

  onLevelChange(selectedValue: string) {
    const payload = { userId: this.applicantId, levelId: selectedValue };

    this.levelValue = String(selectedValue);
    this.selectedLevelId = selectedValue;
    this.isActivePosition = false;
    // this.saveCache();

    this.interviewFormService.updateLevel(payload).subscribe({
      error: (err) => {
        console.error('Error update level:', err);

        this.notificationService.error('Error update level');
      }
    });
  }

  onManagerChange(selectedValue: number) {
    const payload = { userId: this.applicantId, managerId: selectedValue };

    this.selectedManagerId = selectedValue;
    this.managerValue = String(selectedValue);
    this.isActiveStartDate = false;

    this.interviewFormService.updateManager(payload).subscribe({
      error: (err) => {
        console.error('Error update manager:', err);

        this.notificationService.error('Error update manager');
      }
    });
  }

  onProbationChange(selectedValue: number) {
    const payload = { userId: this.applicantId, probationDay: selectedValue };
    this.selectedProbation = selectedValue;
    // this.saveCache();

    this.interviewFormService.updateProbation(payload).subscribe({
      error: (err) => {
        console.error('Error update probation:', err);

        this.notificationService.error('Error update probation');
      }
    });
  }

  onConfirmedStartDate(event: Event) {
    const input = event.target as HTMLInputElement;
    const dateTime = new Date(input.value).toISOString();

    const payload = {
      appointmentId: String(this.appointmentId),
      interviewDate: dateTime
    }

    console.log(payload)

    this.appointmentsService.updateInterviewDate(payload).subscribe({
      error: (err) => {
        console.error('Error update date:', err);

        this.notificationService.error('Error update date');
      }
    });

    // this.saveCache();
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


  // ===================== Mapping =====================
  private mapTrackingToView(ct: CandidateTracking) {
    this.applicant = {
      id: String(ct.userID ?? ''),
      name: ct.fullName || ct.fullNameTH || '—',
      gpa: Number(ct.gpa ?? 0),
      university: ct.university || '—',
      appliedDate: ct.submitDate || '',
      email: ct.email || '—',
      positions: Array.from(
        new Set((ct.positions ?? []).map((p) => p?.namePosition).filter((n): n is string => !!n))
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
  }

  // ===================== UI Helpers =====================
  formatDateForInput(dateString: string | null | undefined): string {
    if (!dateString) return '';
    if (dateString.includes('T')) return dateString.split('T')[0];

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getCategoryBtnClass(c: CategoryOption, selectedId?: number | null) {
    const isActive = c.categoryId === selectedId;
    const name = (c.categoryName || '').toLowerCase();

    const tones = {
      accept: { fill: 'tw-bg-green-500 tw-text-white' },
      decline: { fill: 'tw-bg-red-500 tw-text-white' },
      noshow: { fill: 'tw-bg-gray-500 tw-text-white' },
      onhold: { fill: 'tw-bg-amber-500 tw-text-white' },
      default: { fill: 'tw-bg-white tw-text-gray-700' },
    };

    const tone =
      name.includes('not offer')
        ? tones.decline
        : name.includes('offer')
          ? tones.accept
          : name.includes('on hold') || name.includes('on-hold')
            ? tones.noshow
            : tones.default;

    const base = 'tw-text-sm tw-rounded-lg tw-px-3 tw-py-1.5 tw-border tw-transition';
    const ring = isActive ? ' tw-ring-2 tw-ring-white/40' : '';
    return base + ' ' + (isActive ? tone.fill : '') + ring;
  }

  // ===================== Hire Details Actions =====================
  toggleReasonCheck(reason: any) {
    reason.checked = !reason.checked;
    this.saveCache();
  }

  getRejectionReasons(categoryId: number) {
    const category = this.reasonsInterview1.find((item) => item.categoryId === categoryId);
    return category?.rejectionReasons?.filter((r: { isActive: any }) => r.isActive) || [];
  }

  selectCategory(categoryId: number) {
    this.reasonsInterview1 = this.reasonsInterview1.map((category: any) => ({
      ...category,
      rejectionReasons: category.rejectionReasons.map((reason: any) => ({
        ...reason,
        checked: false,
      })),
    }));

    this.selectedCategoryId = this.selectedCategoryId === categoryId ? null : categoryId;
    this.saveCache();
  }

  onComfirmReview() {
    const payload = this.formDetails.value;

    const isoDate = new Date(payload.dateInterviewReview).toISOString();
    const checkedReasonIds = this.reasonsInterview1.flatMap((category: { rejectionReasons: any[] }) =>
      category.rejectionReasons.filter((reason) => reason.checked === true).map((reason) => reason.reasonId)
    );

    const checkedCategoryIds = this.reasonsInterview1
      .filter((category) => category.rejectionReasons.some((reason: { checked: boolean }) => reason.checked === true))
      .map((category) => category.categoryId);

    const appointmentId = this.appointmentId;

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
        confirm: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (!confirmed) return;

      this.clearDraftsForCurrentType()
      this.setReviewEditing(false);

      const basePayload = {
        categoryId: checkedCategoryIds[0],
        stageDate: isoDate,
        notes: payload.noteInterviewReview,
        selectedReasonIds: checkedReasonIds,
      };

      const handleSuccess = () => {
        if (this.payloadPositionChange) {
          this.interviewFormService.postUpdateSelectPostion(this.payloadPositionChange).subscribe({});
        }

        this.fetchInterviewer();
        this.foundisSummary = this.reviewHistory.find((user) => user.isSummary === true);
        this.editReview = false;
        this.allowEditButton = true;

        this.clearDraftsForCurrentType()
        this.fetchCandidateTracking()
      };

      if (this.foundisSummary) {
        this.interviewFormService
          .updateCandidateStageHistory(this.foundisSummary.historyId, basePayload)
          .subscribe({
            next: handleSuccess,
            error: (err) => console.error('Error Rescheduled:', err),
          });
      } else {
        const transformedPayload = {
          applicationId: this.applicantId,
          stageId: this.stageId + 1,
          roundID: this.round,
          isSummary: true,
          appointmentId: (appointmentId ?? '').trim(),
          satisfaction: 0,
          strength: '',
          concern: '',
          ...basePayload,
        };

        this.interviewFormService.postInterviewReview(transformedPayload).subscribe({
          next: handleSuccess,
          error: (err) => console.error('Error Rescheduled:', err),
        });
      }
    });
  }

  onCancelReview() {
    const payload = this.formDetails.value;
    const isoDate = new Date(payload.dateInterviewReview).toISOString();

    const checkedReasonIds = this.reasonsInterview1.flatMap((category: { rejectionReasons: any[] }) =>
      category.rejectionReasons.filter((reason) => reason.checked === true).map((reason) => reason.reasonId)
    );

    const checkedCategoryIds = this.reasonsInterview1
      .filter((category) => category.rejectionReasons.some((reason: { checked: boolean }) => reason.checked === true))
      .map((category) => category.categoryId);

    const transformedPayload = {
      categoryId: checkedCategoryIds[0],
      stageDate: isoDate,
      notes: payload.noteInterviewReview,
      selectedReasonIds: checkedReasonIds,
    };

    if (JSON.stringify(this.snapshotInputForm) !== JSON.stringify(transformedPayload)) {
      this.fetchInterviewer();
      this.foundisSummary = this.reviewHistory.find((user) => user.isSummary === true);
      this.editReview = false;
      this.allowEditButton = true;
    }

    const countIsSummaryTrue = this.reviewHistory.filter((item) => item.isSummary === true).length;
    if (!countIsSummaryTrue) {
      this.editReview = true;
      this.allowEditButton = false;
    } else {
      this.editReview = false;
      this.allowEditButton = true;
    }

    this.clearDraftsReview();
    this.clearDraftsForCurrentType()
    // this.setReviewEditing(false);
  }

  onEditReview() {
    this.initializeForm();
    this.formDetails.enable();
    this.editReview = true;
    this.allowEditButton = false;
    this.setReviewEditing(true);

    const payload = this.formDetails.value;
    const isoDate = new Date(payload.dateInterviewReview).toISOString();

    const checkedReasonIds = this.reasonsInterview1.flatMap((category: { rejectionReasons: any[] }) =>
      category.rejectionReasons.filter((reason) => reason.checked === true).map((reason) => reason.reasonId)
    );

    const checkedCategoryIds = this.reasonsInterview1
      .filter((category) => category.rejectionReasons.some((reason: { checked: boolean }) => reason.checked === true))
      .map((category) => category.categoryId);

    const transformedPayload = {
      categoryId: checkedCategoryIds[0],
      stageDate: isoDate,
      notes: payload.noteInterviewReview,
      selectedReasonIds: checkedReasonIds,
    };

    this.snapshotInputForm = transformedPayload;
  }

  // ===================== Cache =====================
  private cacheKey(): string {
    return `${this.cacheKeyBase}${this.idEmployee || 'emp'}:${this.applicantId || 'app'}:${this.stageId || 'stage'}`;
  }

  private buildCurrentPayload() {
    const fd = this.formDetails?.getRawValue?.() ?? this.formDetails?.value ?? {};
    const isoDate = this.toIsoOrNull(fd?.dateInterviewReview) || '';

    const selectedReasonIds: number[] = (this.reasonsInterview1 || []).flatMap((c: any) =>
      (c.rejectionReasons || []).filter((r: any) => r.checked).map((r: any) => r.reasonId)
    );
    const checkedCategoryIds: number[] = (this.reasonsInterview1 || [])
      .filter((c: any) => (c.rejectionReasons || []).some((r: any) => r.checked))
      .map((c: any) => c.categoryId);

    const appointmentId = this.appointmentId;

    return {
      applicationId: this.applicantId,
      stageId: this.stageId + 1,
      roundID: this.round,
      categoryId: checkedCategoryIds[0] ?? null,
      isSummary: true,
      stageDate: isoDate,
      appointmentId: (appointmentId ?? '').trim(),
      satisfaction: 0,
      notes: fd?.noteInterviewReview ?? '',
      strength: '',
      concern: '',
      selectedReasonIds,
      jobpositionId: this.selectedPositionId ?? null,

      offerPosition: {
        companyId: this.selectedCompanyId ?? null,
        departmentId: this.selectedDepartmentId ?? null,
        divisionId: this.selectedDivisionId ?? null,
        level: this.selectedLevelId ?? null,
        managerId: this.selectedManagerId ?? null,
        startDate: this.toIsoOrNull(fd?.confirmedStartDate),
        jobpositionId: this.selectedPositionId2 ?? null,
      },
    };
  }

  private buildServerBaselinePayload() {
    const s = this.foundisSummary || {};
    const iso = this.toIsoOrNull(s.stageDate) || '';
    const appointmentId = this.appointmentId;

    return {
      applicationId: this.applicantId,
      stageId: this.stageId + 1,
      roundID: this.round,
      categoryId: s.categoryId ?? null,
      isSummary: true,
      stageDate: iso,
      appointmentId: (appointmentId ?? '').trim(),
      satisfaction: 0,
      notes: s.notes ?? '',
      strength: '',
      concern: '',
      selectedReasonIds: Array.isArray(s.selectedReasonIds) ? s.selectedReasonIds : [],
      jobpositionId: s.jobpositionId ?? null,

      offerPosition: {
        companyId: null,
        departmentId: null,
        divisionId: null,
        level: null,
        managerId: null,
        startDate: null, // << เป็น null
      },
    };
  }

  private reviewEditingKey(): string {
    return `${this.cacheKey()}:__editingReview`;
  }
  private setReviewEditing(on: boolean) {
    sessionStorage.setItem(this.reviewEditingKey(), on ? '1' : '0');
  }
  private isReviewEditing(): boolean {
    return sessionStorage.getItem(this.reviewEditingKey()) === '1';
  }

  private rehydrateOfferPositionDraft(rawObjFromCache?: any) {
    const cacheObj = rawObjFromCache ?? JSON.parse(sessionStorage.getItem(this.cacheKey()) || 'null');
    const op = cacheObj?.offerPosition;
    if (!op) return;

    this.selectedCompanyId = op.companyId ?? null;
    this.selectedDepartmentId = op.departmentId ?? null;
    this.selectedDivisionId = op.divisionId ?? null;
    this.selectedLevelId = op.level ?? null;
    this.selectedPositionId2 = op.jobpositionId ?? null;
    this.selectedManagerId = op.managerId ?? null;

    // วันเริ่มงาน -> patch ฟอร์ม (ไม่ยิง valueChanges)
    if (op.startDate) {
      this.formDetails.patchValue({ confirmedStartDate: this.formatDateForInput(op.startDate) }, { emitEvent: false });
    }

    // เปิด/ปิดตามค่าที่มี
    this.isActiveDepartment = !(this.selectedCompanyId);
    this.isActiveDivision = !(this.selectedDepartmentId);
    this.isActiveLevel = !(this.selectedDivisionId);
    this.isActivePosition = !(this.selectedLevelId);
    this.isActiveManager = !(this.selectedPositionId2);
    this.isActiveStartDate = !(this.selectedManagerId);

    // โหลด options ตาม chain
    if (this.selectedCompanyId) {
      this.fetchDepartmentDetails(this.selectedCompanyId);
      // this.fetchManagerDetails(this.selectedCompanyId);
      // this.fetchLevelDetails();
      // this.fetchPositionDetails();
    }
    if (this.selectedCompanyId && this.selectedDepartmentId) {
      this.fetchDivisionDetails(this.selectedCompanyId, this.selectedDepartmentId);
    }
  }

  onDateInput() { this.saveCache(); }
  onDateChange() { this.saveCache(); }

  private takeSnapshotFromUI() {
    this.snapshotInputForm = this.buildCurrentPayload();
  }

  saveCache(): void {
    const current = this.buildCurrentPayload();
    if (!this.snapshotInputForm) this.snapshotInputForm = this.buildServerBaselinePayload();

    const changed = JSON.stringify(current) !== JSON.stringify(this.snapshotInputForm);
    if (changed) {
      sessionStorage.setItem(this.cacheKey(), JSON.stringify(current));
    } else {
      sessionStorage.removeItem(this.cacheKey());
      sessionStorage.removeItem(`${this.cacheKey()}:__editingReview`);
    }
  }

  public clearDraftsForCurrentType(): void {
    sessionStorage.removeItem(this.cacheKey());
    sessionStorage.removeItem(`${this.cacheKey()}:__editingReview`);
  }

  public clearDraftsReview(): void {
    const dataSession = sessionStorage.getItem(this.cacheKey());
    if (dataSession) {
      const s = this.foundisSummary || {};
      const iso = this.toIsoOrNull(s.stageDate) || '';
      const appointmentId = this.appointmentId;

      const current = {
        applicationId: this.applicantId,
        stageId: this.stageId + 1,
        roundID: this.round,
        categoryId: s.categoryId ?? null,
        isSummary: true,
        stageDate: iso,
        appointmentId: (appointmentId ?? '').trim(),
        satisfaction: 0,
        notes: s.notes ?? '',
        strength: '',
        concern: '',
        selectedReasonIds: Array.isArray(s.selectedReasonIds) ? s.selectedReasonIds : [],
        jobpositionId: s.jobpositionId ?? null,
        offerPosition: JSON.parse(dataSession).offerPosition
      }

      sessionStorage.setItem(this.cacheKey(), JSON.stringify(current));
    }
  }

  public hasFormChanged(): boolean {
    const dataSession = sessionStorage.getItem(this.cacheKey());
    const dataSession2 = sessionStorage.getItem(`${this.cacheKey()}:__editingReview`);

    if (!dataSession2) {
      return false
    } else {
      return true
    }

    // if (!this.snapshotInputForm) return false;
    // if (!this.editReview) return false;


    // try {
    //   const current = this.buildCurrentPayload();
    //   const changed = JSON.stringify(current) !== JSON.stringify(this.snapshotInputForm);
    //   const hasDraft = !!sessionStorage.getItem(this.cacheKey());
    //   return this.isReviewEditing() && (changed || hasDraft);
    // } catch {
    //   return this.isReviewEditing();
    // }
  }


  private toIsoOrNull(input: any): string | null {
    if (!input) return null;
    const d = input instanceof Date ? input : new Date(input);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // send mail and call
  getHistoryDataForUser(appt: any) {
    const historyData: { date: string; time: string; status: any; value: any }[] = [];
    const missCalls = appt?.interview?.missCallHistory || [];
    missCalls.forEach((call: any) => {
      const d = call.missCallAt ? new Date(call.missCallAt) : null;
      historyData.push({
        date: d ? d.toISOString().split('T')[0].replace(/-/g, '/') : '',
        time: d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
        status: call.missCallReason || '',
        value: call.missCallId || 0
      });
    });
    return historyData;
  }


  onAddCallStatus(appt: any) {
    const currentUserId = appt?.profile?.userId;
    const currentAppointmentId = appt?.profile?.appointmentId;
    const missCallCount = appt?.interview?.missCallCount || 0;

    this.historyData = this.getHistoryDataForUser(appt);

    const historyOptions: SelectOption[] = this.historyData.map((item, index) => ({
      value: index,
      label: `${item.date} ${item.time} ${item.status}`,
    }));

    const defaultSelected = historyOptions.slice(0, 2).map(opt => opt.value);

    this.dropdownConfigs = [
      {
        type: 'toggle',
        missCallCount: missCallCount
      },
      {
        type: 'single',
        label: 'Status',
        placeholder: 'Select Status',
        optionsFirst: this.dataStatusCallFirst,
        optionsSecond: this.dataStatusCallSecond,
        dynamicByToggle: true
      },
      {
        type: 'multi',
        label: 'History',
        options: historyOptions,
        isHistory: true,
        defaultSelected: defaultSelected,
        placeholder: 'No History',
      }
    ];

    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
      document.querySelector('.cdk-overlay-pane')?.classList.add('pp-rounded-dialog');
    });

    const dialogRef = this.dialog.open(SelectDialogComponent, {
      width: '480px',
      data: {
        title: 'Call Status',
        quality: 0,
        confirm: true,
        options: this.dataOptions,
        dropdownConfigs: this.dropdownConfigs
      }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (result) {
        const appointmentId = currentAppointmentId;
        const missCallId = result.selectionMap.Status?.value || 0;
        const isNoShow = result.isNoShow;

        this.appointmentsService.appointmentMisscall({
          appointmentId,
          missCallId,
          isNoShow
        }).subscribe({
          next: () => {

            this.fetchCandidateTracking();

            // const previousPage = this.currentFilterParams.page;
            // const focusedAppointmentId = appointmentId;

            // this.appointments = [];
            // this.currentFilterParams.page = 1;
            // this.hasMoreData = true;

            // const fetchCalls: Observable<any>[] = [this.fetchAppointments(false, false)];

            // for (let page = 2; page <= previousPage; page++) {
            //   this.currentFilterParams.page = page;
            //   fetchCalls.push(this.fetchAppointments(false, false));
            // }

            // forkJoin(fetchCalls).subscribe(() => {
            //   setTimeout(() => {
            //     const el = document.getElementById(`appointment-${focusedAppointmentId}`);
            //     if (el) {
            //       el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            //     }
            //   }, 500);
            // });
          },
          error: (err) => {
            console.error('API call error:', err);
          }
        });

      }
    });
  }

  onShowCallStatus(item: any) {
    const currentUserId = item.profile.userId;
    // this.historyData = this.getHistoryDataForUser(currentUserId);

    this.historyData = this.getHistoryDataForUser(item);

    const historyOptions: SelectOption[] = this.historyData.map((item, index) => ({
      value: index,
      label: `${item.date} ${item.time} ${item.status}`,
    }));

    const defaultSelected = historyOptions.slice(0, 2).map(opt => opt.value);

    this.dropdownConfigs = [
      {
        type: 'multi',
        label: 'History',
        options: historyOptions,
        isHistory: true,
        defaultSelected: defaultSelected
      }
    ];

    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
      document.querySelector('.cdk-overlay-pane')?.classList.add('pp-rounded-dialog');
    });

    const dialogRef = this.dialog.open(SelectDialogComponent, {
      width: '480px',
      data: {
        title: 'Call Status History',
        quality: 0,
        confirm: false,
        options: this.dataOptions,
        dropdownConfigs: this.dropdownConfigs
      }
    });

    dialogRef.afterClosed().subscribe((result: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');
    });
  }

  onSendMail(item: any) {
    console.log(item)

    const statusCall = item.interview.isCalled;
    if (statusCall !== 'complete') return;
    if (!item.interview.date) return;

    this.appointmentsService.getEmailTemplate(item.profile.appointmentId, 3).subscribe({
      next: (res) => {
        const container = document.querySelector('.cdk-overlay-container');
        container?.classList.add('dimmed-overlay');

        const dialogRef = this.dialog.open(MailDialogComponent, {
          width: '1140px',
          data: {
            title: 'Send Mail',
            quality: 0,
            confirm: true,
            options: this.dataOptions,
            dropdownConfigs: this.dropdownConfigs,
            dataMail: res
          }
        });

        dialogRef.afterClosed().subscribe(async (result: any) => {
          container?.classList.remove('dimmed-overlay');
          if (result) {
            const formData = result.formData as FormData;
            const from = formData.get('from') as string;
            const to = formData.get('to') as string;
            const subject = formData.get('subject') as string;
            const message = formData.get('message') as string;
            const attachments = formData.getAll('attachments') as File[];

            const emailAttachments = [];

            for (const file of attachments) {
              const base64Content = await this.fileToBase64(file);
              emailAttachments.push({
                fileName: file.name,
                content: base64Content,
                contentType: file.type
              });
            }

            const payload = {
              appointmentId: item.profile.appointmentId,
              fromEmail: from,
              fromName: res.formName,
              to: to,
              cc: [],
              bcc: [],
              subject: subject,
              body: message,
              isHtml: true,
              attachments: emailAttachments,
              priority: 0
            };

            this.appointmentsService.sendEmail(payload).subscribe({
              next: () => {

                this.fetchCandidateTracking();

                // const previousPage = this.currentFilterParams.page;]
                // const focusedAppointmentId = item.profile.appointmentId;

                // this.appointments = [];
                // this.currentFilterParams.page = 1;
                // this.hasMoreData = true;

                // const fetchCalls: Observable<any>[] = [this.fetchAppointments(true, false)];

                // for (let page = 2; page <= previousPage; page++) {
                //   this.currentFilterParams.page = page;
                //   fetchCalls.push(this.fetchAppointments(true, false));
                // }

                // forkJoin(fetchCalls).subscribe(() => {
                //   setTimeout(() => {
                //     const el = document.getElementById(`appointment-${focusedAppointmentId}`);
                //     if (el) {
                //       el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                //     }
                //   }, 500);
                // });
              },
              error: (err) => {
                console.error('Error Sent Mail:', err);

                this.notificationService.error('Error Sent Mail');
              }
            });
          }
        });

      },
      error: (err) => {
        console.error('Get Email Template Error:', err);
      }
    });
  }

  fileToBase64(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1]; // ตัดเอาเฉพาะ base64 หลัง comma
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // ===================== Comments =====================
  loadComments(applicantId: number) {
    if (!applicantId) return;
    this.commentsLoading = true;
    this.applicationService
      .getCommentsById(applicantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const items: ApiComment[] = Array.isArray(res?.items) ? res.items : [];
          this.commentsTree = items.map((c) => this.toViewComment(c));
          this.commentsLoading = false;
        },
        error: (e) => {
          console.error('[ApplicationForm] loadComments error:', e);
          this.commentsLoading = false;
        },
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
      replies: (c.replies || []).map((rc) => this.toViewComment(rc)),
      ui: {
        isReplying: false,
        replyText: '',
        isEditing: false,
        editText: c.commentText || '',
      },
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
            parentCommentId: null,
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
      parentCommentId: parent.id,
    };

    this.applicationService
      .addCommentByCandidateId(body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          parent.ui.isReplying = false;
          parent.ui.replyText = '';
          this.loadComments(this.applicantId);
        },
        error: (e) => console.error('[ApplicationForm] reply error:', e),
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

    this.applicationService
      .editCommentById(c.id, { commentText: text })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          c.ui.isEditing = false;
          this.loadComments(this.applicantId);
        },
        error: (e) => console.error('[ApplicationForm] edit comment error:', e),
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

      this.applicationService
        .deleteCommentById(c.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => this.loadComments(this.applicantId),
          error: (e) => console.error('[ApplicationForm] delete comment error:', e),
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

  // ===== Date helpers (UI แสดง DD/MM/YYYY) =====
  get canOpenDatePicker(): boolean {
    // เปิดปฏิทินของ Offer Result Date ได้เฉพาะตอนแก้ไข (เหมือนเดิมกับ logic editReview)
    return !!this.editReview;
  }

  // Start Date อยากให้เปิดได้ตลอดเหมือนเดิม (ไม่ผูกกับ editReview)
  get canOpenStartDatePicker(): boolean {
    return this.isActiveManager;
  }

  formatDateDDMMYYYY(v: any): string {
    if (!v) return '';
    // รองรับทั้ง ISO, 'YYYY-MM-DD', Date
    const d = dayjs(v);
    return d.isValid() ? d.format('DD/MM/YYYY') : '';
  }

  openDatePicker(inputEl: HTMLInputElement | null | undefined) {
    if (!inputEl) return;
    // เรียก native picker; fallback focus+click ถ้า browser ไม่รองรับ showPicker()
    const anyEl = inputEl as any;
    if (typeof anyEl.showPicker === 'function') {
      anyEl.showPicker();
    } else {
      inputEl.focus();
      inputEl.click();
    }
  }

  onDateBoxMouseDown(inputEl: HTMLInputElement, ev?: MouseEvent, allowAlways = false) {
    const canOpen = allowAlways ? this.canOpenStartDatePicker : this.canOpenDatePicker;
    if (!canOpen) return;
    // ป้องกัน selection/focus ไปที่ text แล้วสั่งเปิดปฏิทินแทน
    ev?.preventDefault?.();
    this.openDatePicker(inputEl);
  }

  // เมื่อ native <input type="date"> ของ Offer Result Date เปลี่ยนค่า
  onNativeDateChanged() {
    // คง workflow เดิมให้ครบ
    this.onDateInput();
    this.onDateChange();
  }
}
