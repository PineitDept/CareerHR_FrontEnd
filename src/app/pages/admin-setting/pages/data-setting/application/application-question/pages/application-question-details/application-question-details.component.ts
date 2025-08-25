import { Component, ViewChild } from '@angular/core';
import { defaultDetailsFilterButtons } from '../../../../../../../../constants/admin-setting/application-question.constants';
import { ActivatedRoute } from '@angular/router';
import { ApplicationQuestionService } from '../../../../../../../../services/admin-setting/application-question/application-question.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Column, Columns } from '../../../../../../../../shared/interfaces/tables/column.interface';
import { TablesComponent } from '../../../../../../../../shared/components/tables/tables.component';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogComponent } from '../../../../../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { CaptchaDialogComponent } from '../../../../../../../../shared/components/dialogs/captcha-dialog/captcha-dialog.component';
import { Subject, takeUntil } from 'rxjs';

type CategoryForm = {
  categoryId: number | string | null;
  categoryName: string;
  activeStatus: boolean;
};

type CategoryDetailForm = {
  id: number | string | null;
  questionTH: string;
  questionEN: string;
  sort: number | null;
  activeStatus: boolean;
  scoringMethod: 1 | 2 | null;
};

interface DetailsSnapshot {
  name: string;
  items: Array<{
    id: number | string | null;
    questionTH: string;
    questionEN: string;
    sort: number | null;
    activeStatus: boolean;
    scoringMethod: 1 | 2 | null;
  }>;
}

@Component({
  selector: 'app-application-question-details',
  templateUrl: './application-question-details.component.html',
  styleUrl: './application-question-details.component.scss',
  animations: [
    trigger('fadeInOutAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class ApplicationQuestionDetailsComponent {
  @ViewChild('categoryTable') categoryTable!: TablesComponent;
  @ViewChild('categoryDetailsTable') categoryDetailsTable!: TablesComponent;

  filterButtons = defaultDetailsFilterButtons();
  disabledKeys: string[] = [];

  categoryType: string = '';

  formDetails!: FormGroup;

  categoryColumns: Columns = [
    {
      header: 'No.',
      field: 'index',
      type: 'text',
      align: 'center',
      width: '4%'
    },
    {
      header: 'Category Name',
      field: 'categoryName',
      type: 'text',
      width: '71%'
    },
    {
      header: 'Status',
      field: 'activeStatus',
      type: 'toggle',
      align: 'center',
      width: '7%'
    },
    {
      header: 'Action',
      field: 'textlink',
      type: 'textlink',
      align: 'center',
      width: '18%',
      textlinkActions: ['view','edit-card']
    }
  ];

  // เก็บ columns พื้นฐาน (คงของเดิมไว้)
  baseCategoryDetailsColumns: Columns = [
    { header: 'No.', field: '__index', type: 'number', align: 'center', width: '4%' },
    { header: 'Question (TH)', field: 'questionTH', type: 'text', width: '32%', wrapText: true },
    { header: 'Question (EN)', field: 'questionEN', type: 'text', width: '32%', wrapText: true },
    { header: 'Row Answer', field: 'sort', type: 'number', align: 'center', width: '10%' },
    { header: 'Status', field: 'activeStatus', type: 'toggle', align: 'center', width: '7%' },
    { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '15%', textlinkActions: ['edit-inrow','delete'] },
  ];

  scoringColumnDef: Column = {
    header: 'Scoring Method',
    field: 'scoringMethod',
    type: 'select',
    align: 'center',     // ตรงกับ union type
    width: '12%',
    options: ['Normal', 'Reverse'],
  };

  // ไว้ bind เข้า <app-tables>
  categoryDetailsColumns: Columns = [...this.baseCategoryDetailsColumns];

  // default ค่าของ footer เวลา add แถว (ใช้กับ [createDefaults])
  tableCreateDefaults: any = {};

  categoryRows: any[] = [];
  categoryDetailsRows: any[] = [];

  isEnabledCardDetails = false;

  isEditing = false;
  private initialSnapshot: any = null;

  isViewMode = false;
  isAddMode = false;
  isEditMode = false;
  isEditDetails = false;

  isAddingRow = false;
  fieldErrors = false;
  duplicateRowIndex: number | null = null;

  private isProgrammaticUpdate = false;

  private DETAILS_CACHE_KEY = 'categoryDetailsCache';

  private CATEGORY_TYPE_DRAFT_PREFIX = 'categoryTypeDraft';

  private DIRTY_PREFIX = 'aqd:dirty';

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private applicationQuestionService: ApplicationQuestionService,
    private fb: FormBuilder,
    private dialog: MatDialog,
  ) { }

  ngOnInit() {
    this.initializeForm();

    // เริ่มด้วย view-mode: ปิดการแก้ไขทั้งฟอร์ม
    this.formDetails.disable({ emitEvent: false });
    this.setActionButtons('view');

    this.formDetails.get('categoryType.CategoryTypeName')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((v) => {
        if (!this.isEditing) return;
        if (this.isProgrammaticUpdate) return;
        this.writeCategoryTypeDraft(String(v ?? '').trim());
      });

    this.formDetails.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isProgrammaticUpdate) return;
        const enable = this.hasPendingDrafts() || this.hasFormChanged();
        this.setButtonDisabled('save', !enable);
      });

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.categoryType = params['categoryType'] || '';
        this.formDetails.patchValue({
          categoryType: {
            CategoryTypeName: this.categoryType,
            activeStatus: true
          }
        }, { emitEvent: false });
        // หลังดึงข้อมูลเสร็จ ให้ snapshot ค่าเริ่มต้นไว้ใช้เทียบภายหลัง
        this.fetchCategoryTypesDetails();
      });
  }

  initializeForm() {
    this.formDetails = this.fb.group({
      // ส่วนหัว (ซ้าย/ขวา)
      categoryType: this.fb.group({
        CategoryTypeName: [''],
        activeStatus: [true],
      }),

      // ตาราง Category (FormArray)
      categories: this.fb.array<FormGroup>([]),

      // ส่วน "Category Details" ของ Category ที่เลือก
      selectedCategoryId: [null],
      categoryDetails: this.fb.group({
        CategoryName: [''],
        items: this.fb.array<FormGroup>([]), // ตาราง details
      }),
    });
  }

  // ===== Helpers =====
  get categoriesFA() {
    return this.formDetails.get('categories') as any; // FormArray<FormGroup<CategoryForm>>
  }
  get categoryDetailsFG() {
    return this.formDetails.get('categoryDetails') as FormGroup;
  }
  get detailsFA() {
    return this.categoryDetailsFG.get('items') as any; // FormArray<FormGroup<CategoryDetailForm>>
  }

  get isDisabled() {
    return this.categoryDetailsFG.disabled;
  }

  // helper: สลับคอลัมน์ตาม categoryId
  private setColumnsFor(categoryId: number | string | null | undefined) {
    const cols = [...this.baseCategoryDetailsColumns];

    if (String(categoryId) === '5') {
      // แทรก "Scoring Method" ที่ตำแหน่งก่อน activeStatus
      const statusIdx = cols.findIndex(c => c.field === 'activeStatus');
      if (statusIdx !== -1) {
        cols.splice(statusIdx, 0, this.scoringColumnDef); // ← แทรกตรงนี้
      }
      this.categoryDetailsColumns = cols;
      this.tableCreateDefaults = { scoringMethod: 'Normal' }; // default footer ตอนเพิ่มแถว
    } else {
      this.categoryDetailsColumns = [...this.baseCategoryDetailsColumns];
      this.tableCreateDefaults = {};
    }
  }

  // mapping ความกว้างเมื่อมี scoring
  private withScoringWidths: Record<string, string> = {
    '__index': '4%',
    'questionTH': '27%',
    'questionEN': '27%',
    'sort': '10%',
    'scoringMethod': '12%',
    'activeStatus': '8%',
    'textlink': '12%',
  };

  private applyWidths(cols: Columns, widths: Record<string,string>): Columns {
    return cols.map(c => ({ ...c, width: widths[c.field] ?? c.width }));
  }

  private buildColumnsFor(categoryId: number | string) {
    if (String(categoryId) === '5') {
      // สร้างสำเนาคอลัมน์พื้นฐาน แล้วสอด scoring ไว้ก่อน activeStatus
      const base = [...this.baseCategoryDetailsColumns];
      const idxStatus = base.findIndex(c => c.field === 'activeStatus');
      const withScoring = [
        ...base.slice(0, idxStatus),
        this.scoringColumnDef,
        ...base.slice(idxStatus),
      ];
      this.categoryDetailsColumns = this.applyWidths(withScoring, this.withScoringWidths);
    } else {
      this.categoryDetailsColumns = this.baseCategoryDetailsColumns;
    }
  }

  private buildCategoryFG(c: any) {
    return this.fb.group<CategoryForm>({
      categoryId: c?.categoryId ?? null,
      categoryName: c?.categoryName ?? '-',
      activeStatus: !!c?.isActive,
    } as any);
  }
  private buildDetailFG(d: any) {
    return this.fb.group<CategoryDetailForm>({
      id: d?.id ?? null,
      questionTH: d?.questionTH ?? '',
      questionEN: d?.questionEN ?? '',
      sort: d?.sort ?? null,
      activeStatus: d?.status === 1 ? true : false,
      scoringMethod: this.toScoringUnion(d?.scoringMethod), // default 1(Normal)
    } as any);
  }

  private setActionButtons(mode: 'view' | 'edit') {
    if (mode === 'view') {
      this.filterButtons = [{ label: 'Edit', key: 'edit', color: '#000000' }];
      this.disabledKeys = []; // ไม่มีอะไรให้ disable
    } else {
      this.filterButtons = [{ label: 'Save', key: 'save', color: '#000055' }];
      // ตอนเข้าโหมดแก้ไขใหม่ ๆ ยังไม่เปลี่ยนค่า -> disable Save ไว้ก่อน
      this.disabledKeys = ['save'];
    }
  }

  private setButtonDisabled(key: string, disabled: boolean) {
    const set = new Set(this.disabledKeys);
    if (disabled) set.add(key);
    else set.delete(key);
    this.disabledKeys = Array.from(set);
  }

  public hasFormChanged(): boolean {
    if (!this.initialSnapshot) return false;
    const current = this.formDetails.getRawValue();
    return JSON.stringify(current) !== JSON.stringify(this.initialSnapshot);
  }

  private detailsBaseline: DetailsSnapshot | null = null;

  private buildCurrentDetailsView(): DetailsSnapshot {
    const name = (this.categoryDetailsFG.get('CategoryName')?.value || '').trim();

    const items = (this.categoryDetailsRows || []).map(r => ({
      id: r?.id ?? null,
      questionTH: (r?.questionTH ?? '').trim(),
      questionEN: (r?.questionEN ?? '').trim(),
      sort: (r?.sort ?? r?.sort === 0) ? Number(r.sort) : null,
      activeStatus: !!r?.activeStatus,
      scoringMethod: this.toScoringUnion(r?.scoringMethod),
    }));

    // จัดเรียงเพื่อให้ compare เสถียร
    items.sort((a, b) =>
      (Number(a.id) || 0) - (Number(b.id) || 0) ||
      (a.sort ?? 0) - (b.sort ?? 0) ||
      a.questionTH.localeCompare(b.questionTH) ||
      a.questionEN.localeCompare(b.questionEN)
    );

    return { name, items };
  }

  private isSameDetails(a: DetailsSnapshot, b: DetailsSnapshot): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private clearFormArrayQuietly(fa: any) {
    // หลีกเลี่ยง fa.clear({emitEvent:false}) ถ้าเวอร์ชัน Angular ไม่รองรับ options
    for (let i = fa.length - 1; i >= 0; i--) {
      fa.removeAt(i, { emitEvent: false });
    }
  }

  private makeCacheKey(categoryId: string | number): string {
    return `${this.categoryType || 'default'}:${String(categoryId)}`;
  }

  private readDetailsCache(): Record<string, any> {
    try {
      const raw = sessionStorage.getItem(this.DETAILS_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private writeDetailsCache(obj: Record<string, any>) {
    try {
      sessionStorage.setItem(this.DETAILS_CACHE_KEY, JSON.stringify(obj));
    } catch {}
  }

  private getCachedDetails(categoryId: string | number) {
    const cache = this.readDetailsCache();
    const key = this.makeCacheKey(categoryId);
    return cache[key] ?? null;
  }

  private setCachedDetails(categoryId: string | number, data: {
    CategoryName: string;
    items: Array<{
      id: number | string | null;
      questionTH: string;
      questionEN: string;
      sort: number | null;
      status: 1 | 2;
      scoringMethod: 1 | 2 | null;
    }>;
  }) {
    const cache = this.readDetailsCache();
    const key = this.makeCacheKey(categoryId);
    cache[key] = data;
    this.writeDetailsCache(cache);
  }

  private deleteCachedDetails(categoryId: string | number) {
    const cache = this.readDetailsCache();
    const key = this.makeCacheKey(categoryId);
    if (cache[key]) {
      delete cache[key];
      this.writeDetailsCache(cache);
    }
  }

  private syncCategoryNameToList(categoryId: number | string, name: string) {
    const clean = (name ?? '').trim();
    if (!clean) return;

    const idx = this.categoriesFA.controls.findIndex(
      (fg: FormGroup) => String(fg.value.categoryId) === String(categoryId)
    );

    if (idx > -1) {
      // ไม่ให้กระทบ valueChanges ของฟอร์มหลัก
      this.categoriesFA.at(idx).patchValue({ categoryName: clean }, { emitEvent: false });
      this.rebuildCategoryRowsFromForm();
    }
  }

  private applyCachedNamesToCategoryList() {
    const cache = this.readDetailsCache();
    if (!cache || !Object.keys(cache).length) return;

    // สร้าง index เดิม
    const indexById = new Map<string, number>();
    this.categoriesFA.controls.forEach((fg: FormGroup, i: number) => {
      const id = String(fg.value.categoryId);
      indexById.set(id, i);
    });

    const type = this.categoryType || 'default';

    Object.entries<any>(cache).forEach(([key, cached]) => {
      const [t, id] = key.split(':');
      if (t !== type) return;

      const cachedName = (cached?.CategoryName ?? '').trim();

      // ถ้ามีอยู่แล้ว → อัปเดตชื่อ
      if (indexById.has(String(id))) {
        if (cachedName) {
          const idx = indexById.get(String(id))!;
          this.categoriesFA.at(idx).patchValue({ categoryName: cachedName }, { emitEvent: false });
        }
        return;
      }

      // ถ้ายังไม่มีในตาราง และเป็น temp id → "เพิ่มแถวใหม่" (แสดง Category ใหม่)
      if (this.isTempId(id)) {
        const fg = this.fb.group<CategoryForm>({
          categoryId: id,
          categoryName: cachedName || '-',
          activeStatus: true,
        } as any);
        this.categoriesFA.push(fg, { emitEvent: false });
        // อัปเดต index map กันพลาดหลายตัว
        indexById.set(String(id), this.categoriesFA.length - 1);
      }
    });

    this.rebuildCategoryRowsFromForm(); // อัปเดตรายการซ้าย
  }

  private lastSelectedKey(): string {
    return `aqd:lastSelected:${this.categoryType || 'default'}`;
  }

  private rememberLastSelected(categoryId: number | string) {
    try { sessionStorage.setItem(this.lastSelectedKey(), String(categoryId)); } catch {}
  }

  private getLastSelected(): string | null {
    try { return sessionStorage.getItem(this.lastSelectedKey()); } catch { return null; }
  }

  // เรียกหลังโหลดรายการแล้ว (ใน fetchCategoryTypesDetails)
  private autoOpenLastSelectedIfAny() {
    const last = this.getLastSelected();
    if (!last) return;

    const row = this.categoryRows.find(r => String(r.categoryId) === String(last));
    if (row) {
      // เปิดแบบ view ก็ได้ (หรือ edit ตามต้องการ)
      this.onRowClicked(row, 'view');
    }
  }

  private categoryTypeDraftKey(): string {
    return `${this.CATEGORY_TYPE_DRAFT_PREFIX}:${this.categoryType || 'default'}`;
  }

  private readCategoryTypeDraft(): string | null {
    try { return sessionStorage.getItem(this.categoryTypeDraftKey()); } catch { return null; }
  }

  private writeCategoryTypeDraft(name: string) {
    try { sessionStorage.setItem(this.categoryTypeDraftKey(), name ?? ''); } catch {}
  }

  private clearCategoryTypeDraft() {
    try { sessionStorage.removeItem(this.categoryTypeDraftKey()); } catch {}
  }

  private applyCategoryTypeDraft() {
    const draft = (this.readCategoryTypeDraft() ?? '').trim();
    if (!draft) return;

    // ไม่ให้กระตุ้น valueChanges โดยไม่จำเป็น
    this.formDetails.get('categoryType.CategoryTypeName')
      ?.patchValue(draft, { emitEvent: false });
  }

  private dirtyKey(): string {
    return `${this.DIRTY_PREFIX}:${this.categoryType || 'default'}`;
  }
  private readDirty(): string[] {
    try {
      const raw = sessionStorage.getItem(this.dirtyKey());
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  private writeDirty(ids: string[]) {
    try { sessionStorage.setItem(this.dirtyKey(), JSON.stringify(Array.from(new Set(ids.map(String))))); } catch {}
  }
  private markDirty(categoryId: number | string) {
    const ids = this.readDirty();
    ids.push(String(categoryId));
    this.writeDirty(ids);
  }
  private clearDirty() {
    try { sessionStorage.removeItem(this.dirtyKey()); } catch {}
  }

  private collectDirtyDetailsForPayload() {
    const ids = this.readDirty();                     // ["12","18",...]
    if (!ids.length) return [];

    const cache = this.readDetailsCache();            // key: "<type>:<id>"
    const type = this.categoryType || 'default';
    const list = [];

    for (const id of ids) {
      const entry = cache[`${type}:${String(id)}`];
      if (!entry) continue;
      list.push({
        categoryId: id,
        CategoryName: entry.CategoryName ?? '',
        items: (entry.items ?? []).map((it: any) => ({
          id: it.id ?? null,
          questionTH: (it.questionTH ?? '').trim(),
          questionEN: (it.questionEN ?? '').trim(),
          sort: (it.sort ?? it.sort === 0) ? Number(it.sort) : null,
          status: it.status, // 1/2 ตามที่คุณเก็บใน cache
          scoringMethod: this.toScoringUnion(it.scoringMethod) ?? 1,
        })),
      });
    }
    return list;
  }

  // === Temp Id helpers ===
  private createTempId(): string {
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  }
  private isTempId(id: any): boolean {
    return String(id).startsWith('tmp-');
  }

  public hasPendingDrafts(): boolean {
    const hasDirty = (this.readDirty()?.length ?? 0) > 0;
    const nameDraft = (this.readCategoryTypeDraft() ?? '').trim();
    return hasDirty || !!nameDraft;
  }

  private reflectPendingDraftsUI() {
    const pending = this.hasPendingDrafts();

    // ถ้าอยู่ในโหมดแก้ไขอยู่แล้ว → คงปุ่ม Save ไว้เสมอ
    if (this.isEditing) {
      this.setActionButtons('edit');
      // เปิด/ปิดปุ่ม Save ตามเงื่อนไขจริง
      const enable = pending || this.hasFormChanged();
      this.setButtonDisabled('save', !enable);
      return;
    }

    // ไม่ได้อยู่โหมดแก้ไข
    if (pending) {
      // มี draft → เข้าสู่ edit-mode อัตโนมัติ และเปิดปุ่ม Save
      if (this.formDetails.disabled) this.enterEditMode('draft');
      this.setActionButtons('edit');
      this.setButtonDisabled('save', false);
    } else {
      // ไม่มี draft และไม่ได้อยู่โหมดแก้ไข → โหมด view
      this.setActionButtons('view');
    }
  }

  private enterEditMode(source: 'user' | 'draft' = 'user') {
    this.isEditing = true;
    this.formDetails.enable({ emitEvent: false });

    // การ์ด Details ยังล็อกไว้ก่อน ยกเว้นอยู่ใน Add mode หรือเพิ่งกด Edit Details
    if (this.isEnabledCardDetails && !this.isAddMode && !this.isEditDetails) {
      this.categoryDetailsFG.disable({ emitEvent: false });
    }

    this.setActionButtons('edit');
    // ถ้าเข้าเพราะผู้ใช้กด Edit → รอให้มีการแก้ก่อนถึง enable Save
    // ถ้าเข้าเพราะมี draft → เปิดปุ่ม Save ให้กดได้เลย
    this.setButtonDisabled('save', source === 'user');
  }

  private findDetailsIndexByRow(row: any): number {
    // 1) ถ้ามี id ให้ลองเทียบด้วย id ก่อน
    if (row?.id != null) {
      const byId = this.detailsFA.controls.findIndex((fg: { value: CategoryDetailForm; }) => (fg.value as CategoryDetailForm).id === row.id);
      if (byId > -1) return byId;
    }

    // util สำหรับ normalize ค่า
    const T = (v: any) => (v ?? '').toString().trim();
    const N = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v));
    const B = (v: any) => !!v;

    const qTH = T(row?.questionTH);
    const qEN = T(row?.questionEN);
    const srt = N(row?.sort);
    const act = B(row?.activeStatus);

    // 2) จับคู่ด้วยค่าเนื้อหา (normalize แล้ว)
    let byContent = this.detailsFA.controls.findIndex((fg: { value: CategoryDetailForm; }) => {
      const v = fg.value as CategoryDetailForm;
      return T(v.questionTH) === qTH &&
            T(v.questionEN) === qEN &&
            N(v.sort) === srt &&
            B(v.activeStatus) === act;
    });
    if (byContent > -1) return byContent;

    // 3) เผื่อไว้: ใช้ index ที่โชว์ในตาราง (กรณีไม่มี sort/filter อื่น)
    if (typeof row?.index === 'number') {
      const guess = row.index - 1;
      if (guess >= 0 && guess < this.detailsFA.length) return guess;
    }

    return -1;
  }

  public clearDraftsForCurrentType(): void {
    // ล้าง draft ของชื่อ Category Type
    this.clearCategoryTypeDraft();

    // ล้าง cache รายการ details ของประเภทปัจจุบัน
    const type = this.categoryType || 'default';
    const cache = this.readDetailsCache();
    let changed = false;
    for (const key of Object.keys(cache)) {
      if (key.startsWith(`${type}:`)) {
        delete cache[key];
        changed = true;
      }
    }
    if (changed) this.writeDetailsCache(cache);

    // ล้างรายการ dirty ids
    this.clearDirty();
  }

  toggleActive(): void {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(AlertDialogComponent, {
      width: '640px',
      panelClass: 'custom-dialog-container',
      autoFocus: false,
      disableClose: true,
      data: {
        title: 'Please contact the Human Resources Department',
        message: `For change the status of this category type, please contact our Human Resources Department for assistance.`,
        confirm: false
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');
    });

    // const categoryTypeCtrl = this.formDetails.get('categoryType')?.get('activeStatus');
    // const currentStatus = !!categoryTypeCtrl?.value;
    // categoryTypeCtrl?.setValue(!currentStatus);
    // categoryTypeCtrl?.markAsDirty();
    // categoryTypeCtrl?.markAsTouched();
  }

  onAddClicked() {
    this.isProgrammaticUpdate = true;
    try {
      // เปิดการ์ด + สถานะโหมด
      this.isEnabledCardDetails = true;
      this.isAddMode = true;
      this.isViewMode = false;
      this.isEditMode = false;
      this.isEditDetails = true; // ให้แก้รายละเอียดได้ทันทีในโหมด Add

      // เปิดฟอร์มส่วน details แบบไม่ยิง event
      this.categoryDetailsFG.enable({ emitEvent: false });

      // เคลียร์ค่าเลือก category เดิม
      this.formDetails.patchValue({ selectedCategoryId: null }, { emitEvent: false });

      // รีเซ็ตหัวข้อของการ์ด details
      this.categoryDetailsFG.reset({ CategoryName: '' }, { emitEvent: false });

      // ล้างรายการคำถามแบบเงียบ
      this.clearFormArrayQuietly(this.detailsFA);
      this.categoryDetailsRows = [];

      // baseline สำหรับการ์ด details
      this.detailsBaseline = { name: '', items: [] };

      // 🔑 สำคัญ: ถ่าย snapshot ใหม่ให้สถานะ “หลังเตรียม Add” เป็นจุดอ้างอิง
      this.initialSnapshot = this.formDetails.getRawValue();
      this.formDetails.markAsPristine();

      this.reflectPendingDraftsUI();
    } finally {
      this.isProgrammaticUpdate = false;
    }
  }

  checkFormDetailsChanged(): boolean {
    const current = this.buildCurrentDetailsView();

    // กรณี Add: ต้องมีชื่อ + มีอย่างน้อย 1 แถว
    if (this.isAddMode) {
      return current.name.length > 0 && current.items.length > 0;
    }

    // กรณี Edit: ต้องมีความต่างจาก baseline
    if (this.isEditDetails) {
      if (!this.detailsBaseline) return false;
      return !this.isSameDetails(current, this.detailsBaseline);
    }

    return false;
  }

  fetchCategoryTypesDetails() {
    this.applicationQuestionService.getCategoryTypesInfoQuestionDetails(this.categoryType).subscribe({
      next: (response) => {
        console.log('Category types details fetched successfully:', response);

        sessionStorage.setItem('categoryList', JSON.stringify(response ?? []));

        // สร้าง FormArray ของ categories
        this.categoriesFA.clear({ emitEvent: false });
        (response ?? []).forEach((c: any) => this.categoriesFA.push(this.buildCategoryFG(c), { emitEvent: false }));

        // จับ baseline จากข้อมูล "จริง" ก่อนวาง draft/cache
        this.formDetails.disable({ emitEvent: false });
        this.initialSnapshot = this.formDetails.getRawValue();

        // วาง draft/cache ตามที่ผู้ใช้แก้ค้าง
        this.applyCachedNamesToCategoryList();
        this.applyCategoryTypeDraft();

        // อัปเดตรายการซ้าย
        this.rebuildCategoryRowsFromForm();

        // ถ้ามี draft → โชว์ปุ่ม Save ได้ทันที
        this.reflectPendingDraftsUI();

        // เปิดรายการล่าสุดตามเดิม (จะไม่ไปรีเซ็ต snapshot ถ้ามี draft — ดูข้อ C)
        this.autoOpenLastSelectedIfAny();
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  private rebuildCategoryRowsFromForm() {
    const arr = this.categoriesFA.getRawValue() as CategoryForm[];
    this.categoryRows = arr.map((it, idx) => ({
      categoryId: it.categoryId,
      index: idx + 1,
      categoryName: it.categoryName ?? '-',
      activeStatus: !!it.activeStatus,
      textlinkActions: ['view', 'edit-topopup'], // ปรับตามสิทธิ์ได้
    }));
  }

  private rebuildDetailsRowsFromForm() {
    const arr = this.detailsFA.getRawValue() as CategoryDetailForm[];
    this.categoryDetailsRows = arr.map((it, idx) => ({
      id: it.id,
      index: idx + 1,
      questionTH: it.questionTH,
      questionEN: it.questionEN,
      sort: it.sort,
      activeStatus: !!it.activeStatus,
      scoringMethod: this.scoringLabel(it.scoringMethod),
      textlinkActions: ['edit-inrow','delete'], // อาจปรับตามสิทธิ์จาก API
    }));
  }

  private toScoringUnion(v: any): 1 | 2 | null {
    if (v === 1 || v === '1' || v === 'Normal') return 1;
    if (v === 2 || v === '2' || v === 'Reverse') return 2;
    return null;
  }
  private scoringLabel(u: 1 | 2 | null): 'Normal' | 'Reverse' | '' {
    return u === 2 ? 'Reverse' : u === 1 ? 'Normal' : '';
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit':
        this.onEditClicked();
        break;
      case 'save':
        this.onSaveClicked();
        break;
    }
  }

  onEditClicked() {
    console.log('Edit button clicked');
    // snapshot ตอนเริ่มแก้ไข
    this.initialSnapshot = this.formDetails.getRawValue();
    // เข้าโหมดแก้ไข (มาจากการกดของผู้ใช้)
    this.enterEditMode('user');
  }

  onSaveClicked() {
    if (!this.hasFormChanged() && !this.hasPendingDrafts()) return;

    const value = this.formDetails.getRawValue();
    const dirtyDetailsList = this.collectDirtyDetailsForPayload();

    // รองรับทั้ง “อันเดียว” และ “หลายอัน”
    const payload: any = {
      categoryType: {
        name: value.categoryType.CategoryTypeName,
        isActive: !!value.categoryType.activeStatus,
      },
      categories: (value.categories ?? []).map((c: CategoryForm) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        isActive: !!c.activeStatus,
      })),
    };

    if (dirtyDetailsList.length === 1) {
      payload.selectedCategoryId = dirtyDetailsList[0].categoryId;
      payload.categoryDetails = {
        CategoryName: dirtyDetailsList[0].CategoryName,
        items: dirtyDetailsList[0].items,
      };
    } else if (dirtyDetailsList.length > 1) {
      payload.selectedCategoryId = null;
      payload.categoryDetailsList = dirtyDetailsList; // <-- ✅ หลายหมวด
    } else {
      // ไม่มี draft รายละเอียด ก็ไม่ต้องส่งส่วน details
      payload.selectedCategoryId = null;
      payload.categoryDetailsList = [];
    }

    console.log('SAVE payload:', payload);
    // TODO: เรียก API จริง แล้วทำต่อเมื่อ success

    // เคลียร์ draft และ cache ทั้งหมดหลังบันทึกสำเร็จ
    this.clearCategoryTypeDraft();     // ล้าง draft ชื่อ Category Type
    for (const d of dirtyDetailsList) {
      this.deleteCachedDetails(d.categoryId);
    }
    this.clearDirty();                 // ล้างรายการ dirty ให้หมด

    this.isEditing = false;
    this.formDetails.disable({ emitEvent: false });
    this.initialSnapshot = this.formDetails.getRawValue();
    this.setActionButtons('view');
  }

  onSaveDetailsClicked() {
    console.log('Save Details button clicked');
    if (!this.checkFormDetailsChanged()) return;

    let categoryId = this.formDetails.get('selectedCategoryId')?.value;

    // อ่านค่าจากฟอร์มปัจจุบันเพื่อนำไปแคช
    const name = (this.categoryDetailsFG.get('CategoryName')?.value || '').trim();
    const itemsFA = (this.detailsFA.getRawValue() || []) as CategoryDetailForm[];
    const itemsForCache = itemsFA.map(d => ({
      id: d.id ?? null,
      questionTH: (d.questionTH ?? '').trim(),
      questionEN: (d.questionEN ?? '').trim(),
      sort: (d.sort ?? d.sort === 0) ? Number(d.sort) : null,
      status: d.activeStatus ? 1 as const : 2 as const,
      scoringMethod: this.toScoringUnion(d.scoringMethod) ?? 1,
    }));

    // เคส "เพิ่มใหม่": ยังไม่มี selectedCategoryId (null) + อยู่ใน Add mode
    if (this.isAddMode && (categoryId == null)) {
      const tempId = this.createTempId();
      categoryId = tempId;

      // 1) set selectedCategoryId เป็น temp id โดยไม่ยิง valueChanges
      this.formDetails.patchValue({ selectedCategoryId: tempId }, { emitEvent: false });

      // 2) push แถวใหม่เข้า categories (เพื่อให้ตารางซ้ายแสดง Category ใหม่ทันที)
      const fg = this.fb.group<CategoryForm>({
        categoryId: tempId,
        categoryName: name || '-',
        activeStatus: true,
      } as any);
      this.categoriesFA.push(fg, { emitEvent: false });
      this.rebuildCategoryRowsFromForm();

      // 3) จดจำ last selected ไว้เปิดอัตโนมัติหลังรีโหลด
      this.rememberLastSelected(tempId);
    }

    // จากนี้เหมือนเดิม: เซฟลง cache + sync ชื่อ + markDirty
    this.setCachedDetails(categoryId, { CategoryName: name, items: itemsForCache });
    this.syncCategoryNameToList(categoryId, name);
    this.markDirty(categoryId);

    // ปรับ baseline/สแน็ปช็อต
    this.detailsBaseline = this.buildCurrentDetailsView();

    // ไม่แตะ initialSnapshot หลัก เพื่อให้ Save หลักยัง "พร้อมกด"
    // อัปเดต UI ให้เห็นปุ่ม Save ได้ทันทีหลังเซฟ details
    this.reflectPendingDraftsUI();

    console.log('Saved to cache for categoryId=', categoryId);
    // กลับไปเป็นโหมดอ่านอย่างเดียวของการ์ด details
    this.categoryDetailsFG.disable({ emitEvent: false });

    // โชว์ปุ่ม "Edit" อีกครั้ง (และซ่อน "Save Details")
    this.isEditDetails = false;
    this.isAddMode = false;     // จบ flow เพิ่มใหม่
    this.isEditMode = true;     // ยังอยู่ในโหมดแก้ไขหลักของหน้า
    this.isViewMode = false;    // เผื่อกรณี state เพี้ยน
  }

  onAddQuestionClicked() {
    console.log('Add button clicked');
    this.isAddingRow = true;
    this.categoryDetailsTable.startInlineCreate({ activeStatus: false, status: 0, scoringMethod: 'Normal' }, 'bottom');
  }

  onToggleChange(event: Event): void {
    console.log('Toggle change event:', event);
  }

  onRowClicked(row: any, action: 'view' | 'edit') {
    this.rememberLastSelected(row?.categoryId);

    this.buildColumnsFor(row?.categoryId);

    this.isProgrammaticUpdate = true;

    console.log('View row clicked:', row);
    this.isEnabledCardDetails = true;
    if (action === 'view') {
      this.isViewMode = true;
      this.isAddMode = false;
      this.isEditMode = false;
      this.isEditDetails = false;
    } else {
      this.isViewMode = false;
      this.isAddMode = false;
      this.isEditMode = true;
      this.isEditDetails = false;
    }

    this.setColumnsFor(row?.categoryId);

    this.formDetails.patchValue({
      selectedCategoryId: row?.categoryId ?? null,
      categoryDetails: { CategoryName: row?.categoryName ?? '' }
    }, { emitEvent: false });

    const categoryId = row?.categoryId;
    const cached = categoryId != null ? this.getCachedDetails(categoryId) : null;

    if (cached) {
      // ===== โหลดจากแคช =====
      console.log('Load details from cache for categoryId=', categoryId, cached);

      // ตั้งชื่อหมวดหมู่จากแคช (เชื่อถือแคชเป็นหลัก)
      this.categoryDetailsFG.patchValue(
        { CategoryName: cached.CategoryName ?? row?.categoryName ?? '' },
        { emitEvent: false }
      );

      // เคลียร์และเติมรายการจากแคช
      this.clearFormArrayQuietly(this.detailsFA);
      (cached.items ?? []).forEach((d: any) => {
        // ใช้ buildDetailFG ที่รองรับ d.status === 1
        this.detailsFA.push(this.buildDetailFG(d), { emitEvent: false });
      });
      this.rebuildDetailsRowsFromForm();

      // การ์ดยัง disabled (จนกว่าจะกด Edit Details)
      this.categoryDetailsFG.disable({ emitEvent: false });

      // baseline/snapshot สำหรับการเทียบ diff และปิดปุ่ม Save บนสุด
      this.detailsBaseline = this.buildCurrentDetailsView();

      // อย่ารื้อ baseline หลักถ้ามี draft ค้างอยู่
      if (!this.hasPendingDrafts()) {
        this.initialSnapshot = this.formDetails.getRawValue();
      }

      // ปรับปุ่มให้สะท้อนสถานะปัจจุบัน
      this.reflectPendingDraftsUI();

      this.isProgrammaticUpdate = false;
      return; // จบที่แคช ไม่ต้องยิง API
    }

    this.applicationQuestionService.getQuestionsByCategory(row.categoryId).subscribe({
      next: (response) => {
        console.log('Questions fetched successfully:', response);

        this.clearFormArrayQuietly(this.detailsFA);
        (response ?? []).forEach((d: any) => this.detailsFA.push(this.buildDetailFG(d), { emitEvent: false }));
        this.rebuildDetailsRowsFromForm();

        this.categoryDetailsFG.disable({ emitEvent: false });
        this.detailsBaseline = this.buildCurrentDetailsView();

        if (!this.hasPendingDrafts()) {
          this.initialSnapshot = this.formDetails.getRawValue();
          this.formDetails.markAsPristine();
        }
        // จากนั้นสะท้อนสถานะปุ่มตาม draft
        this.reflectPendingDraftsUI();
      },
      error: (error) => {
        console.error('Error fetching questions:', error);
      },
      complete: () => {
        this.isProgrammaticUpdate = false;
      }
    });
  }

  onToggleChangeCategory(e: { row: any; checked: boolean; checkbox: HTMLInputElement }) {
    const row = e.row;
    const idx = this.categoriesFA.controls.findIndex((fg: FormGroup) => fg.value.categoryId === row.categoryId);
    if (idx > -1) {
      this.categoriesFA.at(idx).patchValue({ activeStatus: e.checked });
      e.checkbox.checked = e.checked; // sync ฝั่ง UI
      this.rebuildCategoryRowsFromForm();
    }
  }

  // toggle ในตาราง Category Details
  onToggleChangeDetails(e: { row: any; checked: boolean; checkbox: HTMLInputElement }) {
    const row = e.row;
    const idx = this.detailsFA.controls.findIndex((fg: FormGroup) => fg.value.id === row.id);
    if (idx > -1) {
      this.detailsFA.at(idx).patchValue({ activeStatus: e.checked });
      e.checkbox.checked = e.checked;
      this.rebuildDetailsRowsFromForm();
    }
  }

  onEditDetailsClicked() {
    console.log('Edit Details button clicked');
    this.categoryDetailsFG.enable();
    this.isEditDetails = true;
  }

  onInlineSave(payload: any) {
    this.isAddingRow = false;
    console.log('Inline save payload:', payload);

    const scoring: 1 | 2 | null =
      payload.scoringMethod === 'Reverse' ? 2 :
      payload.scoringMethod === 'Normal'  ? 1 :
      (payload.scoringMethod === 2 || payload.scoringMethod === '2') ? 2 :
      (payload.scoringMethod === 1 || payload.scoringMethod === '1') ? 1 :
      1; // default Normal

    // 1) แปลงค่าจาก payload ให้ตรงกับโครงสร้างฟอร์ม
    const normalized = {
      id: payload.id ?? null,
      questionTH: (payload.questionTH ?? '').trim(),
      questionEN: (payload.questionEN ?? '').trim(),
      sort: payload.sort !== undefined && payload.sort !== null ? Number(payload.sort) : null,
      // รองรับทั้ง activeStatus แบบ boolean และ status แบบ 1/2
      activeStatus: payload.activeStatus ?? (payload.status === 1),
      scoringMethod: scoring,
    };

    // 2) push เข้า FormArray (source of truth)
    this.detailsFA.push(
      this.fb.group<CategoryDetailForm>(normalized as any)
      // หรือใช้ this.buildDetailFG({ ...normalized, status: normalized.activeStatus ? 1 : 2 })
    );

    // 3) rebuild rows ให้ตารางอัปเดต
    this.rebuildDetailsRowsFromForm();

    // 4) ทำให้ฟอร์มรู้ว่ามีการเปลี่ยน (ปุ่ม Save จะ enabled)
    this.categoryDetailsFG.markAsDirty();
    this.formDetails.markAsDirty();

    // 5) (ออปชัน) เลื่อนลงล่างให้เห็นแถวใหม่ทันที
    setTimeout(() => {
      try {
        this.categoryDetailsTable?.tableWrapperRef?.nativeElement?.scrollTo({
          top: this.categoryDetailsTable?.tableWrapperRef?.nativeElement?.scrollHeight ?? 0,
          behavior: 'smooth'
        });
      } catch {}
    }, 0);

    console.log('Inline save payload:', payload, '→ added:', normalized);
  }

  onDeleteRowClicked(row: any) {
    console.log('Delete row clicked:', row);
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
        caseSensitive: false
      }
    });

    dialogRef.afterClosed().subscribe(async (ok: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (!ok) return; // ยกเลิกถ้า CAPTCHA ไม่ผ่าน/กด Cancel

      // --- หา index ของแถวใน FormArray ---
      let idx = this.findDetailsIndexByRow(row);

      if (idx < 0) {
        console.warn('Row not found in FormArray, skip delete.');
        return;
      }

      // --- Optimistic update: ลบทันทีใน UI ---
      const backup = this.detailsFA.at(idx).value as CategoryDetailForm;
      this.detailsFA.removeAt(idx);
      this.rebuildDetailsRowsFromForm();
      this.categoryDetailsFG.markAsDirty();
      this.formDetails.markAsDirty();
    });
  }

  onInlineCancel() {
    this.isAddingRow = false;
    this.fieldErrors = false;
  }

  onSelectChangedDetails(e: { rowIndex: number; field: string; value: string }) {
    if (e.field !== 'scoringMethod') return;
    const idx = e.rowIndex;
    if (idx < 0 || idx >= this.detailsFA.length) return;

    const numeric = e.value === 'Reverse' ? 2 : 1;
    this.detailsFA.at(idx).patchValue({ scoringMethod: numeric }, { emitEvent: false });
  }

  ngOnDestroy() {
    this.isProgrammaticUpdate = true;
    this.destroy$.next();
    this.destroy$.complete();

    this.formDetails.reset();
    this.categoryRows = [];
    this.categoryDetailsRows = [];
    this.isEnabledCardDetails = false;
    this.isEditing = false;
    this.isViewMode = false;
    this.isAddMode = false;
    this.isEditMode = false;
    this.isEditDetails = false;

    sessionStorage.removeItem('categoryList');
  }
}
