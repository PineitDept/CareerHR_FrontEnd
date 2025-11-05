import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, Subject, switchMap, takeUntil } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { COMPOSITION_BUFFER_MODE, FormBuilder, FormControl, FormGroup } from '@angular/forms';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import { ApplicationService } from '../../../../services/application/application.service';
import { CandidatePagedResult } from '../../../../interfaces/Application/application.interface';
import { CandidateTracking } from '../../../../interfaces/Application/tracking.interface';
import { AlertDialogComponent } from '../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { ReasonService } from '../../../../services/admin-setting/reason/reason.service';
import { AlertDialogData } from '../../../../shared/interfaces/dialog/dialog.interface';
import { InterviewFormService } from '../../../../services/interview-scheduling/interview-form/interview-form.service';

dayjs.extend(utc);

// ===== Types (view) =====
type ResultGroupKey = 'accept' | 'decline'; // kept only if needed later (no UI usage now)
type CategoryOption = { categoryId: number; categoryName: string };

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
  selector: 'app-hire-result',
  templateUrl: './hire-result.component.html',
  styleUrl: './hire-result.component.scss',
  providers: [{ provide: COMPOSITION_BUFFER_MODE, useValue: false }],
})
export class HireResultComponent {
  // ===== Routing =====
  applicantId = 0;
  stageId = 0;
  idEmployee = 0;
  round: number = 1;
  isLatestRound = true;
  interview2AppointmentId: string | undefined;

  // ===== Applicant (header) =====
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
  private readonly cacheKeyBase = 'hire-result:';
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private fb: FormBuilder,
    private interviewFormService: InterviewFormService,
    private applicationService: ApplicationService,
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
      this.stageId = 4;
      this.idEmployee = Number(params['idEmployee']);

      this.fetchCandidateTracking();
      this.fetchRecruitmentStagesWithReasons(5); // hire state
      if (this.applicantId) this.loadComments(this.applicantId);
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
        dateInterviewReview: [this.formatDateForInput(this.foundisSummary?.stageDate) || this.today],
        noteInterviewReview: [this.foundisSummary?.notes || ''],
      },
      { updateOn: 'change' }
    );
  }

  private fetchCandidateTracking() {
    if (!this.applicantId) return;

    this.applicationService
      .getTrackingApplications({
        page: 1,
        pageSize: 20,
        search: String(this.applicantId),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        // next: (res: CandidatePagedResult<CandidateTracking>) => {
        //   const items = res?.items || [];
        //   if (!items.length) return;

        //   const exact = items.find((i) => Number(i.userID) === this.applicantId) || items[0];
        //   this.mapTrackingToView(exact);

        //   // Attachments (avatar)
        //   this.fetchFiles(Number(this.applicantId || 0));
        // },
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
        },
        error: (err) => {
          console.error('[ApplicationForm] getTrackingApplications error:', err);
        },
      });

    this.interviewFormService.getApplicantTracking(this.applicantId).subscribe({
      next: (res) => {
        const appointmentIdKey = `interview2AppointmentId`;
        const appointmentIdValue = res[appointmentIdKey];
        (this as any)[appointmentIdKey] = appointmentIdValue;
      },
      error: (err) => console.error(err),
    });
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
            this.editReview = true;
            this.allowEditButton = false;

            this.formDetails.patchValue(
              {
                dateInterviewReview: this.formatDateForInput(rawObj?.stageDate),
                noteInterviewReview: rawObj?.notes ?? '',
              },
              { emitEvent: false }
            );

            this.snapshotInputForm = this.buildServerBaselinePayload();
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

  // ===================== Mapping =====================
  private mapTrackingToView(ct: CandidateTracking) {
    this.applicant = {
      id: String(ct.userID ?? ''),
      name: ct.fullName || ct.fullNameTH || '—',
      gpa: Number(ct.gpa ?? 0),
      age: Number(ct.age ?? 0),
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
      graduation_year: ct.graduation_year,
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
      noshow: { fill: 'tw-bg-[#7f56d9] tw-text-white' },
      onhold: { fill: 'tw-bg-amber-500 tw-text-white' },
      default: { fill: 'tw-bg-white tw-text-gray-700' },
    };

    const tone =
      name.includes('decline offer')
        ? tones.decline
        : name.includes('onboarded')
          ? tones.accept
          : name.includes('no-show') || name.includes('no show')
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

    const categoryId = this.selectedCategoryId ?? null;

    const checkedCategoryIds = this.reasonsInterview1
      .filter((category) => category.rejectionReasons.some((reason: { checked: boolean }) => reason.checked === true))
      .map((category) => category.categoryId);

    const appointmentIdKey = `interview3AppointmentId`;
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
        confirm: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (!confirmed) return;

      this.clearDraftsForCurrentType();

      if (this.foundisSummary) {
        const payloadHistory = {
          // categoryId: checkedCategoryIds[0],
          categoryId,
          stageDate: isoDate,
          notes: payload.noteInterviewReview,
          selectedReasonIds: checkedReasonIds,
        };

        this.interviewFormService.updateCandidateStageHistory(this.foundisSummary.historyId, payloadHistory).subscribe({
          next: () => {
            this.fetchInterviewer();
            this.foundisSummary = this.reviewHistory.find((user) => user.isSummary === true);
            this.editReview = false;
            this.allowEditButton = true;
          },
          error: (err) => console.error('Error Rescheduled:', err),
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
          appointmentId: (appointmentId ?? '').trim(),
          satisfaction: 0,
          notes: payload.noteInterviewReview,
          strength: '',
          concern: '',
          selectedReasonIds: checkedReasonIds,
        };

        this.interviewFormService.postInterviewReview(transformedPayload).subscribe({
          next: () => {
            this.fetchInterviewer();
            this.foundisSummary = this.reviewHistory.find((user) => user.isSummary === true);
            this.editReview = false;
            this.allowEditButton = true;
          },
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
      categoryId: this.selectedCategoryId ?? null,
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

    this.clearDraftsForCurrentType();
  }

  onEditReview() {
    this.initializeForm();
    this.formDetails.enable();
    this.editReview = true;
    this.allowEditButton = false;

    const payload = this.formDetails.value;
    const isoDate = new Date(payload.dateInterviewReview).toISOString();

    const checkedReasonIds = this.reasonsInterview1.flatMap((category: { rejectionReasons: any[] }) =>
      category.rejectionReasons.filter((reason) => reason.checked === true).map((reason) => reason.reasonId)
    );

    const checkedCategoryIds = this.reasonsInterview1
      .filter((category) => category.rejectionReasons.some((reason: { checked: boolean }) => reason.checked === true))
      .map((category) => category.categoryId);

    const transformedPayload = {
      categoryId: this.selectedCategoryId ?? null,
      stageDate: isoDate,
      notes: payload.noteInterviewReview,
      selectedReasonIds: checkedReasonIds,
    };

    this.snapshotInputForm = transformedPayload;
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

  // ===================== Cache =====================
  private cacheKey(): string {
    return `${this.cacheKeyBase}${this.idEmployee || 'emp'}:${this.applicantId || 'app'}:${this.stageId || 'stage'}`;
  }

  private buildCurrentPayload() {
    const payload = this.formDetails?.value || {};
    const isoDate = payload?.dateInterviewReview ? new Date(payload.dateInterviewReview).toISOString() : '';

    const selectedReasonIds: number[] = (this.reasonsInterview1 || []).flatMap((category: any) =>
      (category.rejectionReasons || []).filter((r: any) => r.checked === true).map((r: any) => r.reasonId)
    );

    const checkedCategoryIds: number[] = (this.reasonsInterview1 || [])
      .filter((c: any) => (c.rejectionReasons || []).some((r: any) => r.checked))
      .map((c: any) => c.categoryId);

    const appointmentIdKey = `interview2AppointmentId`;
    const appointmentId = (this as any)[appointmentIdKey];

    return {
      applicationId: this.applicantId,
      stageId: this.stageId + 1,
      roundID: this.round,
      categoryId: checkedCategoryIds[0] ?? null,
      isSummary: true,
      stageDate: isoDate || '',
      appointmentId: (appointmentId ?? '').trim(),
      satisfaction: 0,
      notes: payload?.noteInterviewReview ?? '',
      strength: '',
      concern: '',
      selectedReasonIds,
    };
  }

  private buildServerBaselinePayload() {
    const s = this.foundisSummary || {};
    const iso = s.stageDate ? new Date(s.stageDate).toISOString() : '';

    const appointmentIdKey = `interview2AppointmentId`;
    const appointmentId = (this as any)[appointmentIdKey];

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
    };
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
    }
  }

  public clearDraftsForCurrentType(): void {
    sessionStorage.removeItem(this.cacheKey());
  }

  public hasFormChanged(): boolean {
    // เช็คเฉพาะตอนอยู่โหมดแก้ไข และต้องมี baseline แล้วเท่านั้น
    if (!this.editReview || !this.snapshotInputForm) return false;

    try {
      const current = this.buildCurrentPayload();
      const changed = JSON.stringify(current) !== JSON.stringify(this.snapshotInputForm);
      const hasDraft = !!sessionStorage.getItem(this.cacheKey());
      return hasDraft || changed;
    } catch {
      // กันพลาด: ถ้าเทียบไม่ได้ ให้ถือว่ามีการเปลี่ยนแปลง
      return true;
    }
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
    // เปิดปฏิทินได้เฉพาะตอนแก้ไข เหมือนพฤติกรรมฟอร์มเดิม
    return !!this.editReview;
  }

  formatDateDDMMYYYY(v: any): string {
    if (!v) return '';
    const d = dayjs(v);
    return d.isValid() ? d.format('DD/MM/YYYY') : '';
  }

  openDatePicker(inputEl: HTMLInputElement | null | undefined) {
    if (!inputEl) return;
    const anyEl = inputEl as any;
    if (typeof anyEl.showPicker === 'function') {
      anyEl.showPicker();
    } else {
      inputEl.focus();
      inputEl.click();
    }
  }

  onDateBoxMouseDown(inputEl: HTMLInputElement, ev?: MouseEvent) {
    if (!this.canOpenDatePicker) return;
    ev?.preventDefault?.();
    this.openDatePicker(inputEl);
  }

  // เมื่อ native <input type="date"> เปลี่ยนค่า
  onNativeDateChanged() {
    // คง workflow เดิมไว้
    this.onDateInput();
    this.onDateChange();
  }
}
