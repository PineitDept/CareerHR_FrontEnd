import { Component, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ReasonService } from '../../../../../../../../services/admin-setting/reason/reason.service';
import { Subject, takeUntil } from 'rxjs';
import { TablesComponent } from '../../../../../../../../shared/components/tables/tables.component';
import { Columns } from '../../../../../../../../shared/interfaces/tables/column.interface';
import { MatDialog } from '@angular/material/dialog';
import { CaptchaDialogComponent } from '../../../../../../../../shared/components/dialogs/captcha-dialog/captcha-dialog.component';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

type KnownCategory = 'Accept' | 'Decline' | 'No-Show' | 'On Hold' | 'Onboarded';

interface CategoryMeta {
  categoryId: number;
  categoryName: string;
  categoryType: string;
  isActive: boolean;
}

interface ReasonEntry {
  reasonId?: number;
  categoryId: number;
  categoryName: string;
  reasonText: string;
  isActive: boolean;
  createdAt?: string | null;
  usageCount?: number;
}

interface ReasonDetailsDraft {
  processId: number;
  processName: string;
  reasons: any[]; // โครงเดียวกับ buildReasonsPayload()
  timestamp: string;
}

@Component({
  selector: 'app-reason-details',
  templateUrl: './reason-details.component.html',
  styleUrl: './reason-details.component.scss'
})
export class ReasonDetailsComponent {
  @ViewChild('categoryAcceptTable') categoryAcceptTable!: TablesComponent;
  @ViewChild('categoryDeclineTable') categoryDeclineTable!: TablesComponent;
  @ViewChild('categoryNoShowTable') categoryNoShowTable!: TablesComponent;
  @ViewChild('categoryOnHoldTable') categoryOnHoldTable!: TablesComponent;
  @ViewChild('categoryOnboardedTable') categoryOnboardedTable!: TablesComponent;

  filterButtons: { label: string; key: string; color: string }[] = [];
  disabledKeys: string[] = [];

  formDetails!: FormGroup;
  private categoryMetaMap: Partial<Record<KnownCategory, CategoryMeta>> = {};
  isEditMode = false;
  private initialSnapshot = '';

  processName: string = '';
  processId: number = 0;

  private destroy$ = new Subject<void>();

  categoryColumns: Columns = [
    { header: 'No.', field: '__index', type: 'number', align: 'center', width: '7%' },
    { header: 'Details', field: 'reasonText', type: 'text', width: '75%', wrapText: true },
    { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '18%', textlinkActions: ['edit-inrow','delete'] },
  ];

  categoryAcceptRows: any[] = [];
  categoryDeclineRows: any[] = [];
  categoryNoShowRows: any[] = [];
  categoryOnHoldRows: any[] = [];
  categoryOnboardedRows: any[] = [];

  detailsRequiredFooterFields: string[] = ['reasonText'];

  isAddingAcceptRow = false;
  fieldAcceptErrors = false;
  duplicateAcceptRowIndex: number | null = null;

  isAddingDeclineRow = false;
  fieldDeclineErrors = false;
  duplicateDeclineRowIndex: number | null = null;

  isAddingNoShowRow = false;
  fieldNoShowErrors = false;
  duplicateNoShowRowIndex: number | null = null;

  isAddingOnHoldRow = false;
  fieldOnHoldErrors = false;
  duplicateOnHoldRowIndex: number | null = null;

  isAddingOnboardedRow = false;
  fieldOnboardedErrors = false;
  duplicateOnboardedRowIndex: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private reasonService: ReasonService,
    private fb: FormBuilder,
    private dialog: MatDialog,
  ) { }

  // ================= Lifecycle =================
  ngOnInit() {
    this.initializeForm();
    this.ensureFilterButtons();

    this.formDetails.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateSaveState();
    });

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.processName = params['processName'].split('-').join(' ') || '';
        this.processId = params['processId'] || 0;

        this.formDetails.patchValue({ processName: this.processName });

        this.fetchRecruitmentStagesWithReasons();
      });
  }

  initializeForm() {
    this.formDetails = this.fb.group({
      processName: [{ value: this.processName, disabled: true }],
    });
  }

  // ================= Draft helpers (sessionStorage) =================
  private getDraftKey(): string {
    return `reasonDetails:${this.processId || '0'}`;
  }

  private persistDraft() {
    const draft: ReasonDetailsDraft = {
      processId: this.processId,
      processName: this.formDetails.getRawValue().processName ?? this.processName,
      reasons: this.buildReasonsPayload(),
      timestamp: dayjs().utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]')
    };
    try {
      sessionStorage.setItem(this.getDraftKey(), JSON.stringify(draft));
    } catch {}
  }

  private removeDraft() {
    try {
      sessionStorage.removeItem(this.getDraftKey());
    } catch {}
  }

  // คืนชื่อ category key จาก block
  private getCategoryKeyFromBlock(block: any): KnownCategory | null {
    return this.normalizeCategoryName(block?.categoryName) ??
           this.normalizeCategoryName(block?.categoryType) ?? null;
  }

  // ใช้ blocks (reasons) จาก draft ทับค่าในตาราง
  private applyDraftFromBlocks(blocks: any[]) {
    if (!Array.isArray(blocks)) return;

    // เคลียร์สถานะ error/duplicate ทั้งหมด
    this.clearDuplicateFlags('Accept');
    this.clearDuplicateFlags('Decline');
    this.clearDuplicateFlags('No-Show');
    this.clearDuplicateFlags('On Hold');
    this.clearDuplicateFlags('Onboarded');

    const nextAccept: ReasonEntry[] = [];
    const nextDecline: ReasonEntry[] = [];
    const nextNoShow: ReasonEntry[] = [];
    const nextOnHold: ReasonEntry[] = [];
    const nextOnboarded: ReasonEntry[] = [];

    for (const b of blocks) {
      const key = this.getCategoryKeyFromBlock(b);
      if (!key || !Array.isArray(b.rejectionReasons)) continue;

      const rows: ReasonEntry[] = b.rejectionReasons.map((r: any) => ({
        reasonId: r.reasonId,
        categoryId: r.categoryId ?? this.categoryMetaMap[key]?.categoryId ?? 0,
        categoryName: r.categoryName ?? this.categoryMetaMap[key]?.categoryName ?? key,
        reasonText: r.reasonText,
        isActive: !!r.isActive,
        createdAt: r.createdAt ?? null,
        usageCount: r.usageCount ?? 0,
      }));

      switch (key) {
        case 'Accept':     nextAccept.push(...rows); break;
        case 'Decline':    nextDecline.push(...rows); break;
        case 'No-Show':    nextNoShow.push(...rows); break;
        case 'On Hold':    nextOnHold.push(...rows); break;
        case 'Onboarded':  nextOnboarded.push(...rows); break;
      }
    }

    if (nextAccept.length     || this.categoryMetaMap['Accept'])     this.categoryAcceptRows    = nextAccept;
    if (nextDecline.length    || this.categoryMetaMap['Decline'])    this.categoryDeclineRows   = nextDecline;
    if (nextNoShow.length     || this.categoryMetaMap['No-Show'])    this.categoryNoShowRows    = nextNoShow;
    if (nextOnHold.length     || this.categoryMetaMap['On Hold'])    this.categoryOnHoldRows    = nextOnHold;
    if (nextOnboarded.length  || this.categoryMetaMap['Onboarded'])  this.categoryOnboardedRows = nextOnboarded;
  }

  /**
   * เรียกหลัง populate ข้อมูลจาก server:
   * - ถ้ามี draft และ snapshot ของ draft ≠ server → เอา draft มาทับ + เข้าโหมดแก้ไข + เปิด Save
   * - ถ้า draft ตรงกับ server → ลบ draft ทิ้ง
   * @returns restored: boolean
   */
  private tryRestoreDraftAfterFetch(): boolean {
    const raw = sessionStorage.getItem(this.getDraftKey());
    if (!raw) return false;

    try {
      const draft = JSON.parse(raw) as ReasonDetailsDraft;
      const serverSnap = this.computeSnapshot();
      const draftSnap  = this.computeSnapshotFromReasons(draft.reasons || []);

      if (serverSnap === draftSnap) {
        this.removeDraft();
        return false;
      }

      // แตกต่าง → restore draft
      this.applyDraftFromBlocks(draft.reasons);

      // เข้าสู่โหมดแก้ไข + มาร์ก dirty + เปิดปุ่ม Save
      this.isEditMode = true;
      this.ensureFilterButtons();     // แสดงปุ่ม Save
      this.formDetails.markAsDirty(); // ให้หน้าเป็นสถานะแก้ไข
      this.updateSaveState();         // จะ enable Save + persistDraft ให้อัตโนมัติ
      return true;

    } catch {
      return false;
    }
  }

  // ================= Filter buttons =================
  private ensureFilterButtons() {
    if (this.isEditMode) {
      this.filterButtons = [{ label: 'Save', key: 'save', color: '#000055' }];
      this.setSaveEnabled(false);
    } else {
      this.filterButtons = [{ label: 'Edit', key: 'edit', color: '#000000' }];
      this.disabledKeys = [];
    }
  }

  private setSaveEnabled(enabled: boolean) {
    if (!this.isEditMode) return;
    const s = new Set(this.disabledKeys);
    if (enabled) s.delete('save'); else s.add('save');
    this.disabledKeys = Array.from(s);
  }

  // ================= Category helpers =================
  private normalizeCategoryName(name?: string): KnownCategory | null {
    if (!name) return null;
    const n = name.trim().toLowerCase();
    if (n === 'accept') return 'Accept';
    if (n === 'decline') return 'Decline';
    if (n === 'no-show' || n === 'no show' || n === 'noshow') return 'No-Show';
    if (n === 'on hold' || n === 'on-hold') return 'On Hold';
    if (n === 'onboarded' || n === 'on-boarded' || n === 'on boarded') return 'Onboarded';
    return null;
  }

  private resetCategoryRows() {
    this.categoryAcceptRows = [];
    this.categoryDeclineRows = [];
    this.categoryNoShowRows = [];
    this.categoryOnHoldRows = [];
    this.categoryOnboardedRows = [];
  }

  private populateCategoryTables(data: any[]) {
    this.resetCategoryRows();

    (data ?? []).forEach(item => {
      const key =
        this.normalizeCategoryName(item?.categoryName) ??
        this.normalizeCategoryName(item?.categoryType);

      if (!key) return;

      this.categoryMetaMap[key] = {
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        categoryType: item.categoryType,
        isActive: !!item.isActive,
      };

      const rows: ReasonEntry[] = (item?.rejectionReasons ?? []).map((r: any) => ({
        reasonId: r.reasonId,
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        reasonText: r.reasonText,
        isActive: !!r.isActive,
        createdAt: r.createdAt ?? null,
        usageCount: r.usageCount ?? 0,
      }));

      switch (key) {
        case 'Accept':     this.categoryAcceptRows = rows; break;
        case 'Decline':    this.categoryDeclineRows = rows; break;
        case 'No-Show':    this.categoryNoShowRows = rows; break;
        case 'On Hold':    this.categoryOnHoldRows = rows; break;
        case 'Onboarded':  this.categoryOnboardedRows = rows; break;
      }
    });
  }

  private getRows(category: KnownCategory): ReasonEntry[] {
    switch (category) {
      case 'Accept': return this.categoryAcceptRows;
      case 'Decline': return this.categoryDeclineRows;
      case 'No-Show': return this.categoryNoShowRows;
      case 'On Hold': return this.categoryOnHoldRows;
      case 'Onboarded': return this.categoryOnboardedRows;
    }
  }

  private setRows(category: KnownCategory, rows: ReasonEntry[]) {
    switch (category) {
      case 'Accept': this.categoryAcceptRows = rows; break;
      case 'Decline': this.categoryDeclineRows = rows; break;
      case 'No-Show': this.categoryNoShowRows = rows; break;
      case 'On Hold': this.categoryOnHoldRows = rows; break;
      case 'Onboarded': this.categoryOnboardedRows = rows; break;
    }
  }

  private markDuplicate(category: KnownCategory, index: number) {
    switch (category) {
      case 'Accept':    this.duplicateAcceptRowIndex = index; this.fieldAcceptErrors = true; break;
      case 'Decline':   this.duplicateDeclineRowIndex = index; this.fieldDeclineErrors = true; break;
      case 'No-Show':   this.duplicateNoShowRowIndex = index; this.fieldNoShowErrors = true; break;
      case 'On Hold':   this.duplicateOnHoldRowIndex = index; this.fieldOnHoldErrors = true; break;
      case 'Onboarded': this.duplicateOnboardedRowIndex = index; this.fieldOnboardedErrors = true; break;
    }
  }

  private clearDuplicateFlags(category: KnownCategory) {
    switch (category) {
      case 'Accept':    this.duplicateAcceptRowIndex = null; this.fieldAcceptErrors = false; break;
      case 'Decline':   this.duplicateDeclineRowIndex = null; this.fieldDeclineErrors = false; break;
      case 'No-Show':   this.duplicateNoShowRowIndex = null; this.fieldNoShowErrors = false; break;
      case 'On Hold':   this.duplicateOnHoldRowIndex = null; this.fieldOnHoldErrors = false; break;
      case 'Onboarded': this.duplicateOnboardedRowIndex = null; this.fieldOnboardedErrors = false; break;
    }
  }

  private findDuplicateIndex(category: KnownCategory, reasonText: string, ignoreIndex = -1): number {
    const t = (reasonText || '').trim().toLowerCase();
    const rows = this.getRows(category);
    return rows.findIndex((r, i) => i !== ignoreIndex && (r.reasonText || '').trim().toLowerCase() === t);
  }

  // ================= Load data =================
  fetchRecruitmentStagesWithReasons() {
    this.reasonService.getRecruitmentStagesWithReasons(this.processId).subscribe({
      next: (response) => {
        this.populateCategoryTables(response);

        // snapshot ปัจจุบัน (server)
        this.initialSnapshot = this.computeSnapshot();
        this.formDetails.markAsPristine();

        // พยายามกู้ draft; ถ้าไม่กู้ได้ → อยู่โหมด view
        const restored = this.tryRestoreDraftAfterFetch();
        if (!restored) {
          this.isEditMode = false;
          this.ensureFilterButtons();
        }
      },
      error: (error) => {
        console.error('Error fetching Recruitment Stages with reasons:', error);
        this.resetCategoryRows();
        this.initialSnapshot = this.computeSnapshot();
        this.isEditMode = false;
        this.ensureFilterButtons();
      },
    });
  }

  // ================= Filter bar clicks =================
  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit': this.onEditClicked(); break;
      case 'save': this.onSaveClicked(); break;
    }
  }

  onEditClicked() {
    this.isEditMode = true;
    this.ensureFilterButtons();   // แสดง Save (disabled)
    this.updateSaveState();       // ประเมินปุ่ม Save ตอนเข้าโหมด
  }

  onSaveClicked() {
    const payload = this.getFormPayload();
    console.log('SAVE payload:', payload);

    // TODO: เรียก service บันทึกจริงที่นี่

    // บันทึกสำเร็จ → รีเซ็ต snapshot/dirty และลบ draft
    this.initialSnapshot = this.computeSnapshot();
    this.formDetails.markAsPristine();
    this.removeDraft();
    this.updateSaveState();
  }

  // ================= Add/Edit/Delete rows =================
  onAddClicked(category: KnownCategory) {
    switch (category) {
      case 'Accept':    this.isAddingAcceptRow = true;    this.categoryAcceptTable.startInlineCreate({}, 'bottom'); break;
      case 'Decline':   this.isAddingDeclineRow = true;   this.categoryDeclineTable.startInlineCreate({}, 'bottom'); break;
      case 'No-Show':   this.isAddingNoShowRow = true;    this.categoryNoShowTable.startInlineCreate({}, 'bottom'); break;
      case 'On Hold':   this.isAddingOnHoldRow = true;    this.categoryOnHoldTable.startInlineCreate({}, 'bottom'); break;
      case 'Onboarded': this.isAddingOnboardedRow = true; this.categoryOnboardedTable.startInlineCreate({}, 'bottom'); break;
    }
  }

  onInlineSave(payload: {reasonText: string; isActive: boolean}, category: KnownCategory) {
    const meta = this.categoryMetaMap[category];
    if (!meta) return;

    this.clearDuplicateFlags(category);

    const dupIdx = this.findDuplicateIndex(category, payload.reasonText);
    if (dupIdx >= 0) { this.markDuplicate(category, dupIdx); return; }

    const newReason: ReasonEntry = {
      reasonText: payload.reasonText.trim(),
      isActive: payload.isActive ?? true,
      categoryId: meta.categoryId,
      categoryName: meta.categoryName,
      createdAt: null,
      usageCount: 0,
    };

    const rows = [...this.getRows(category), newReason];
    this.setRows(category, rows);
    this.onInlineCancel(category);

    this.formDetails.markAsDirty();
    this.updateSaveState();
  }

  onInlineCancel(category: KnownCategory) {
    switch (category) {
      case 'Accept':    this.isAddingAcceptRow = false; break;
      case 'Decline':   this.isAddingDeclineRow = false; break;
      case 'No-Show':   this.isAddingNoShowRow = false; break;
      case 'On Hold':   this.isAddingOnHoldRow = false; break;
      case 'Onboarded': this.isAddingOnboardedRow = false; break;
    }
    this.clearDuplicateFlags(category);
  }

  onInlineEditSave(updatedRow: ReasonEntry, category: KnownCategory) {
    const rows = this.getRows(category);
    const idx = rows.indexOf(updatedRow);
    if (idx === -1) return;

    this.clearDuplicateFlags(category);

    const dupIdx = this.findDuplicateIndex(category, updatedRow.reasonText, idx);
    if (dupIdx >= 0) { this.markDuplicate(category, dupIdx); return; }

    const next = [...rows];
    next[idx] = { ...rows[idx], reasonText: (updatedRow.reasonText || '').trim() };
    this.setRows(category, next);

    this.formDetails.markAsDirty();
    this.updateSaveState();
  }

  onDeleteRowClicked(row: ReasonEntry, category: KnownCategory) {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(CaptchaDialogComponent, {
      width: '520px',
      panelClass: 'custom-dialog-container',
      disableClose: true,
      data: {
        title: 'Delete',
        message: 'Are you sure you want to delete this item?',
        length: 6,
      }
    });

    dialogRef.afterClosed().subscribe((ok: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (!ok) return;

      const rows = this.getRows(category);
      const next = rows.filter(x => x !== row);
      this.setRows(category, next);

      this.clearDuplicateFlags(category);

      this.formDetails.markAsDirty();
      this.updateSaveState();
    });
  }

  // ================= Snapshot & Save-state logic =================
  private buildReasonsPayload() {
    const blocks: any[] = [];
    const use = (cat: KnownCategory) => {
      const meta = this.categoryMetaMap[cat];
      if (!meta) return;
      const rows = this.getRows(cat);
      if (!rows.length) return;

      blocks.push({
        categoryId: meta.categoryId,
        categoryName: meta.categoryName,
        categoryType: meta.categoryType,
        isActive: meta.isActive,
        rejectionReasons: rows.map((r): ReasonEntry => ({
          reasonId: r.reasonId,
          categoryId: meta.categoryId,
          categoryName: meta.categoryName,
          reasonText: r.reasonText,
          isActive: r.isActive ?? true,
          createdAt: r.createdAt ?? null,
          usageCount: r.usageCount ?? 0,
        })),
      });
    };
    (['Accept','Decline','No-Show','On Hold','Onboarded'] as KnownCategory[]).forEach(use);
    return blocks;
  }

  private getFormPayload() {
    const processName = this.formDetails.getRawValue().processName ?? this.processName;
    return { processName, reasons: this.buildReasonsPayload() };
  }

  private computeSnapshot(): string {
    return this.computeSnapshotFromReasons(this.buildReasonsPayload());
  }

  private computeSnapshotFromReasons(reasons: any[]): string {
    const blocks = (reasons || []).map(b => ({
      categoryId: b.categoryId,
      rejectionReasons: (b.rejectionReasons || []).map((r: ReasonEntry) => ({
        reasonId: r.reasonId ?? null,
        reasonText: (r.reasonText || '').trim(),
        isActive: !!r.isActive,
      }))
    }));
    return JSON.stringify(blocks);
  }

  private updateSaveState() {
    if (!this.isEditMode) return;
    const changed = this.formDetails.dirty || (this.initialSnapshot !== this.computeSnapshot());
    if (changed) this.persistDraft(); else this.removeDraft();
    this.setSaveEnabled(changed);
  }

  // ================= PendingDraftsAware-like API =================
  hasFormChanged(): boolean {
    return this.formDetails?.dirty || (this.initialSnapshot !== this.computeSnapshot());
  }

  hasPendingDrafts(): boolean {
    return !!sessionStorage.getItem(this.getDraftKey());
  }

  clearDraftsForCurrentType(): void {
    this.removeDraft();
  }
}
