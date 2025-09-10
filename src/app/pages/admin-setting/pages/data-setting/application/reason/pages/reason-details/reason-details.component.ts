import { Component, ElementRef, HostListener, NgZone, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ReasonService } from '../../../../../../../../services/admin-setting/reason/reason.service';
import { Subject, takeUntil } from 'rxjs';
import { Columns } from '../../../../../../../../shared/interfaces/tables/column.interface';
import { MatDialog } from '@angular/material/dialog';
import { CaptchaDialogComponent } from '../../../../../../../../shared/components/dialogs/captcha-dialog/captcha-dialog.component';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { NotificationService } from '../../../../../../../../shared/services/notification/notification.service';
import { ConnectedPosition } from '@angular/cdk/overlay';
import { ConfirmChangesDialogComponent } from '../../../../../../../../shared/components/dialogs/confirm-changes-dialog/confirm-changes-dialog.component';
import { ApiCategory, ApiReason, ApiRequestBody } from '../../../../../../../../interfaces/admin-setting/reason.interface';
dayjs.extend(utc);

type CategoryKey = string;

interface CategoryMeta {
  categoryId: number;
  categoryName: string;
  categoryType: string;
  isActive: boolean;
  isUnMatch: boolean;
}

interface ReasonEntry {
  reasonId?: number;
  categoryId: number | null;   // <<< รองรับ null ตอน detached
  categoryName: string;
  reasonText: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt?: string | null;
}

interface ReasonDetailsDraft {
  processId: number;
  processName: string;
  reasons: any[];
  timestamp: string;
}

interface CategoryBlock {
  key: CategoryKey;            // เช่น "Accept" หรือ "__new__<timestamp>"
  displayName: string;         // ชื่อที่แสดง (หมวดใหม่อิงจาก form control)
  meta: CategoryMeta | null;   // meta จาก server; หมวดใหม่เป็น null
  rows: ReasonEntry[];         // รายการเหตุผล
  // UI flags
  isNew: boolean;
  isEditingName: boolean;
  isAdding: boolean;
  fieldErrors: boolean;
  duplicateIndex: number | null;

  active: boolean; // แทน isActive ของกล่อง (อ่านจาก meta ตอน fetch, เริ่มต้น true สำหรับหมวดใหม่)
}

interface UnmappedCategory {
  categoryId: number;
  categoryName: string;
  categoryType: string;
  isActive: boolean;
  createdAt: string;
  recruitmentReasonsCount: number;
}

@Component({
  selector: 'app-reason-details',
  templateUrl: './reason-details.component.html',
  styleUrl: './reason-details.component.scss'
})
export class ReasonDetailsComponent {
  // ================= State หลัก =================
  filterButtons: { label: string; key: string; color: string }[] = [];
  disabledKeys: string[] = [];

  formDetails!: FormGroup;
  isEditMode = false;
  private initialSnapshot = '';

  processName = '';
  processId = 0;

  private destroy$ = new Subject<void>();

  // ตาราง (columns เดิม)
  categoryColumns: Columns = [
    { header: 'No.', field: '__index', type: 'number', align: 'center', width: '7%' },
    { header: 'Details', field: 'reasonText', type: 'text', width: '75%', wrapText: true },
    { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '18%', textlinkActions: ['edit-inrow','delete'] },
  ];
  detailsRequiredFooterFields: string[] = ['reasonText'];

  // กลุ่มหมวดแบบ dynamic
  categoryBlocks: CategoryBlock[] = [];

  @ViewChildren('catBlock') catBlockEls!: QueryList<ElementRef<HTMLElement>>;

  // ====== STATE: เก็บรายการ unmapped + dropdown ต่อ index ======
  unmappedAll: UnmappedCategory[] = [];
  filteredUnmapped: Partial<Record<number, UnmappedCategory[]>> = {};
  selectedUnmapped: Record<number, UnmappedCategory | null> = {};
  activeUnmappedIndex: Record<number, number> = {};  // ไว้ไฮไลท์ option ระหว่างกดลูกศร
  private unmappedOpenFor: number | null = null;

  // ตำแหน่ง overlay (บน/ล่าง)
  overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top',    overlayX: 'start', overlayY: 'bottom' },
  ];

  /** กัน onBlur ทำงานทับระหว่างกดเลือก option */
  private suppressNextBlur = false;

  // ===== เก็บความกว้าง overlay ต่อ index =====
  overlayWidth: Record<number, number> = {};

  private initialPayloadForDiff: { processName: string; reasons: any[] } | null = null;

  isSaving = false;

  constructor(
    private route: ActivatedRoute,
    private reasonService: ReasonService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private notify: NotificationService,
  ) {}

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
        this.processName = (params['processName'] || '').split('-').join(' ');
        this.processId = Number(params['processId'] || 0);

        this.formDetails.patchValue({ processName: this.processName });
        this.fetchRecruitmentStagesWithReasons();
      });
  }

  // ================= Reactive form =================
  initializeForm() {
    this.formDetails = this.fb.group({
      processName: [{ value: this.processName, disabled: true }],
      categories: this.fb.array([]), // สำหรับชื่อหมวด (เฉพาะหมวดใหม่จะ editable)
    });
  }

  get categoriesForm(): FormArray {
    return this.formDetails.get('categories') as FormArray;
  }

  getCategoryFormAt(i: number): FormGroup {
    return this.categoriesForm.at(i) as FormGroup;
  }

  private createCategoryFormGroup(name: string, isNew: boolean): FormGroup {
    return this.fb.group({
      categoryName: [{ value: name, disabled: !isNew }],
    });
  }

  private resetCategoriesForm() {
    this.formDetails.setControl('categories', this.fb.array([]));
  }

  // ================= Draft helpers (sessionStorage) =================
  private getDraftKey(): string {
    return `reasonDetails:${this.processId || '0'}`;
  }

  private persistDraft() {
    const draft: ReasonDetailsDraft = {
      processId: this.processId,
      processName: this.formDetails.getRawValue().processName ?? this.processName,
      reasons: this.buildReasonsPayload(), // รวมหมวดทั้งหมด (แม้ว่าง)
      timestamp: dayjs().utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
    };
    try { sessionStorage.setItem(this.getDraftKey(), JSON.stringify(draft)); } catch {}
  }

  private removeDraft() {
    try { sessionStorage.removeItem(this.getDraftKey()); } catch {}
  }

  // ================= ปุ่มบน Filter bar =================
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
    enabled ? s.delete('save') : s.add('save');
    this.disabledKeys = Array.from(s);
  }

  onFilterButtonClick(key: string) {
    if (key === 'edit') this.onEditClicked();
    if (key === 'save') this.onSaveClicked();
  }

  onEditClicked() {
    this.isEditMode = true;
    this.ensureFilterButtons();
    this.updateSaveState();
  }

  onSaveClicked() {
    const v = this.validateNewCategoriesBeforeSave();
    if (!v.ok) {
      this.notify.error(v.message || 'New category is incomplete.');

      // narrow index ให้เป็น number ก่อนใช้งาน
      const idx = typeof v.index === 'number' ? v.index : -1;

      if (idx >= 0) {
        if (v.code === 'MISSING_NAME' || v.code === 'DUPLICATE_NAME') {
          this.categoryBlocks[idx].isEditingName = true;
          setTimeout(() => {
            this.scrollToCategoryIndex(idx);
            this.focusCategoryNameInput(idx);
          }, 0);
        } else {
          setTimeout(() => this.scrollToCategoryIndex(idx), 0);
        }
      }
      return; // ยกเลิก save
    }

    // === สร้าง summary สำหรับยืนยัน ===
    const groups = this.buildChangeSummary();

    // ถ้าไม่มีอะไรเปลี่ยนเลย ก็ไม่ต้องคอนเฟิร์ม
    if (!groups.length) {
      this.notify.info('No changes to save.');
      return;
    }

    Promise.resolve().then(() => {
      document.querySelector('.cdk-overlay-container')?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(ConfirmChangesDialogComponent, {
      width: '860px',
      panelClass: 'custom-dialog-container',
      disableClose: true,
      data: {
        title: 'Confirm Changes',
        groups,
      }
    });

    dialogRef.afterClosed().subscribe((ok: boolean) => {
      document.querySelector('.cdk-overlay-container')?.classList.remove('dimmed-overlay');
      if (!ok) return;

      // สร้าง payload สำหรับ API (คัดทิ้ง category ที่ไม่เปลี่ยน)
      const payloadForApi = this.buildApiRequest();

      // กันกดซ้ำ
      if (this.isSaving) return;
      this.isSaving = true;
      this.setSaveEnabled(false);

      this.reasonService.updateReasonsOfRecruitmentStage(payloadForApi)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            // รีเฟรช baseline ให้ตรงกับสิ่งที่เพิ่งเซฟ
            this.initialSnapshot = this.computeSnapshot();
            this.initialPayloadForDiff = this.getFormPayload();
            this.formDetails.markAsPristine();
            this.removeDraft();
            this.updateSaveState();

            this.notify.success('Saved successfully.');
            // ถ้าต้องการรีเฟรชข้อมูลจากเซิร์ฟเวอร์ (กันสเตต stale) ให้เรียกซ้ำ:
            this.fetchRecruitmentStagesWithReasons();
          },
          error: (err) => {
            const msg = (err?.error?.message || err?.message || 'Save failed. Please try again.') as string;
            this.notify.error(msg);
            this.setSaveEnabled(true); // เปิดปุ่มให้ลองใหม่
          }
        }).add(() => {
          this.isSaving = false;
        });
    });
  }

  // ================= โหลดข้อมูล =================
  fetchRecruitmentStagesWithReasons() {
    console.log('fetchRecruitmentStagesWithReasons');
    this.reasonService.getRecruitmentStagesWithReasons(this.processId).subscribe({
      next: (response) => {
        // 1) สร้าง blocks จาก server
        this.categoryBlocks = [];
        this.resetCategoriesForm();

        (response ?? []).forEach((item: any) => {
          const display = (item?.categoryName || item?.categoryType || '').toString();
          const meta: CategoryMeta = {
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            categoryType: item.categoryType,
            isActive: !!item.isActive,
            isUnMatch: !!item.isUnMatch,
          };

          const rows: ReasonEntry[] = (item?.rejectionReasons ?? []).map((r: any) => ({
            reasonId: r.reasonId,
            categoryId: r.categoryId,
            categoryName: r.categoryName,
            reasonText: r.reasonText,
            isActive: !!r.isActive,
            isDeleted: !!r.isDeleted,
            createdAt: r.createdAt ?? null,
          }));

          this.categoryBlocks.push({
            key: display || String(item.categoryId || Math.random()),
            displayName: display,
            meta,
            rows,
            isNew: false,
            isEditingName: false,
            isAdding: false,
            fieldErrors: false,
            duplicateIndex: null,
            active: !!meta.isActive, // ใช้ค่า active จาก server
          });
          const idx = this.categoryBlocks.length - 1;
          this.categoriesForm.push(this.createCategoryFormGroup(display, /*isNew*/ false));
        });

        this.loadUnmappedReasonCategories();

        // 2) สร้าง snapshot ฝั่ง server
        this.initialSnapshot = this.computeSnapshot();
        this.initialPayloadForDiff = this.getFormPayload();
        this.formDetails.markAsPristine();

        // 3) พยายามกู้ draft; ถ้ากู้ไม่ได้ → view mode
        const restored = this.tryRestoreDraftAfterFetch();
        if (!restored) {
          this.isEditMode = false;
          this.ensureFilterButtons();
        }
      },
      error: (error) => {
        console.error('Error fetching Recruitment Stages with reasons:', error);
        this.categoryBlocks = [];
        this.resetCategoriesForm();
        this.initialSnapshot = this.computeSnapshot();
        this.isEditMode = false;
        this.ensureFilterButtons();
      },
    });
  }

  private loadUnmappedReasonCategories() {
    this.reasonService.getUnmappedReasonCategories(this.processId).subscribe({
      next: (res: UnmappedCategory[]) => {
        this.unmappedAll = Array.isArray(res) ? res : [];
        this.seedSelectedFromState();
      },
      error: () => { this.unmappedAll = []; }
    });
  }


  // กู้ draft: ถ้า snapshot draft ≠ server → ใช้ draft ทับ + เข้าสู่โหมดแก้ไข
  private tryRestoreDraftAfterFetch(): boolean {
    const raw = sessionStorage.getItem(this.getDraftKey());
    if (!raw) return false;

    try {
      const draft = JSON.parse(raw) as ReasonDetailsDraft;
      const serverSnap = this.computeSnapshot();
      const draftSnap  = this.computeSnapshotFromReasons(draft.reasons || []);
      if (serverSnap === draftSnap) { this.removeDraft(); return false; }

      // ใช้ draft มาทับ
      this.applyDraftBlocks(draft.reasons || []);
      this.isEditMode = true;
      this.ensureFilterButtons();
      this.formDetails.markAsDirty();
      this.updateSaveState();
      return true;
    } catch {
      return false;
    }
  }

  // ใช้ blocks (draft.reasons) map ทับ state ปัจจุบัน; ถ้าไม่พบหมวด → สร้างหมวดใหม่ (isNew)
  private applyDraftBlocks(blocks: any[]) {
    const norm = (s: string) => (s || '').trim().toLowerCase();

    // 0) เคลียร์คิวก่อน
    this.unmatchQueue = [];

    // 0.1) หา entry ที่เป็น unmatched (จาก draft)
    const unmatchedBlocks = (blocks || []).filter(b => !!b?.isUnMatch);
    const normalBlocks    = (blocks || []).filter(b => !b?.isUnMatch);

    // 0.2) สำหรับ unmatched: เก็บเข้าคิว + ลบออกจาก UI ถ้ายังมีอยู่
    unmatchedBlocks.forEach(b => {
      const categoryId = b?.categoryId ?? 0;
      const categoryName = (b?.categoryName || b?.categoryType || '').toString();

      // จดจำ
      this.unmatchQueue.push({
        categoryId,
        categoryName,
        categoryType: b?.categoryType || categoryName,
      });

      // ลบการ์ดถ้ามีอยู่ใน UI
      const idx = this.categoryBlocks.findIndex(cb =>
        (categoryId && cb.meta?.categoryId === categoryId) ||
        (!!categoryName && norm(cb.displayName) === norm(categoryName))
      );
      if (idx >= 0) {
        this.categoryBlocks.splice(idx, 1);
        this.categoriesForm.removeAt(idx);
      }
    });

    // 1) ทำงานส่วนเดิมสำหรับบล็อกปกติ (ไม่ใช่ unmatched)
    const findCatIndex = (b: any): number => {
      const id = b?.categoryId ?? null;
      const name = norm(b?.categoryName || b?.categoryType || '');
      return this.categoryBlocks.findIndex(cb =>
        (id && cb.meta?.categoryId === id) ||
        (!!name && norm(cb.displayName) === name)
      );
    };

    normalBlocks.forEach(b => {
      const rr: ReasonEntry[] = (b?.rejectionReasons ?? []).map((r: any) => ({
        reasonId: r.reasonId,
        categoryId: r.categoryId ?? b.categoryId ?? 0,
        categoryName: r.categoryName ?? b.categoryName ?? '',
        reasonText: r.reasonText,
        isActive: !!r.isActive,
        isDeleted: !!r.isDeleted,
        createdAt: r.createdAt ?? null,
      }));

      const idx = findCatIndex(b);
      const isActive = (typeof b?.isActive === 'boolean') ? !!b.isActive : true;
      if (idx >= 0) {
        this.categoryBlocks[idx].rows = rr;
        this.categoryBlocks[idx].active = isActive; // sync active จาก draft
      } else {
        const display = (b?.categoryName || b?.categoryType || '').toString();
        this.categoryBlocks.push({
          key: `__new__${Date.now()}_${Math.random()}`,
          displayName: display,
          meta: null,
          rows: rr,
          isNew: true,
          isEditingName: (typeof b?.draftIsEditingName === 'boolean')
                          ? !!b.draftIsEditingName
                          : true,
          isAdding: false,
          fieldErrors: false,
          duplicateIndex: null,
          active: isActive,
        });
        const idx2 = this.categoryBlocks.length - 1;
        this.categoriesForm.push(this.createCategoryFormGroup(display, /*isNew*/ true));
      }
    });
  }

  // ================= Actions: เพิ่มหมวด & เพิ่มแถว =================
  onAddReasonCategoryClicked() {
    if (!this.isEditMode) return;

    // ถ้ามีหมวดใหม่ที่ยังไม่ครบ → กันไว้ + ชี้เป้า
    const issue = this.findFirstNewCategoryIssue();
    if (issue) {
      this.notify.error(this.issueToMessage(issue));

      const idx = issue.index;
      // เปิดโหมดแก้ชื่อ ถ้าเป็นปัญหาเรื่องชื่อ
      if (issue.code === 'MISSING_NAME' || issue.code === 'DUPLICATE_NAME') {
        this.categoryBlocks[idx].isEditingName = true;
        setTimeout(() => {
          this.scrollToCategoryIndex(idx);
          this.focusCategoryNameInput(idx);
        }, 0);
      } else {
        setTimeout(() => this.scrollToCategoryIndex(idx), 0);
      }
      return;
    }

    // --- เดิม: สร้างหมวดใหม่ได้ เมื่อไม่มีหมวดใหม่ที่ค้าง ---
    const key = `__new__${Date.now()}`;
    this.categoryBlocks.push({
      key,
      displayName: '',
      meta: null,
      rows: [],
      isNew: true,
      isEditingName: true,
      isAdding: false,
      fieldErrors: false,
      duplicateIndex: null,
      active: true, // new category เริ่มต้นเปิดใช้งาน
    });
    const idx = this.categoryBlocks.length - 1;
    this.categoriesForm.push(this.createCategoryFormGroup('', /*isNew*/ true));
    this.formDetails.markAsDirty();
    this.updateSaveState();

    setTimeout(() => this.scrollToCategoryIndex(idx), 0);
  }

  onAddRowClicked(index: number) {
    if (!this.isEditMode) return;
    const cat = this.categoryBlocks[index];
    if (!cat) return;
    cat.isAdding = true; // footer add mode ของ <app-tables>
    this.updateSaveState(); // ถือเป็นการแก้ไขโครงสร้าง (เปิดปุ่ม Save)
  }

  onConfirmCategoryName(index: number) {
    if (!this.isEditMode) return;

    const ctrl = this.getCategoryFormAt(index).get('categoryName');
    const name = (ctrl?.value || '').trim();

    if (!name) { this.notify.error('Please enter a category name.'); return; }
    if (this.isCategoryNameDuplicate(name, index)) {
      this.notify.error('This category name already exists.');
      return;
    }

    // คอมมิตชื่อ (เก็บจริง)
    this.categoryBlocks[index].displayName = name;
    this.categoryBlocks[index].isEditingName = false;

    // อัปเดตค่าในคอนโทรลแต่ไม่ปล่อย valueChanges (กัน side-effects)
    ctrl?.setValue(name, { emitEvent: false });

    // ====== ถ้าชื่อตรงกับ option ใน dropdown ให้ใช้ categoryId ไปดึงเหตุผลมาเติม ======
    // 1) หา option ที่เลือก/ตรงชื่อ
    const selected = this.selectedUnmapped[index]
      ?? this.unmappedAll.find(x => (x.categoryName || '').trim().toLowerCase() === name.toLowerCase());

    if (selected) {
      // 2) อัปเดต meta ให้การ์ด (new category) อ้างไปยัง category จริง
      this.categoryBlocks[index].meta = {
        categoryId: selected.categoryId,
        categoryName: selected.categoryName,
        categoryType: selected.categoryType,
        isActive: selected.isActive,
        isUnMatch: false,
      };

      // 3) ดึง reasons ของ category นี้มาเติม (merge กันซ้ำ)
      this.fetchAndFillReasonsFor(index, selected.categoryId, selected.categoryName);
    }

    // ถือว่าเป็นการแก้ไขจริงแล้ว
    this.formDetails.markAsDirty();
    this.updateSaveState();
    this.ensureLinkState(index);
  }

  onEditCategoryName(index: number) {
    if (!this.isEditMode) return;
    this.categoryBlocks[index].isEditingName = true;
    this.getCategoryFormAt(index).get('categoryName')?.setValue(this.categoryBlocks[index].displayName ?? '');
  }

  private isCategoryNameDuplicate(name: string, ignoreIndex: number): boolean {
    const n = (name || '').trim().toLowerCase();
    return this.categoryBlocks.some((b, i) =>
      i !== ignoreIndex && (b.displayName || '').trim().toLowerCase() === n
    );
  }

  /** เก็บหมวดที่ผู้ใช้กด Unmatch (ถูกลบออกจาก UI) เพื่อส่ง isUnMatch:true ตอน save */
  private unmatchQueue: Array<{
    categoryId: number;
    categoryName: string;
    categoryType: string;
  }> = [];

  onUnmatchClicked(index: number) {
    if (!this.isEditMode) return;

    const cat = this.categoryBlocks[index];
    if (!cat) return;

    // อนุญาตให้ Unmatch ได้เฉพาะหมวดที่ฝั่ง fetch ระบุว่า isUnMatch:true
    if (!cat.meta?.isUnMatch) {
      // กันพลาดจากการเรียกตรง ๆ
      this.notify.error('This category cannot be unmatched.');
      return;
    }

    // จดจำไว้สำหรับ payload ตอน save
    this.unmatchQueue.push({
      categoryId: cat.meta.categoryId,
      categoryName: cat.meta.categoryName || cat.displayName || '',
      categoryType: cat.meta.categoryType || cat.displayName || '',
    });

    // ลบการ์ดออกจาก UI + ลบฟอร์มคอนโทรลของชื่อหมวดตำแหน่งเดียวกัน
    this.categoryBlocks.splice(index, 1);
    this.categoriesForm.removeAt(index);

    // mark dirty + อัปเดตปุ่ม Save + เขียน draft
    this.formDetails.markAsDirty();
    this.updateSaveState();
  }

  onCancelNewCategory(index: number) {
    const cat = this.categoryBlocks[index];
    if (!cat || !cat.isNew) return;

    // ลบการ์ดออกจาก UI + ลบฟอร์มคอนโทรลชื่อหมวด
    this.categoryBlocks.splice(index, 1);
    this.categoriesForm.removeAt(index);

    // อัปเดตสถานะการเปลี่ยนแปลง
    this.formDetails.markAsDirty();
    this.updateSaveState();
  }

  // ================= Add/Edit/Delete rows ของแต่ละหมวด =================
  private findDupIndex(rows: ReasonEntry[], reasonText: string, ignoreIndex = -1): number {
    const t = (reasonText || '').trim().toLowerCase();
    return rows.findIndex((r, i) => i !== ignoreIndex && (r.reasonText || '').trim().toLowerCase() === t);
  }

  onInlineSave(payload: { reasonText: string; isActive: boolean }, index: number) {
    const cat = this.categoryBlocks[index];
    if (!cat) return;

    // clear error flags
    cat.fieldErrors = false;
    cat.duplicateIndex = null;

    const dupIdx = this.findDupIndex(cat.rows, payload.reasonText);
    if (dupIdx >= 0) { cat.fieldErrors = true; cat.duplicateIndex = dupIdx; return; }

    const categoryName = this.getCategoryName(index);
    const categoryId   = cat.meta?.categoryId ?? null;  // <<< ถ้า detached = null

    const newReason: ReasonEntry = {
      reasonText: (payload.reasonText || '').trim(),
      isActive: payload.isActive ?? true,
      isDeleted: true,
      categoryId,
      categoryName: categoryName || (cat.meta?.categoryName ?? ''),
      createdAt: null,
    };

    cat.rows = [...cat.rows, newReason];
    cat.isAdding = false;

    this.formDetails.markAsDirty();
    this.updateSaveState();
  }

  onInlineCancel(index: number) {
    const cat = this.categoryBlocks[index];
    if (!cat) return;
    cat.isAdding = false;
    cat.fieldErrors = false;
    cat.duplicateIndex = null;
  }

  onInlineEditSave(updatedRow: ReasonEntry, index: number) {
    const cat = this.categoryBlocks[index];
    if (!cat) return;

    const rows = cat.rows;
    const idx = rows.indexOf(updatedRow);
    if (idx === -1) return;

    cat.fieldErrors = false;
    cat.duplicateIndex = null;

    const nextText = (updatedRow.reasonText || '').trim();

    // กันซ้ำตามเดิม
    const dupIdx = this.findDupIndex(rows, nextText, idx);
    if (dupIdx >= 0) { cat.fieldErrors = true; cat.duplicateIndex = dupIdx; return; }

    // อัปเดตให้เป็น reference ใหม่เสมอ
    const next = [...rows];
    next[idx] = { ...rows[idx], reasonText: nextText };
    cat.rows = next;

    // เรียกเสมอ เพื่อให้ snapshot ล่าสุดถูกเขียน/ลบ draft ให้ตรง
    this.updateSaveState();

    // (ถ้าต้องการให้ปุ่ม Save เปิดเฉพาะต่างจาก baseline)
    // ไม่ต้อง markAsDirty ที่นี่ก็ได้ ปล่อยให้ updateSaveState ใช้ snapshot เทียบเอง
    // แต่ถ้าต้องการเปิดปุ่ม Save เมื่อแก้แม้เท่ากับ baseline ให้ปล่อย markAsDirty:
    // this.formDetails.markAsDirty();
  }

  onDeleteRowClicked(row: ReasonEntry, index: number) {
    const cat = this.categoryBlocks[index];
    if (!cat) return;

    if (!row.isDeleted) {
      this.notify.error('This reason cannot be deleted.');
      return;
    }

    Promise.resolve().then(() => {
      document.querySelector('.cdk-overlay-container')?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(CaptchaDialogComponent, {
      width: '520px',
      panelClass: 'custom-dialog-container',
      disableClose: true,
      data: { title: 'Delete', message: 'Are you sure you want to delete this item?', length: 6 },
    });

    dialogRef.afterClosed().subscribe((ok: boolean) => {
      document.querySelector('.cdk-overlay-container')?.classList.remove('dimmed-overlay');
      if (!ok) return;

      cat.rows = cat.rows.filter(x => x !== row);
      cat.fieldErrors = false;
      cat.duplicateIndex = null;

      this.formDetails.markAsDirty();
      this.updateSaveState();
    });
  }

  // ================= Snapshot / Payload / Save-state =================
  private getCategoryName(index: number): string {
    return (this.categoryBlocks[index]?.displayName || '').toString();
  }

  private normalizeName(s: string): string {
    return (s || '').trim().toLowerCase();
  }

  private buildReasonsPayload() {
    const normal = this.categoryBlocks.map((cb, i) => {
      const name = this.getCategoryName(i);
      return {
        categoryId: cb.meta?.categoryId ?? null,
        categoryName: name || cb.meta?.categoryName || cb.displayName || '',
        categoryType: cb.meta?.categoryType ?? (name || cb.displayName || ''),
        isActive: cb.active,// ใช้ active จากกล่อง

        isUnMatch: false,                         // ปกติ “ยังไม่ได้ unmatch”
        canUnmatch: cb.meta?.isUnMatch ?? false,  // สิทธิ์กด unmatch

        // ===== เก็บสถานะแก้ชื่อเฉพาะหมวดใหม่ไว้ใน draft =====
        draftIsEditingName: cb.isNew ? cb.isEditingName : undefined,

        rejectionReasons: (cb.rows || []).map((r: ReasonEntry) => ({
          reasonId: r.reasonId,
          categoryId: (r as any).categoryId ?? cb.meta?.categoryId ?? null,
          categoryName: name || cb.meta?.categoryName || '',
          reasonText: r.reasonText,
          isActive: r.isActive ?? true,
          isDeleted: r.isDeleted, // <<< เคารพค่าของ row (detached = true, ของ API = ตาม server)
          createdAt: r.createdAt ?? null,
        })),
      };
    });

    const unmatched = this.unmatchQueue.map(u => ({
      categoryId: u.categoryId,
      categoryName: u.categoryName,
      categoryType: u.categoryType || u.categoryName,
      isActive: true,

      // อันนี้คือ “ผู้ใช้กด unmatch แล้ว”
      isUnMatch: true,

      // (optional) จะส่ง canUnmatch หรือไม่ก็ได้
      canUnmatch: true,

      rejectionReasons: [] as any[],
    }));

    return [...normal, ...unmatched];
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
      categoryId: (b.categoryId ?? null), // <<< เก็บ null ไว้ตามจริง
      categoryName: this.normalizeName(b.categoryName || b.categoryType || ''),
      isActive: !!b.isActive,     // track การเปลี่ยน active
      // เก็บไว้ได้แต่ไม่ใช้เป็นเงื่อนไขลบหมวดปกติ
      isUnMatch: !!b.isUnMatch,
      canUnmatch: !!b.canUnmatch,
      rejectionReasons: (b.rejectionReasons || []).map((r: ReasonEntry) => ({
        reasonId: r.reasonId ?? null,
        reasonText: (r.reasonText || '').trim(),
        isActive: !!r.isActive,
        isDeleted: !!(r as any).isDeleted,
      })),
    }));
    return JSON.stringify(blocks);
  }

  private updateSaveState() {
    if (!this.isEditMode) return;

    const snapChanged = (this.initialSnapshot !== this.computeSnapshot());

    if (snapChanged) {
      // มีความเปลี่ยนแปลงจริง
      this.persistDraft();
      this.setSaveEnabled(true);
      // ให้ฟอร์ม dirty เสมอเมื่อมี diff (เพื่อป้องกันกรณีบางที่ไม่ได้ markAsDirty)
      if (!this.formDetails.dirty) this.formDetails.markAsDirty();
    } else {
      // ไม่มี diff แล้ว → ลบ draft + ปิดปุ่ม + รีเซ็ตสถานะฟอร์ม
      this.removeDraft();
      this.setSaveEnabled(false);
      if (this.formDetails.dirty) this.formDetails.markAsPristine();
    }
  }

  private validateNewCategoriesBeforeSave(): {
    ok: boolean;
    message?: string;
    index?: number;
    rowIndex?: number;
    code?: 'MISSING_NAME' | 'DUPLICATE_NAME' | 'NO_ROWS' | 'EMPTY_ROW' | 'DUPLICATE_ROW';
  } {
    // เช็คชื่อทุกหมวด (กันตั้งชื่อว่าง/ซ้ำ)
    for (let i = 0; i < this.categoryBlocks.length; i++) {
      const b = this.categoryBlocks[i];
      const name = (this.getCategoryName(i) || '').trim();

      if (!name && b.isNew) {
        return { ok: false, message: 'Please fill in the new category name.', index: i, code: 'MISSING_NAME' };
      }
      if (!!name && this.isCategoryNameDuplicate(name, i)) {
        return { ok: false, message: `Category "${name}" already exists.`, index: i, code: 'DUPLICATE_NAME' };
      }
    }

    // เช็คเฉพาะ "หมวดใหม่" ต้องมีชื่อ + มีแถว reason อย่างน้อย 1 และไม่ว่าง/ไม่ซ้ำ
    const newBlocks = this.categoryBlocks.map((b, i) => ({ b, i })).filter(x => x.b.isNew);
    for (const { b, i } of newBlocks) {
      const name = (this.getCategoryName(i) || '').trim();
      if (!name) return { ok: false, message: 'Please fill in the new category name.', index: i, code: 'MISSING_NAME' };

      if (!b.rows || b.rows.length === 0) {
        return { ok: false, message: `Please add at least one reason in "${name}".`, index: i, code: 'NO_ROWS' };
      }

      const seen = new Set<string>();
      for (let r = 0; r < b.rows.length; r++) {
        const txt = (b.rows[r].reasonText || '').trim().toLowerCase();
        if (!txt) {
          return { ok: false, message: `A reason in "${name}" is empty.`, index: i, rowIndex: r, code: 'EMPTY_ROW' };
        }
        if (seen.has(txt)) {
          b.fieldErrors = true;
          b.duplicateIndex = r;
          return { ok: false, message: `Duplicate reasons found in "${name}".`, index: i, rowIndex: r, code: 'DUPLICATE_ROW' };
        }
        seen.add(txt);
      }
    }

    return { ok: true };
  }

  private focusCategoryNameInput(index: number) {
    const el = this.catBlockEls?.toArray()[index]?.nativeElement;
    const input = el?.querySelector('input[formControlName="categoryName"]') as HTMLInputElement | null;
    if (input) {
      input.focus();
      // เลื่อนให้เห็นชัด ๆ อีกครั้ง (บาง layout มีเฮดเดอร์ sticky)
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // --- Completeness check สำหรับ "หมวดใหม่" ทุกตัว ---
  get hasIncompleteNewCategory(): boolean {
    return this.findFirstNewCategoryIssue() !== null;
  }

  /** คืนค่า issue แรกของหมวดใหม่ที่ยังไม่ครบ (ไม่ปรับ state ใดๆ) */
  private findFirstNewCategoryIssue(): {
    index: number;
    code: 'MISSING_NAME' | 'DUPLICATE_NAME' | 'NO_ROWS' | 'EMPTY_ROW' | 'DUPLICATE_ROW';
    rowIndex?: number;
  } | null {
    // ไล่เฉพาะหมวดที่ isNew
    const newBlocks = this.categoryBlocks.map((b, i) => ({ b, i })).filter(x => x.b.isNew);

    for (const { b, i } of newBlocks) {
      const name = (this.getCategoryName(i) || '').trim();

      if (!name) {
        return { index: i, code: 'MISSING_NAME' };
      }
      if (this.isCategoryNameDuplicate(name, i)) {
        return { index: i, code: 'DUPLICATE_NAME' };
      }
      if (!b.rows || b.rows.length === 0) {
        return { index: i, code: 'NO_ROWS' };
      }

      const seen = new Set<string>();
      for (let r = 0; r < b.rows.length; r++) {
        const txt = (b.rows[r].reasonText || '').trim().toLowerCase();
        if (!txt) return { index: i, code: 'EMPTY_ROW', rowIndex: r };
        if (seen.has(txt)) return { index: i, code: 'DUPLICATE_ROW', rowIndex: r };
        seen.add(txt);
      }
    }
    return null;
  }

  private issueToMessage(issue: { index: number; code: string }): string {
    const name = (this.getCategoryName(issue.index) || 'the new category').trim() || 'the new category';
    switch (issue.code) {
      case 'MISSING_NAME':   return 'Please fill in the new category name.';
      case 'DUPLICATE_NAME': return `Category "${name}" already exists.`;
      case 'NO_ROWS':        return `Please add at least one reason in "${name}".`;
      case 'EMPTY_ROW':      return `A reason in "${name}" is empty.`;
      case 'DUPLICATE_ROW':  return `Duplicate reasons found in "${name}".`;
      default:               return 'Please complete the current new category first.';
    }
  }

  // ================= API คล้าย PendingDraftsAware (สำหรับ Guard) =================
  hasFormChanged(): boolean {
    return this.formDetails?.dirty || (this.initialSnapshot !== this.computeSnapshot());
  }
  hasPendingDrafts(): boolean {
    return !!sessionStorage.getItem(this.getDraftKey());
  }
  clearDraftsForCurrentType(): void {
    this.removeDraft();
  }

  private scrollToCategoryIndex(index: number) {
    const el = this.catBlockEls?.toArray()[index]?.nativeElement;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onToggleChange(ev: MouseEvent, index: number) {
    // ถ้าแก้ไขไม่ได้ ให้กันไว้ตั้งแต่ input[disabled] แล้ว แต่กันซ้ำอีกชั้น
    if (!this.isEditMode) { ev.preventDefault(); return; }

    const cat = this.categoryBlocks[index];
    if (!cat) return;

    // ห้ามสลับ toggle สำหรับ new category
    if (cat.isNew) {
      ev.preventDefault();
      this.notify.warn('New category must stay active until it is saved.');
      return;
    }

    // toggle
    cat.active = !cat.active;

    // ถ้าปิด -> ปิดโหมด add และล้าง error UI
    if (!cat.active) {
      cat.isAdding = false;
      cat.fieldErrors = false;
      cat.duplicateIndex = null;
    }

    this.formDetails.markAsDirty();
    this.updateSaveState();
  }

  isUnmappedOpen(i: number): boolean {
    return this.unmappedOpenFor === i;
  }

  openUnmappedDropdown(i: number, _origin?: any) {
    const current = (this.getCategoryFormAt(i).get('categoryName')?.value || '').toString();
    this.applyUnmappedFilter(i, current);
    this.updateOverlayWidth(i);
    this.unmappedOpenFor = i;
    this.activeUnmappedIndex[i] = 0;

    // กันพลาด: seed เฉพาะ index ที่กำลังเปิด
    if (!this.selectedUnmapped[i]) {
      const cb = this.categoryBlocks[i];
      const name = (cb?.displayName || '').trim().toLowerCase();
      let match: UnmappedCategory | undefined;

      if (cb?.meta?.categoryId) {
        match = this.unmappedAll.find(x => x.categoryId === cb.meta!.categoryId);
      }
      if (!match && name) {
        match = this.unmappedAll.find(
          x => (x.categoryName || '').trim().toLowerCase() === name
        );
      }
      if (match) this.selectedUnmapped[i] = match;
    }
  }

  toggleUnmappedDropdown(i: number, _origin: any, ev: MouseEvent) {
    ev.stopPropagation();
    if (this.isUnmappedOpen(i)) this.closeUnmappedDropdown();
    else this.openUnmappedDropdown(i);
  }

  closeUnmappedDropdown() {
    this.unmappedOpenFor = null;
  }

  private applyUnmappedFilter(i: number, term: string) {
    const t = (term || '').trim().toLowerCase();
    const list = !t
      ? this.unmappedAll
      : this.unmappedAll.filter(x =>
          (x.categoryName || '').toLowerCase().includes(t) ||
          (x.categoryType || '').toLowerCase().includes(t) ||
          String(x.categoryId).includes(t)
        );
    this.filteredUnmapped[i] = list.slice(0, 200); // กันรายการยาวเกิน
  }

  /**
   * เมื่อพิมพ์ในช่องชื่อ category (new category)
   * - filter รายการ
   * - ถ้าเคยเลือก option ไว้ แล้วพิมพ์ไม่ตรง → เคลียร์ selection
   * - ถ้า input ว่าง → เคลียร์ selection
   */
  onNewCategoryInput(index: number, ev: Event) {
    const value = (ev.target as HTMLInputElement).value || '';

    // sync display name ใน state
    this.categoryBlocks[index].displayName = value;

    // filter dropdown ตามค่าปัจจุบัน
    this.applyUnmappedFilter(index, value);

    // เปิด dropdown ถ้ายังไม่เปิด (เพื่อให้เห็นผลการ filter)
    if (!this.isUnmappedOpen(index)) this.openUnmappedDropdown(index);

    // เคส: ล้างข้อความหมด → เคลียร์ selection/active
    if (!value.trim()) {
      this.clearSelectedForIndex(index, value);
      return;
    }

    // ถ้าเคยเลือก option แต่ข้อความที่พิมพ์ไม่ตรงกับที่เลือก → เคลียร์ selection
    const sel = this.selectedUnmapped[index];
    if (sel && sel.categoryName.trim().toLowerCase() !== value.trim().toLowerCase()) {
      this.clearSelectedForIndex(index, value);
    }

    this.ensureLinkState(index);
  }

  selectUnmappedCategory(index: number, opt: UnmappedCategory) {
    this.selectedUnmapped[index] = opt;

    // ใส่ชื่อลง form control (ไม่ emit valueChanges เพื่อไม่รบกวน)
    const ctrl = this.getCategoryFormAt(index).get('categoryName');
    ctrl?.setValue(opt.categoryName, { emitEvent: false });

    // sync displayName
    this.categoryBlocks[index].displayName = opt.categoryName;

    // set meta (แม้เป็นหมวดใหม่ แต่เรารู้ id เดิมของ category นี้แล้ว)
    this.categoryBlocks[index].meta = {
      categoryId: opt.categoryId,
      categoryName: opt.categoryName,
      categoryType: opt.categoryType,
      isActive: opt.isActive,
      isUnMatch: false, // ไม่เกี่ยวกับ unmatch ใน flow นี้
    };

    // ปิด dropdown + mark dirty
    this.closeUnmappedDropdown();
    this.formDetails.markAsDirty();
    this.updateSaveState();
    this.ensureLinkState(index); // trigger link + fetch/merge ทันทีถ้าชื่อตรง
  }

  moveActiveOption(i: number, delta: number) {
    if (!this.isUnmappedOpen(i)) return;
    const list = this.filteredUnmapped[i] || [];
    if (!list.length) return;
    const next = (this.activeUnmappedIndex[i] ?? 0) + delta;
    const max = list.length - 1;
    this.activeUnmappedIndex[i] = Math.max(0, Math.min(max, next));
  }

  confirmActiveOption(i: number) {
    if (!this.isUnmappedOpen(i)) return;
    const list = this.filteredUnmapped[i] || [];
    const k = this.activeUnmappedIndex[i] ?? 0;
    if (list[k]) this.selectUnmappedCategory(i, list[k]);
  }

  trackByUnmapped = (_: number, item: UnmappedCategory) => item.categoryId;

  /**
   * เคลียร์ selection ของ dropdown + meta สำหรับ index ที่กำหนด
   */
  private clearSelectedForIndex(index: number, nextName?: string) {
    const cb = this.categoryBlocks[index];
    if (!cb) return;
    const wasLinked = !!cb.meta; // เคยลิงก์มาก่อนหรือไม่

    this.selectedUnmapped[index] = null;

    if (cb.isNew) {
      if (wasLinked) {
        // <<< scrub ทุกแถวด้วยชื่อปัจจุบันเสมอ
        const name = (nextName ?? this.getCategoryName(index) ?? '').toString();
        this.scrubRowsForDetached(index, name);
      }
      cb.meta = null;
    }

    this.activeUnmappedIndex[index] = 0;
  }

  onNewCategoryBlur(index: number) {
    if (this.suppressNextBlur) {
      // ผู้ใช้กำลังกดเลือกใน dropdown → ไม่ต้องปิด/เคลียร์
      return;
    }

    const ctrl = this.getCategoryFormAt(index).get('categoryName');
    const value = (ctrl?.value || '').toString().trim();

    if (!value) {
      this.clearSelectedForIndex(index, value);
      this.closeUnmappedDropdown();
      return;
    }

    const match = this.unmappedAll.find(
      x => (x.categoryName || '').trim().toLowerCase() === value.toLowerCase()
    );

    if (match) {
      this.selectUnmappedCategory(index, match);
    } else {
      this.clearSelectedForIndex(index, value);
    }

    this.closeUnmappedDropdown();
    this.ensureLinkState(index);
  }

  /** เลือก option ตั้งแต่ mousedown และกัน blur */
  onOptionMouseDown(index: number, opt: UnmappedCategory, ev: MouseEvent) {
    ev.preventDefault();                 // กันเสียโฟกัส → ไม่เกิด blur
    this.suppressNextBlur = true;        // กันไว้เผื่อบาง browser ยังยิง blur
    this.selectUnmappedCategory(index, opt);
    // ปล่อย flag ใน task ถัดไป
    setTimeout(() => (this.suppressNextBlur = false));
  }

  // ===== หา element ของ input categoryName ในการ์ดที่ index =====
  private getCategoryNameInputEl(index: number): HTMLInputElement | null {
    const el = this.catBlockEls?.toArray()[index]?.nativeElement;
    return (el?.querySelector('input[formControlName="categoryName"]') as HTMLInputElement) || null;
  }

  // ===== คำนวณและเก็บความกว้าง overlay ตามความกว้าง input =====
  private updateOverlayWidth(index: number) {
    const input = this.getCategoryNameInputEl(index);
    if (input) {
      // + ปุ่ม dropdown  (8px gap + 32px ปุ่ม) = เผื่อเล็กน้อยถ้าต้องรวมทั้งกลุ่ม
      const w = input.getBoundingClientRect().width;
      this.overlayWidth[index] = Math.max(180, Math.round(w)); // กันเล็กเกิน
    }
  }

  // ===== อัปเดตความกว้างเมื่อ resize ถ้าดรอปดาวน์เปิดอยู่ =====
  @HostListener('window:resize')
  onWindowResize() {
    if (this.unmappedOpenFor !== null) {
      this.updateOverlayWidth(this.unmappedOpenFor);
    }
  }

  // ใช้กู้ค่า selection กลับมาจาก meta/displayName
  private seedSelectedFromState() {
    this.categoryBlocks.forEach((cb, i) => {
      if (!cb.isNew) return;                   // สนใจเฉพาะหมวดใหม่ที่ยังแก้ชื่อ
      if (this.selectedUnmapped[i]) return;    // ถ้ามีแล้วไม่ต้องทำซ้ำ

      const name = (cb.displayName || '').trim().toLowerCase();
      let match: UnmappedCategory | undefined;

      // 1) จับคู่ด้วย categoryId ก่อน (แม่นสุด)
      if (cb.meta?.categoryId) {
        match = this.unmappedAll.find(x => x.categoryId === cb.meta!.categoryId);
      }

      // 2) ไม่เจอ → ลองจับคู่ด้วยชื่อ
      if (!match && name) {
        match = this.unmappedAll.find(
          x => (x.categoryName || '').trim().toLowerCase() === name
        );
      }

      if (match) {
        this.selectedUnmapped[i] = match;
      }
    });
  }

  private mapApiReasonsToRows(list: any[], fallbackCat: { id: number; name: string }): ReasonEntry[] {
    return (Array.isArray(list) ? list : []).map((r: any) => ({
      reasonId: r?.reasonId,
      categoryId: r?.categoryId ?? fallbackCat.id,
      categoryName: r?.categoryName ?? fallbackCat.name,
      reasonText: (r?.reasonText || '').toString(),
      isActive: !!r?.isActive,
      isDeleted: !!r?.isDeleted,   // ตามสเปก API: false = ห้ามลบ
      createdAt: r?.createdAt ?? null,
    }));
  }

  /** ดึง reasons ของ categoryId แล้ว merge ใส่การ์ด index (กันซ้ำด้วย reasonText แบบ case-insensitive) */
  private fetchAndFillReasonsFor(index: number, catId: number, catName: string) {
    const cb = this.categoryBlocks[index];
    if (!cb) return;

    this.reasonService.getReasonByCategoryId(catId).subscribe({
      next: (res: any[]) => {
        const fetched = this.mapApiReasonsToRows(res, { id: catId, name: catName });

        // รวมกับที่ผู้ใช้อาจกรอกไว้แล้ว (ให้ของเดิมอยู่นำหน้า, กันซ้ำด้วย reasonText)
        const seen = new Set<string>();
        const normalize = (s: string) => (s || '').trim().toLowerCase();

        const merged: ReasonEntry[] = [];
        // ของเดิมก่อน
        for (const row of cb.rows || []) {
          const key = normalize(row.reasonText);
          if (!seen.has(key)) { seen.add(key); merged.push(row); }
        }
        // ของที่ดึงมา
        for (const row of fetched) {
          const key = normalize(row.reasonText);
          if (!seen.has(key)) { seen.add(key); merged.push(row); }
        }

        cb.rows = merged;
        cb.isAdding = false;
        this.formDetails.markAsDirty();
        this.updateSaveState();
      },
      error: () => {
        // ดึงไม่สำเร็จ -> แจ้งเตือนแบบไม่บล็อกต่อ
        this.notify.error('Could not load reasons for selected category.');
      }
    });
  }

  private scrubRowsForDetached(index: number, nextName: string) {
    const cb = this.categoryBlocks[index];
    if (!cb) return;
    cb.rows = (cb.rows || []).map(r => ({
      reasonId: undefined,
      categoryId: null, // <<< ต้องเป็น null
      categoryName: nextName,
      reasonText: (r.reasonText || '').toString(),
      isActive: true, // <<< true เสมอสำหรับแถว detached
      isDeleted: true, // <<< true เสมอสำหรับแถว detached
      createdAt: null,
    }));
  }

  private namesEqual(a: string, b: string): boolean {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
  }

  private ensureLinkState(index: number) {
    const cb = this.categoryBlocks[index];
    if (!cb || !cb.isNew) return;

    const currentName = (this.getCategoryName(index) || '').trim();
    const selected = this.selectedUnmapped[index];

    // กรณีมี meta (เคย linked) แต่ชื่อ "ไม่ตรง" กับ option → DETACH
    if (cb.meta && (!selected || !this.namesEqual(currentName, selected.categoryName))) {
      // DETACH
      cb.meta = null;                 // ปลดลิงก์
      this.scrubRowsForDetached(index, currentName);
      this.formDetails.markAsDirty();
      this.updateSaveState();
      return;
    }

    // กรณีไม่มี meta (unlinked/detached) แต่ตอนนี้ "ตรง" option → LINK + hydrate
    if (!cb.meta && selected && this.namesEqual(currentName, selected.categoryName)) {
      cb.meta = {
        categoryId: selected.categoryId,
        categoryName: selected.categoryName,
        categoryType: selected.categoryType,
        isActive: selected.isActive,
        isUnMatch: false,
      };
      // hydrate (re-fetch เสมอเพื่อกัน stale)
      this.fetchAndFillReasonsFor(index, selected.categoryId, selected.categoryName);
      this.formDetails.markAsDirty();
      this.updateSaveState();
    }
  }

  private buildChangeSummary(): Array<{
    section: string;
    items: Array<{
      id?: string | number | null;
      label: string;
      field: string;
      from: any;
      to: any;
    }>;
  }> {
    const before = this.initialPayloadForDiff?.reasons ?? [];
    const after  = this.buildReasonsPayload();

    const norm = (s: string) => (s || '').trim().toLowerCase();
    const catKey = (b: any) => {
      const id = b?.categoryId ?? 0;
      return id && id > 0 ? `id:${id}` : `name:${norm(b?.categoryName || b?.categoryType || '')}`;
    };

    const mapByKey = (arr: any[]) => {
      const m = new Map<string, any>();
      for (const b of arr) m.set(catKey(b), b);
      return m;
    };

    const B = mapByKey(before);
    const A = mapByKey(after);

    const groups: Array<{ section: string; items: any[] }> = [];

    // ===== Categories =====
    const catItems: any[] = [];

    // Created categories
    for (const [k, a] of A.entries()) {
      if (a?.isUnMatch) continue;
      if (!B.has(k)) {
        const name = a.categoryName || a.categoryType || '(new)';
        catItems.push({
          entity: 'Category',
          id: a.categoryId ?? null,
          label: name,
          field: 'CREATE',
          from: '-',
          to: name,
        });
      }
    }

    // Unmatched categories
    for (const a of after) {
      if (a?.isUnMatch) {
        const name = a.categoryName || a.categoryType || '(category)';
        catItems.push({
          entity: 'Category',
          id: a.categoryId ?? null,
          label: name,
          field: 'Unmatch',
          from: 'Matched',
          to: 'Unmatched',
        });
      }
    }

    // Status toggle
    for (const [k, a] of A.entries()) {
      if (a?.isUnMatch) continue;
      const b = B.get(k);
      if (!b) continue;
      if (!!a.isActive !== !!b.isActive) {
        const name = a.categoryName || a.categoryType || '(category)';
        catItems.push({
          entity: 'Category',
          id: a.categoryId ?? null,
          label: name,
          field: 'activeStatus',
          from: !!b.isActive,
          to: !!a.isActive,
        });
      }
    }

    // Rename
    for (const [k, a] of A.entries()) {
      if (a?.isUnMatch) continue;
      const b = B.get(k);
      if (!b) continue;
      const nameB = (b.categoryName || b.categoryType || '').toString().trim();
      const nameA = (a.categoryName || a.categoryType || '').toString().trim();
      if (nameB && nameA && nameB !== nameA) {
        catItems.push({
          entity: 'CategoryName',
          id: a.categoryId ?? null,
          label: nameA,
          field: 'categoryName',
          from: nameB,
          to: nameA,
        });
      }
    }

    if (catItems.length) groups.push({ section: 'Categories', items: catItems });

    // ===== Reasons =====
    const reasonItems: any[] = [];

    const categoryKeys = new Set<string>([...A.keys(), ...B.keys()]);
    for (const k of categoryKeys) {
      const a = A.get(k);
      if (!a || a.isUnMatch) continue; // ข้าม category ที่ถูก unmatched หรือไม่มีใน after
      const b = B.get(k);

      const nameA = a.categoryName || a.categoryType || '(category)';
      const byIdB = new Map<number, any>();
      const byIdA = new Map<number, any>();
      for (const r of (b?.rejectionReasons ?? [])) if (r?.reasonId) byIdB.set(r.reasonId, r);
      for (const r of (a?.rejectionReasons ?? [])) if (r?.reasonId) byIdA.set(r.reasonId, r);

      // 1) Edits (จับด้วย reasonId ที่ซ้อนกัน)
      const editedIds = new Set<number>();
      for (const [rid, rA] of byIdA.entries()) {
        const rB = byIdB.get(rid);
        if (!rB) continue;
        const tB = (rB.reasonText || '').trim();
        const tA = (rA.reasonText || '').trim();
        if (tB !== tA) {
          editedIds.add(rid);
          reasonItems.push({
            entity: 'Detail',
            id: rA.reasonId ?? null,
            label: nameA,
            field: 'Edit Reason',
            from: tB,
            to: tA,
          });
        }
      }

      // 2) New (ไม่มี reasonId หรือมี reasonId แต่ไม่อยู่ใน before) — และไม่ใช่ edited
      for (const rA of (a?.rejectionReasons ?? [])) {
        const rid = rA?.reasonId;
        const isEdited = typeof rid === 'number' && editedIds.has(rid);
        const isNew =
          rid == null // แถวใหม่ที่ยังไม่ถูกออก id
          || (typeof rid === 'number' && !byIdB.has(rid)); // มี id แต่ไม่เคยอยู่ใน before

        if (!isEdited && isNew) {
          reasonItems.push({
            entity: 'Detail',
            id: rA?.reasonId ?? null,
            label: nameA,
            field: 'New Reason',
            from: '-',
            to: (rA?.reasonText || '').trim(),
          });
        }
      }

      // 3) Delete (อยู่ใน before แต่ไม่อยู่ใน after) — และไม่ใช่ edited
      for (const rB of (b?.rejectionReasons ?? [])) {
        const rid = rB?.reasonId;
        if (typeof rid !== 'number') continue;       // baseline ส่วนใหญ่มี id
        if (editedIds.has(rid)) continue;            // ตัดกรณีแก้ไขออก
        if (!byIdA.has(rid)) {
          reasonItems.push({
            entity: 'Detail',
            id: rB?.reasonId ?? null,
            label: nameA,
            field: 'Delete Reason',
            from: (rB?.reasonText || '').trim(),
            to: '-',
          });
        }
      }
    }

    if (reasonItems.length) groups.push({ section: 'Reasons', items: reasonItems });

    return groups;
  }

  private getBaselineReasonText(reasonId?: number | null): string | null {
    if (!reasonId || !this.initialPayloadForDiff?.reasons) return null;
    for (const b of this.initialPayloadForDiff.reasons) {
      for (const r of (b.rejectionReasons || [])) {
        if (r?.reasonId === reasonId) return (r.reasonText || '').trim();
      }
    }
    return null;
  }

  private catKeyForDiff(b: any): string {
    const id = b?.categoryId ?? 0;
    const name = (b?.categoryName || b?.categoryType || '').toString().trim().toLowerCase();
    return id && id > 0 ? `id:${id}` : `name:${name}`;
  }

  private toReasonMapById(list: any[]): Map<number, any> {
    const m = new Map<number, any>();
    for (const r of (list || [])) {
      if (typeof r?.reasonId === 'number') m.set(r.reasonId, r);
    }
    return m;
  }

  private buildApiRequest(): ApiRequestBody {
    const before = this.initialPayloadForDiff?.reasons ?? [];
    const after  = this.buildReasonsPayload();

    const B = new Map<string, any>();
    for (const b of before) B.set(this.catKeyForDiff(b), b);

    const A = new Map<string, any>();
    for (const a of after)  A.set(this.catKeyForDiff(a), a);

    const categories: ApiCategory[] = [];

    for (const [k, a] of A.entries()) {
      const b = B.get(k); // baseline (undefined = หมวดใหม่)

      const categoryId   = (a?.categoryId ?? null) as number | null;
      const categoryName = (a?.categoryName || a?.categoryType || '').toString();
      const categoryType = (a?.categoryType || categoryName || '').toString();
      const isActive     = !!a?.isActive;
      const isUnmatch    = !!a?.isUnMatch;

      // ===== สร้าง reasons "diff เท่านั้น" =====
      const reasons: ApiReason[] = [];
      const byIdB = this.toReasonMapById(b?.rejectionReasons || []);
      const byIdA = this.toReasonMapById(a?.rejectionReasons || []);

      // Edit
      for (const [rid, rA] of byIdA.entries()) {
        const rB = byIdB.get(rid);
        if (!rB) continue;
        const oldText = (rB.reasonText || '').trim();
        const newText = (rA.reasonText || '').trim();
        if (oldText !== newText) {
          reasons.push({
            reasonId: rid,
            reasonText: newText,
            isActive: !!rA.isActive,
            isDelete: false,
          });
        }
      }

      // New
      for (const rA of (a?.rejectionReasons || [])) {
        const rid = rA?.reasonId;
        const isNew = rid == null || !byIdB.has(rid);
        if (isNew) {
          const text = (rA?.reasonText || '').toString().trim();
          if (text) {
            reasons.push({
              reasonId: null,
              reasonText: text,
              isActive: true,
              isDelete: false,
            });
          }
        }
      }

      // Delete
      const idsInA = new Set<number>([...byIdA.keys()]);
      for (const [rid, rB] of byIdB.entries()) {
        if (!idsInA.has(rid)) {
          reasons.push({
            reasonId: rid,
            reasonText: (rB?.reasonText || '').toString().trim(),
            isActive: !!rB?.isActive,
            isDelete: true,
          });
        }
      }

      // หมวดใหม่ → ถ้า reasons ยังว่าง ให้ส่งทุกเหตุผลเป็น new
      if (!b && !isUnmatch && reasons.length === 0) {
        for (const r of (a?.rejectionReasons || [])) {
          const text = (r?.reasonText || '').toString().trim();
          if (text) {
            reasons.push({
              reasonId: null,
              reasonText: text,
              isActive: true,
              isDelete: false,
            });
          }
        }
      }

      // ===== จุดสำคัญ: กรอง category ที่ไม่เปลี่ยนแปลง =====
      const noCategoryChange =
        !!b &&                 // มี baseline อยู่แล้ว (ไม่ใช่หมวดใหม่)
        !isUnmatch &&          // ไม่ได้กด unmatch
        (!!b.isActive === isActive) &&  // active ไม่เปลี่ยน
        reasons.length === 0;  // ไม่มี diff ของ reasons

      if (noCategoryChange) {
        // ⛔ ข้าม ไม่ push ลง payload
        continue;
      }

      // มีการเปลี่ยนแปลง → ใส่ใน payload
      categories.push({
        categoryId,
        categoryName,
        categoryType,
        isActive,
        isUnmatch,
        reasons,
      });
    }

    return {
      stageId: this.processId, // ตอนนี้เป็น number แล้ว
      categories,
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
