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
  categoryId: number;
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
        this.processId = params['processId'] || 0;

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

    const payload = this.getFormPayload();
    console.log('SAVE payload:', payload);
    // TODO: persist

    this.initialSnapshot = this.computeSnapshot();
    this.formDetails.markAsPristine();
    this.removeDraft();
    this.updateSaveState();
  }

  // ================= โหลดข้อมูล =================
  fetchRecruitmentStagesWithReasons() {
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

        // 2) สร้าง snapshot ฝั่ง server
        this.initialSnapshot = this.computeSnapshot();
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
          isEditingName: !display,
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

    // ถือว่าเป็นการแก้ไขจริงแล้ว
    this.formDetails.markAsDirty();
    this.updateSaveState();
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

  onUnmatchHover(event: MouseEvent, enter: boolean) {
    const el = event.currentTarget as HTMLElement | null;
    if (!el) return; // กัน null
    el.style.background = enter ? '#D9363E' : '#FF4D4F';
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
    const categoryId   = cat.meta?.categoryId ?? 0;

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

    const prevText = (rows[idx].reasonText || '').trim();
    const nextText = (updatedRow.reasonText || '').trim();

    // ไม่เปลี่ยนจริง → ไม่ต้อง mark dirty
    if (prevText === nextText) return;

    const dupIdx = this.findDupIndex(rows, nextText, idx);
    if (dupIdx >= 0) { cat.fieldErrors = true; cat.duplicateIndex = dupIdx; return; }

    const next = [...rows];
    next[idx] = { ...rows[idx], reasonText: nextText };
    cat.rows = next;

    this.formDetails.markAsDirty();
    this.updateSaveState();
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
        categoryId: cb.meta?.categoryId ?? 0,
        categoryName: name || cb.meta?.categoryName || cb.displayName || '',
        categoryType: cb.meta?.categoryType ?? (name || cb.displayName || ''),
        isActive: cb.active,// ใช้ active จากกล่อง

        isUnMatch: false,                         // ปกติ “ยังไม่ได้ unmatch”
        canUnmatch: cb.meta?.isUnMatch ?? false,  // สิทธิ์กด unmatch

        rejectionReasons: (cb.rows || []).map((r: ReasonEntry) => ({
          reasonId: r.reasonId,
          categoryId: cb.meta?.categoryId ?? 0,
          categoryName: name || cb.meta?.categoryName || '',
          reasonText: r.reasonText,
          isActive: r.isActive ?? true,
          isDeleted: r.isDeleted ?? true,
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
      categoryId: b.categoryId ?? 0,
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
    const changed = this.formDetails.dirty || (this.initialSnapshot !== this.computeSnapshot());
    if (changed) this.persistDraft(); else this.removeDraft();
    this.setSaveEnabled(changed);
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
