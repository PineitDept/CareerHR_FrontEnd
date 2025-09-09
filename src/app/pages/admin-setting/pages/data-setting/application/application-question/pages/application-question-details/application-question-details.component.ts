import { Component, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApplicationQuestionService } from '../../../../../../../../services/admin-setting/application-question/application-question.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Column, Columns } from '../../../../../../../../shared/interfaces/tables/column.interface';
import { TablesComponent } from '../../../../../../../../shared/components/tables/tables.component';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { CaptchaDialogComponent } from '../../../../../../../../shared/components/dialogs/captcha-dialog/captcha-dialog.component';
import { debounceTime, distinctUntilChanged, map, Subject, takeUntil } from 'rxjs';
import { ConfirmChangesDialogComponent } from '../../../../../../../../shared/components/dialogs/confirm-changes-dialog/confirm-changes-dialog.component';
import { ConfirmChangesData } from '../../../../../../../../shared/interfaces/dialog/dialog.interface';
import { NotificationService } from '../../../../../../../../shared/services/notification/notification.service';

type CategoryForm = {
  categoryId: number | string | null;
  categoryName: string;
  activeStatus: boolean;
};

type CategoryDetailForm = {
  id: number | string | null;
  questionTH: string;
  questionEN: string;
  type: string;
  sort: number | null;
  activeStatus: boolean;
  scoringMethod: number | null;
};

interface DetailsSnapshot {
  name: string;
  items: Array<{
    id: number | string | null;
    questionTH: string;
    questionEN: string;
    type: string;
    sort: number | null;
    activeStatus: boolean;
    scoringMethod: number | null;
  }>;
}

type QuestionPayload = {
  id: number | null;
  questionTH: string;
  questionEN: string;
  type: string;
  sort: number | 0;
  scoringMethod: number | null;   // <- ไม่มีให้ส่ง null
  isActive: boolean;
  isDeleted: boolean;
};

type CategorySavePayload = {
  categoryId: number | null;      // <- ใหม่ให้เป็น null
  categoryName: string;
  categoryType: string;
  isCategoryActive: boolean;      // <- ส่ง true เสมอ
  questions: QuestionPayload[];
};

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

  filterButtons: { label: string; key: string; color: string }[] = [];
  disabledKeys: string[] = [];

  categoryType: string = '';
  formDetails!: FormGroup;

  categoryColumns: Columns = [
    { header: 'No.', field: 'index', type: 'text', align: 'center', width: '4%' },
    { header: 'Category Name', field: 'categoryName', type: 'text', width: '71%' },
    { header: 'Status', field: 'activeStatus', type: 'toggle', align: 'center', width: '7%' },
    { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '18%', textlinkActions: ['view'] }
  ];

  baseCategoryDetailsColumns: Columns = [
    { header: 'No.', field: '__index', type: 'number', align: 'center', width: '4%' },
    { header: 'Question (TH)', field: 'questionTH', type: 'text', width: '30%', wrapText: true },
    { header: 'Question (EN)', field: 'questionEN', type: 'text', width: '30%', wrapText: true },
    { header: 'Type', field: 'type', type: 'select', align: 'center', width: '12%', options: ['Answer', 'Value'] },
    { header: 'Status', field: 'activeStatus', type: 'toggle', align: 'center', width: '8%' },
    { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '16%', textlinkActions: ['edit-inrow','delete'] },
  ];

  scoringColumnDef: Column = {
    header: 'Scoring Method',
    field: 'scoringMethod',
    type: 'select',
    align: 'center',
    width: '12%',
    options: ['Normal', 'Reverse'],
  };

  category2NumberColumn: Column = {
    header: 'Row Answer',
    field: 'scoringMethod',
    type: 'number',
    align: 'center',
    width: '10%',
  };

  categoryDetailsColumns: Columns = [...this.baseCategoryDetailsColumns];
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

  private readonly DETAILS_CACHE_KEY = 'categoryDetailsCache';
  private readonly CATEGORY_TYPE_DRAFT_PREFIX = 'categoryTypeDraft';
  private readonly DIRTY_PREFIX = 'aqd:dirty';

  private destroy$ = new Subject<void>();

  detailsRequiredFooterFields: string[] = ['questionTH','questionEN','type'];

  private pendingCategoryNameDraft: string | null = null;
  private readonly DETAILS_BASELINE_STORE = 'aqd:detailsBaseline';

  /** เก็บ response ดิบไว้ใช้สร้าง snapshot รายหมวด */
  private categoryListRaw: any[] = [];

  /** อนุญาตแก้ไขเฉพาะแถวล่าสุด */
  canEditSelectedCategory = false;

  /*** Revision History state ***/
  revisionOptions: number[] = [];
  currentRevision: number = 1;

  private historyStateByCat = new Map<string, { revision: number; page: number; totalPages: number }>();

  isViewingRevisionHistory = false; // true เมื่อกำลังดูข้อมูลย้อนหลังตาม revision

  constructor(
    private route: ActivatedRoute,
    private applicationQuestionService: ApplicationQuestionService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private notify: NotificationService,
  ) { }

  ngOnInit() {
    this.initializeForm();

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
        this.setColumnsFor();
        this.formDetails.patchValue({
          categoryType: {
            CategoryTypeName: this.categoryType,
            activeStatus: true
          }
        }, { emitEvent: false });
        this.fetchCategoryTypesDetails();
      });

    this.categoryDetailsFG.get('CategoryName')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        map(v => (v ?? '').trim()),
        debounceTime(600),
        distinctUntilChanged()
      )
      .subscribe((name) => {
        if (!this.isEnabledCardDetails) return;
        if (this.isProgrammaticUpdate) return;
        this.pendingCategoryNameDraft = name;
      });
  }

  initializeForm() {
    this.formDetails = this.fb.group({
      categoryType: this.fb.group({
        CategoryTypeName: [{ value: '', disabled: true }],
        activeStatus: [true],
      }),
      categories: this.fb.array<FormGroup>([]),
      selectedCategoryId: [null],
      categoryDetails: this.fb.group({
        CategoryName: [''],
        items: this.fb.array<FormGroup>([]),
      }),
    });
  }

  get categoriesFA() { return this.formDetails.get('categories') as any; }
  get categoryDetailsFG() { return this.formDetails.get('categoryDetails') as FormGroup; }
  get detailsFA() { return this.categoryDetailsFG.get('items') as any; }
  get isDisabled() { return this.categoryDetailsFG.disabled; }

  private baseWithTypeWidths: Record<string, string> = {
    '__index': '4%', 'questionTH': '30%', 'questionEN': '30%', 'type': '12%', 'activeStatus': '8%', 'textlink': '16%',
  };
  private withScoringSelectWidths: Record<string, string> = {
    '__index': '4%', 'questionTH': '24%', 'questionEN': '24%', 'type': '12%', 'scoringMethod': '12%', 'activeStatus': '8%', 'textlink': '16%',
  };
  private withScoringNumberWidths: Record<string, string> = {
    '__index': '4%', 'questionTH': '26%', 'questionEN': '26%', 'type': '12%', 'scoringMethod': '10%', 'activeStatus': '8%', 'textlink': '14%',
  };

  private get isQuiz2(): boolean   { return this.categoryType === 'Quiz2'; }
  private get isAboutMe(): boolean { return this.categoryType === 'AboutMe'; }

  private applyWidths(cols: Columns, widths: Record<string,string>): Columns {
    return cols.map(c => ({ ...c, width: widths[c.field] ?? c.width }));
  }

  private setColumnsFor() {
    if (this.isQuiz2) {
      const statusIdx = this.baseCategoryDetailsColumns.findIndex(c => c.field === 'activeStatus');
      const withScoring = [
        ...this.baseCategoryDetailsColumns.slice(0, statusIdx),
        this.scoringColumnDef,
        ...this.baseCategoryDetailsColumns.slice(statusIdx),
      ];
      this.categoryDetailsColumns = this.applyWidths(withScoring, this.withScoringSelectWidths);
      this.tableCreateDefaults = { type: 'Answer', scoringMethod: 'Normal' };
      this.detailsRequiredFooterFields = ['questionTH','questionEN','type'];
      return;
    }
    if (this.isAboutMe) {
      const statusIdx = this.baseCategoryDetailsColumns.findIndex(c => c.field === 'activeStatus');
      const withNumber = [
        ...this.baseCategoryDetailsColumns.slice(0, statusIdx),
        this.category2NumberColumn,
        ...this.baseCategoryDetailsColumns.slice(statusIdx),
      ];
      this.categoryDetailsColumns = this.applyWidths(withNumber, this.withScoringNumberWidths);
      this.tableCreateDefaults = { type: 'Answer', scoringMethod: 1 };
      this.detailsRequiredFooterFields = ['questionTH','questionEN','type','scoringMethod'];
      return;
    }
    this.categoryDetailsColumns = this.applyWidths([...this.baseCategoryDetailsColumns], this.baseWithTypeWidths);
    this.tableCreateDefaults = { type: 'Answer' };
    this.detailsRequiredFooterFields = ['questionTH','questionEN','type'];
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
      type: (r?.type ?? 'Answer'),
      sort: (r?.sort ?? r?.sort === 0) ? Number(r.sort) : null,
      activeStatus: !!r?.activeStatus,
      scoringMethod: this.isQuiz2 ? (r?.scoringMethod === 'Reverse' ? 2 : 1) :
                    (r?.scoringMethod ?? null),
    }));

    items.sort((a: any, b: any) =>
      (Number(a.id)||0)-(Number(b.id)||0) ||
      (a.sort ?? 0) - (b.sort ?? 0) ||
      a.questionTH.localeCompare(b.questionTH) ||
      a.questionEN.localeCompare(b.questionEN) ||
      a.type.localeCompare(b.type)
    );

    return { name, items };
  }

  private isSameDetails(a: DetailsSnapshot, b: DetailsSnapshot): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private clearFormArrayQuietly(fa: any) {
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
      type: string;
      sort: number | null;
      status: 1 | 0;
      scoringMethod: number | null;
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
      this.categoriesFA.at(idx).patchValue({ categoryName: clean }, { emitEvent: false });
      this.rebuildCategoryRowsFromForm();
    }
  }

  private applyCachedNamesToCategoryList() {
    const cache = this.readDetailsCache();
    if (!cache || !Object.keys(cache).length) return;

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

      if (indexById.has(String(id))) {
        if (cachedName) {
          const idx = indexById.get(String(id))!;
          this.categoriesFA.at(idx).patchValue({ categoryName: cachedName }, { emitEvent: false });
        }
        return;
      }

      if (this.isTempId(id)) {
        const fg = this.fb.group<CategoryForm>({
          categoryId: id,
          categoryName: cachedName || '-',
          activeStatus: true,
        } as any);
        this.categoriesFA.push(fg, { emitEvent: false });
        indexById.set(String(id), this.categoriesFA.length - 1);
      }
    });

    this.rebuildCategoryRowsFromForm();
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

  private autoOpenLastSelectedIfAny() {
    const last = this.getLastSelected();

    // พยายามเปิดตาม last selected ก่อน
    let row = last
      ? this.categoryRows.find(r => String(r.categoryId) === String(last))
      : undefined;

    // ถ้าไม่มี last selected หรือหาไม่เจอ ⇒ เปิด "แถวล่าสุด" (ตัวท้ายของตาราง)
    if (!row && this.categoryRows.length) {
      row = this.categoryRows[this.categoryRows.length - 1];
    }

    if (row) this.onRowClicked(row, 'view');
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

  private createTempId(): string {
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  }
  private isTempId(id: any): boolean {
    return String(id).startsWith('tmp-');
  }

  public hasPendingDrafts(): boolean {
    const hasDirty = (this.readDirty()?.length ?? 0) > 0;
    const nameDraft = (this.readCategoryTypeDraft() ?? '').trim();
    const hasCache = this.hasAnyCachedDraftsForCurrentType();
    return hasDirty || !!nameDraft || hasCache;
  }
  private hasAnyCachedDraftsForCurrentType(): boolean {
    const type = this.categoryType || 'default';
    const cache = this.readDetailsCache();
    return Object.keys(cache).some(k => k.startsWith(`${type}:`));
  }

  private reflectPendingDraftsUI() {
    const pending = this.hasPendingDrafts();
    if (this.isEditing) {
      this.setActionButtons('edit');
      const enable = pending || this.hasFormChanged();
      this.setButtonDisabled('save', !enable);
      return;
    }
    if (pending) {
      if (this.formDetails.disabled) this.enterEditMode('draft');
      this.setActionButtons('edit');
      this.setButtonDisabled('save', false);
    } else {
      this.setActionButtons('view');
    }
  }

  private enterEditMode(source: 'user' | 'draft' = 'user') {
    this.isEditing = true;
    this.formDetails.enable({ emitEvent: false });

    if (this.isEnabledCardDetails && !this.isAddMode && !this.isEditDetails) {
      this.categoryDetailsFG.disable({ emitEvent: false });
    }
    this.formDetails.get('categoryType.CategoryTypeName')?.disable({ emitEvent: false });

    this.setActionButtons('edit');
    this.setButtonDisabled('save', source === 'user');
  }

  private findDetailsIndexByRow(row: any): number {
    const T = (v: any) => (v ?? '').toString().trim();
    const N = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v));
    const B = (v: any) => !!v;

    if (row?.id != null) {
      const byId = this.detailsFA.controls.findIndex(
        (fg: { value: CategoryDetailForm; }) => (fg.value as CategoryDetailForm).id === row.id
      );
      if (byId > -1) return byId;
    }

    const srt = N(row?.sort);
    if (srt != null) {
      const bySort = this.detailsFA.controls.findIndex(
        (fg: { value: CategoryDetailForm; }) => N((fg.value as CategoryDetailForm).sort) === srt
      );
      if (bySort > -1) return bySort;
    }

    const qTH = T(row?.questionTH);
    const qEN = T(row?.questionEN);
    const act = B(row?.activeStatus);

    const byContent = this.detailsFA.controls.findIndex((fg: { value: CategoryDetailForm; }) => {
      const v = fg.value as CategoryDetailForm;
      return T(v.questionTH) === qTH &&
            T(v.questionEN) === qEN &&
            N(v.sort)       === srt &&
            B(v.activeStatus) === act;
    });
    if (byContent > -1) return byContent;

    if (typeof row?.index === 'number') {
      const guess = row.index - 1;
      if (guess >= 0 && guess < this.detailsFA.length) return guess;
    }

    return -1;
  }

  public clearDraftsForCurrentType(): void {
    this.clearCategoryTypeDraft();

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
    this.clearDirty();
  }

  onAddClicked() {
    this.isProgrammaticUpdate = true;
    try {
      this.isEnabledCardDetails = true;
      this.setColumnsFor();
      this.isAddMode = true;
      this.isViewMode = false;
      this.isEditMode = false;
      this.isEditDetails = true;

      // หมวดใหม่ถือว่าแก้ไขได้
      this.canEditSelectedCategory = true;

      this.categoryDetailsFG.enable({ emitEvent: false });
      this.formDetails.patchValue({ selectedCategoryId: null }, { emitEvent: false });
      this.categoryDetailsFG.reset({ CategoryName: '' }, { emitEvent: false });

      this.clearFormArrayQuietly(this.detailsFA);
      this.categoryDetailsRows = [];

      this.detailsBaseline = { name: '', items: [] };

      this.initialSnapshot = this.formDetails.getRawValue();
      this.formDetails.markAsPristine();

      this.reflectPendingDraftsUI();

      /*** reset footer state for new category ***/
      this.revisionOptions = [1];
      this.currentRevision = 1;
    } finally {
      this.isProgrammaticUpdate = false;
    }
  }

  checkFormDetailsChanged(): boolean {
    const current = this.buildCurrentDetailsView();
    if (this.isAddMode) {
      return current.name.length > 0 && current.items.length > 0;
    }
    if (this.isEditDetails) {
      if (!this.detailsBaseline) return false;
      return !this.isSameDetails(current, this.detailsBaseline);
    }
    return false;
  }

  /*** ปรับให้ map จาก response ใหม่ และตั้ง baseline สำหรับทุก category ***/
  fetchCategoryTypesDetails() {
    this.applicationQuestionService.getCategoryTypesInfoQuestionDetails(this.categoryType).subscribe({
      next: (response) => {
        // เก็บ raw และ cache ไว้
        this.categoryListRaw = Array.isArray(response) ? response : [];
        sessionStorage.setItem('categoryList', JSON.stringify(this.categoryListRaw));

        // เตรียมแถว Category table
        this.categoriesFA.clear({ emitEvent: false });
        this.categoryListRaw.forEach((c: any) => {
          this.categoriesFA.push(
            this.buildCategoryFG({
              categoryId: c?.categoryId,
              categoryName: c?.categoryName,
              isActive: c?.isActive,
            }),
            { emitEvent: false }
          );

          // สร้าง baseline details ของ category จาก revision ล่าสุดของแต่ละ item
          const snap = this.mapCategoryToBaselineSnapshot(c);
          this.setBaselineFor(c?.categoryId, snap);
        });

        this.formDetails.disable({ emitEvent: false });
        this.initialSnapshot = this.formDetails.getRawValue();

        this.applyCachedNamesToCategoryList();
        this.applyCategoryTypeDraft();
        this.rebuildCategoryRowsFromForm();

        this.reflectPendingDraftsUI();
        this.autoOpenLastSelectedIfAny();
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
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
      type: (d?.type ?? 'Answer'),
      sort: d?.sort ?? null,
      activeStatus: d?.status === 1 ? true : false,
      scoringMethod: this.normalizeScoring(d?.scoringMethod),
    } as any);
  }

  private normalizeScoring(v: any): number | null {
    if (v === undefined || v === null) return null;
    if (typeof v === 'string') {
      if (v === 'Normal') return 1;
      if (v === 'Reverse') return 2;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return Number.isFinite(Number(v)) ? Number(v) : null;
  }

  private setActionButtons(_mode?: 'view' | 'edit') {
    this.filterButtons = [{ label: 'Save', key: 'save', color: '#000055' }];
    this.disabledKeys = ['save'];
  }

  private setButtonDisabled(key: string, disabled: boolean) {
    const set = new Set(this.disabledKeys);
    if (disabled) set.add(key);
    else set.delete(key);
    this.disabledKeys = Array.from(set);
  }

  private rebuildCategoryRowsFromForm() {
    const arr = this.categoriesFA.getRawValue() as CategoryForm[];
    this.categoryRows = arr.map((it, idx) => ({
      categoryId: it.categoryId,
      index: idx + 1,
      categoryName: it.categoryName ?? '-',
      activeStatus: !!it.activeStatus,
      textlinkActions: ['view'],
    }));
  }

  private rebuildDetailsRowsFromForm() {
    const arr = this.detailsFA.getRawValue() as CategoryDetailForm[];
    this.categoryDetailsRows = arr.map((it) => ({
      id: it.id,
      questionTH: it.questionTH,
      questionEN: it.questionEN,
      type: it.type,
      sort: it.sort,
      activeStatus: !!it.activeStatus,
      scoringMethod: this.isQuiz2 ? (it.scoringMethod === 2 ? 'Reverse' : 'Normal') : it.scoringMethod,
      textlinkActions: ['edit-inrow','delete'],
    }));
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'save': this.onSaveClicked(); break;
    }
  }

  onSaveClicked() {
    if (!this.hasFormChanged() && !this.hasPendingDrafts()) return;

    const changeGroups = this.collectDiffsBeforeSave();
    const total = changeGroups.reduce((acc, g) => acc + g.items.length, 0);
    if (total === 0) return;

    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dirtyForPayload = this.collectDirtyDetailsForPayload();
    const isPureCreate = dirtyForPayload.length === 1 && this.isNewCategoryId(dirtyForPayload[0].categoryId);

    const dialogRef = this.dialog.open(ConfirmChangesDialogComponent, {
      width: '856px',
      panelClass: 'custom-dialog-container',
      disableClose: true,
      autoFocus: false,
      data: {
        title: isPureCreate ? 'Create new category?' : 'Please confirm your changes',
        groups: changeGroups,
        confirm: true,
      } as ConfirmChangesData
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');
      if (!confirmed) return;

      const dirtyIds = this.readDirty();
      if (!dirtyIds.length) return;

      const payloads: CategorySavePayload[] = [];

      dirtyIds.forEach((cid) => {
        const current =
          this.buildSnapshotFromCache(cid) ||
          (String(this.formDetails.get('selectedCategoryId')?.value) === String(cid)
            ? this.buildCurrentDetailsView()
            : null);

        const baseline = this.getBaselineFor(cid) || { name: '', items: [] };

        if (current) {
          payloads.push(this.buildCategorySavePayload(cid, current, baseline));
        }
      });

      // ส่งเป็น "อาเรย์" ตรงตามสเปคใหม่
      this.applicationQuestionService.saveApplicationQuestionDetails(payloads).subscribe({
        next: () => {
          dirtyIds.forEach((cid) => {
            this.deleteCachedDetails(cid);
            this.deleteBaselineFor(cid);
          });
          this.clearDirty();
          this.clearCategoryTypeDraft();

          this.isEditing = false;
          this.formDetails.disable({ emitEvent: false });
          this.initialSnapshot = this.formDetails.getRawValue();
          this.setActionButtons('view');

          this.fetchCategoryTypesDetails();

          this.notify.success('Your changes have been saved successfully.');
        },
        error: (err) => {
          const msg = err?.error?.message || err?.message || 'Something went wrong while saving.';
          this.notify.error(msg);
        }
      });
    });
  }

  onSaveDetailsClicked() {
    if (!this.checkFormDetailsChanged()) return;

    let categoryId = this.formDetails.get('selectedCategoryId')?.value;

    const name = (this.categoryDetailsFG.get('CategoryName')?.value || '').trim();
    const itemsFA = (this.detailsFA.getRawValue() || []) as CategoryDetailForm[];
    const itemsForCache = itemsFA.map(d => ({
      id: d.id ?? null,
      questionTH: (d.questionTH ?? '').trim(),
      questionEN: (d.questionEN ?? '').trim(),
      type: (d.type ?? 'Answer'),
      sort: (d.sort ?? d.sort === 0) ? Number(d.sort) : null,
      status: d.activeStatus ? 1 as const : 0 as const,
      scoringMethod: this.normalizeScoring(d.scoringMethod),
    }));

    if (this.isAddMode && (categoryId == null)) {
      const tempId = this.createTempId();
      categoryId = tempId;

      this.formDetails.patchValue({ selectedCategoryId: tempId }, { emitEvent: false });

      const fg = this.fb.group<CategoryForm>({
        categoryId: tempId,
        categoryName: name || '-',
        activeStatus: true,
      } as any);
      this.categoriesFA.push(fg, { emitEvent: false });
      this.rebuildCategoryRowsFromForm();
      this.rememberLastSelected(tempId);
    }

    const currentSnap = this.buildCurrentDetailsView();
    const serverBaseline = this.getBaselineFor(categoryId) || { name: '', items: [] };
    const equalsServer = this.isSameDetails(currentSnap, serverBaseline);

    this.syncCategoryNameToList(categoryId, name);

    if (equalsServer) {
      this.deleteCachedDetails(categoryId);
      this.unmarkDirty(categoryId);
    } else {
      this.setCachedDetails(categoryId, { CategoryName: name, items: itemsForCache });
      this.markDirty(categoryId);
    }

    this.detailsBaseline = this.buildCurrentDetailsView();
    this.reflectPendingDraftsUI();

    this.categoryDetailsFG.disable({ emitEvent: false });
    this.isEditDetails = false;
    this.isAddMode = false;
    this.isEditMode = true;
    this.isViewMode = false;
  }

  onAddQuestionClicked() {
    if (!this.canEditSelectedCategory) return; // กันเพิ่มเมื่อไม่ใช่แถวล่าสุด
    this.isAddingRow = true;
    if (this.isQuiz2) {
      this.categoryDetailsTable.startInlineCreate({ activeStatus: false, status: 0, type: 'Answer', scoringMethod: 'Normal' }, 'bottom');
    } else if (this.isAboutMe) {
      this.categoryDetailsTable.startInlineCreate({ activeStatus: false, status: 0, type: 'Answer', scoringMethod: 1 }, 'bottom');
    } else {
      this.categoryDetailsTable.startInlineCreate({ activeStatus: false, status: 0, type: 'Answer' }, 'bottom');
    }
  }

  /*** ปรับ onRowClicked ให้ไม่เรียก API อื่น ใช้ baseline จาก response ที่โหลดมา + จำกัดสิทธิ์เฉพาะหมวดล่าสุด ***/
  onRowClicked(row: any, action: 'view' | 'edit') {
    this.rememberLastSelected(row?.categoryId);
    this.setColumnsFor();
    this.isViewingRevisionHistory = false;

    this.isProgrammaticUpdate = true;

    // ตั้งสิทธิ์แก้ไขตามว่าเป็นลำดับล่าสุดไหม
    this.canEditSelectedCategory = this.isLatestCategoryRow(row);

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

    this.setColumnsFor();

    this.formDetails.patchValue({
      selectedCategoryId: row?.categoryId ?? null,
      categoryDetails: { CategoryName: row?.categoryName ?? '' }
    }, { emitEvent: false });

    const categoryId = row?.categoryId;
    const cached = categoryId != null ? this.getCachedDetails(categoryId) : null;

    // 1) มี draft cache → ใช้ cache
    if (cached) {
      this.categoryDetailsFG.patchValue(
        { CategoryName: cached.CategoryName ?? row?.categoryName ?? '' },
        { emitEvent: false }
      );

      this.clearFormArrayQuietly(this.detailsFA);
      (cached.items ?? []).forEach((d: any) => {
        this.detailsFA.push(this.buildDetailFG(d), { emitEvent: false });
      });
      this.rebuildDetailsRowsFromForm();

      this.categoryDetailsFG.disable({ emitEvent: false });

      const savedBaseline = categoryId != null ? this.getBaselineFor(categoryId) : null;
      this.detailsBaseline = savedBaseline ?? { name: row?.categoryName ?? '', items: [] };

      if (!this.hasPendingDrafts()) {
        this.initialSnapshot = this.formDetails.getRawValue();
      }

      this.reflectPendingDraftsUI();

      /*** setup footer based on cache/baseline (SYNC) ***/
      const catIdStr = String(row?.categoryId ?? '');
      const catObj = this.categoryListRaw.find(c => String(c?.categoryId) === catIdStr);
      const revs = this.getRevisionsForCategory(catObj);
      this.revisionOptions = revs;

      const saved = this.historyStateByCat.get(catIdStr);
      const defaultRev = saved?.revision ?? (revs[revs.length - 1] ?? 1);

      // ซิงก์ dropdown + pagination ให้ตรงกัน (persist ต่อ category ถ้ามี saved)
      this.syncRevisionAndPagination(defaultRev, !!saved);

      this.isProgrammaticUpdate = false;
      return;
    }

    // 2) ไม่มี draft → ใช้ baseline จาก response ที่โหลดไว้
    let baseSnap = categoryId != null ? this.getBaselineFor(categoryId) : null;

    // หาก baseline ยังไม่มี (กรณีพิเศษ) ให้สร้างจาก raw แล้วตั้งไว้
    if (!baseSnap && categoryId != null) {
      const found = this.categoryListRaw.find(c => String(c?.categoryId) === String(categoryId));
      if (found) {
        baseSnap = this.mapCategoryToBaselineSnapshot(found);
        this.setBaselineFor(categoryId, baseSnap);
      }
    }

    baseSnap = baseSnap ?? { name: row?.categoryName ?? '', items: [] };

    this.categoryDetailsFG.patchValue(
      { CategoryName: baseSnap.name ?? row?.categoryName ?? '' },
      { emitEvent: false }
    );

    this.populateDetailsFromSnapshot(baseSnap);
    this.categoryDetailsFG.disable({ emitEvent: false });
    this.detailsBaseline = baseSnap;

    if (!this.hasPendingDrafts()) {
      this.initialSnapshot = this.formDetails.getRawValue();
      this.formDetails.markAsPristine();
    }
    this.reflectPendingDraftsUI();

    /*** setup revision & pagination footer (SYNC) ***/
    const catIdStr = String(row?.categoryId ?? '');
    const catObj = this.categoryListRaw.find(c => String(c?.categoryId) === catIdStr);
    const revs = this.getRevisionsForCategory(catObj);
    this.revisionOptions = revs;

    const saved = this.historyStateByCat.get(catIdStr);
    const defaultRev = saved?.revision ?? (revs[revs.length - 1] ?? 1);

    // ซิงก์ dropdown + pagination ให้ตรงกัน (persist ต่อ category ถ้ามี saved)
    this.syncRevisionAndPagination(defaultRev, !!saved);

    this.isProgrammaticUpdate = false;
  }

  onToggleChangeCategory(e: { row: any; checked: boolean; checkbox: HTMLInputElement }) {
    const row = e.row;
    const idx = this.categoriesFA.controls.findIndex((fg: FormGroup) => fg.value.categoryId === row.categoryId);
    if (idx > -1) {
      const next = !!e.checked;

      this.categoriesFA.at(idx).patchValue({ activeStatus: next });
      e.checkbox.checked = next;
      this.rebuildCategoryRowsFromForm();
    }
  }

  onToggleChangeDetails(e: { row: any; checked: boolean; checkbox: HTMLInputElement }) {
    const row = e.row;
    const idx = this.detailsFA.controls.findIndex((fg: FormGroup) => fg.value.id === row.id);
    if (idx > -1) {
      const next = !!e.checked;

      this.detailsFA.at(idx).patchValue({ activeStatus: next });
      e.checkbox.checked = next;
      this.rebuildDetailsRowsFromForm();
    }
  }

  onEditDetailsClicked() {
    if (!this.canEditSelectedCategory) return; // กันแก้ไขเมื่อไม่ใช่แถวล่าสุด
    this.categoryDetailsFG.enable();
    this.isEditDetails = true;
  }

  onInlineSave(payload: any) {
    this.isAddingRow = false;

    const existingSorts = (this.detailsFA.getRawValue() as CategoryDetailForm[])
      .map(r => Number(r.sort))
      .filter(n => Number.isFinite(n) && n > 0);
    const maxSort = existingSorts.length ? Math.max(...existingSorts) : 0;
    const finalSort = maxSort + 1;

    let scoring: number | null = null;
    if (this.isQuiz2) {
      scoring = (payload.scoringMethod === 'Reverse' || payload.scoringMethod === 2 || payload.scoringMethod === '2') ? 2 : 1;
    } else if (this.isAboutMe) {
      const n = Number(payload.scoringMethod);
      scoring = (Number.isFinite(n) && n >= 1) ? Math.floor(n) : 1;
    } else {
      scoring = null;
    }

    const normalized: CategoryDetailForm = {
      id: payload.id ?? null,
      questionTH: (payload.questionTH ?? '').trim(),
      questionEN: (payload.questionEN ?? '').trim(),
      type: (payload.type ?? 'Answer'),
      sort: finalSort,
      activeStatus: payload.activeStatus ?? (payload.status === 1),
      scoringMethod: scoring,
    };

    this.detailsFA.insert(this.detailsFA.length, this.fb.group<CategoryDetailForm>(normalized as any), { emitEvent: false });

    this.rebuildDetailsRowsFromForm();
    this.categoryDetailsFG.markAsDirty();
    this.formDetails.markAsDirty();

    setTimeout(() => {
      try {
        this.categoryDetailsTable?.tableWrapperRef?.nativeElement?.scrollTo({
          top: this.categoryDetailsTable?.tableWrapperRef?.nativeElement?.scrollHeight ?? 0,
          behavior: 'smooth'
        });
      } catch {}
    }, 0);

    this.reflectPendingDraftsUI();
  }

  onDeleteRowClicked(row: any) {
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

    dialogRef.afterClosed().subscribe(async (ok: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');
      if (!ok) return;

      let idx = this.findDetailsIndexByRow(row);
      if (idx < 0) return;

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
    const idx = e.rowIndex;
    if (idx < 0 || idx >= this.detailsFA.length) return;

    if (e.field === 'scoringMethod') {
      const numeric = this.isQuiz2 ? (e.value === 'Reverse' ? 2 : 1) : Number(e.value);
      this.detailsFA.at(idx).patchValue({ scoringMethod: numeric }, { emitEvent: false });
      return;
    }

    if (e.field === 'type') {
      this.detailsFA.at(idx).patchValue({ type: e.value }, { emitEvent: false });
      return;
    }
  }

  onDetailsRowsReordered(e: { previousIndex: number; currentIndex: number }) {
    const { previousIndex, currentIndex } = e;
    const fa = this.detailsFA;
    if (previousIndex === currentIndex || previousIndex < 0 || currentIndex < 0) return;
    if (previousIndex >= fa.length || currentIndex >= fa.length) return;

    const ctrl = fa.at(previousIndex);
    fa.removeAt(previousIndex, { emitEvent: false });
    fa.insert(currentIndex, ctrl, { emitEvent: false });

    for (let i = 0; i < fa.length; i++) {
      fa.at(i).patchValue({ sort: i + 1 }, { emitEvent: false });
    }

    this.rebuildDetailsRowsFromForm();
    this.categoryDetailsFG.markAsDirty();
    this.formDetails.markAsDirty();
  }

  onInlineEditSave(updatedRow: any) {
    const idx = this.findDetailsIndexByRow(updatedRow);
    if (idx < 0) return;

    const before = this.detailsFA.at(idx).value as CategoryDetailForm;

    const patch: Partial<CategoryDetailForm> = {
      questionTH: (updatedRow.questionTH ?? '').trim(),
      questionEN: (updatedRow.questionEN ?? '').trim(),
      type:       updatedRow.type ?? 'Answer',
      activeStatus: !!(updatedRow.activeStatus ?? (updatedRow.status === 1)),
      sort: this.normDetailField('__index', updatedRow.sort ?? before.sort) as number | null,
      scoringMethod: this.normDetailField('scoringMethod', updatedRow.scoringMethod ?? before.scoringMethod) as number | null,
    };

    this.detailsFA.at(idx).patchValue(patch, { emitEvent: false });
    this.rebuildDetailsRowsFromForm();
    this.categoryDetailsFG.markAsDirty();
    this.formDetails.markAsDirty();

    this.reflectPendingDraftsUI();
  }

  private buildSnapshotFromCache(catId: string | number): DetailsSnapshot | null {
    const cached = this.getCachedDetails(catId);
    if (!cached) return null;

    const items = (cached.items ?? []).map((d: any) => ({
      id: d?.id ?? null,
      questionTH: (d?.questionTH ?? '').trim(),
      questionEN: (d?.questionEN ?? '').trim(),
      type: (d?.type ?? 'Answer'),
      sort: (d?.sort ?? d?.sort === 0) ? Number(d.sort) : null,
      activeStatus: d?.status === 1 || d?.activeStatus === true,
      scoringMethod: this.normalizeScoring(d?.scoringMethod),
    }));

    items.sort((a: any, b: any) =>
      (Number(a.id)||0) - (Number(b.id)||0) ||
      (a.sort ?? 0) - (b.sort ?? 0) ||
      a.questionTH.localeCompare(b.questionTH) ||
      a.questionEN.localeCompare(b.questionEN) ||
      a.type.localeCompare(b.type)
    );

    return {
      name: (cached.CategoryName ?? '').trim(),
      items
    };
  }

  private collectDirtyDetailsForPayload() {
    const ids = this.readDirty();
    if (!ids.length) return [];

    const cache = this.readDetailsCache();
    const type = this.categoryType || 'default';
    const list: any[] = [];

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
          type: (it.type ?? 'Answer'),
          sort: (it.sort ?? it.sort === 0) ? Number(it.sort) : null,
          status: it.status,
          scoringMethod: this.normalizeScoring(it.scoringMethod),
        })),
      });
    }
    return list;
  }

  private collectDiffsBeforeSave() {
    type ChangeItem = {
      entity: 'CategoryName' | 'Detail';
      id?: string | number | null;
      label: string;
      field: string;
      from: any;
      to: any;
    };
    type ChangeGroup = {
      section: 'Category Details' | 'New Category';
      items: ChangeItem[];
    };

    const newCatGroups: ChangeGroup[] = [];
    const editGroups: ChangeGroup[] = [];
    const includeScoring = this.isQuiz2 || this.isAboutMe;

    const dirtyIds = this.readDirty();

    for (const cid of dirtyIds) {
      const currentFromCache = this.buildSnapshotFromCache(cid);
      const baseline = this.getBaselineFor(cid) || { name: '', items: [] as any[] };
      if (!currentFromCache) continue;

      // -------- กลุ่ม "New Category" --------
      if (this.isNewCategoryId(cid)) {
        const items: ChangeItem[] = [];

        items.push({
          entity: 'CategoryName',
          label: 'Category Name',
          field: 'CREATE',
          from: '',
          to: currentFromCache.name || '(ไม่ระบุ)',
        });

        currentFromCache.items.forEach((d, idx) => {
          const label = `Detail #${d.sort ?? idx + 1}`;
          const prettyScoring =
            this.isQuiz2 ? (Number(d.scoringMethod) === 2 ? 'Reverse' : 'Normal') :
            this.isAboutMe ? (Number(d.scoringMethod) || null) :
            null;

          const parts = [
            `TH: ${d.questionTH || '-'}`,
            `EN: ${d.questionEN || '-'}`,
            `Type: ${d.type || 'Answer'}`,
            `Status: ${d.activeStatus ? 'Active' : 'Inactive'}`
          ];
          if (includeScoring) {
            parts.push(
              this.isQuiz2
                ? `ScoringMethod: ${prettyScoring}`
                : `ScoringMethod: ${prettyScoring ?? '-'}`
            );
          }

          items.push({
            entity: 'Detail',
            id: d.id ?? null,
            label,
            field: 'NEW',
            from: '',
            to: parts.join(', ')
          });
        });

        newCatGroups.push({ section: 'New Category', items });
        continue;
      }

      // -------- กลุ่ม "Category Details" (แก้ไขของเดิม) --------
      const detItems: ChangeItem[] = [];

      if ((baseline.name ?? '').trim() !== currentFromCache.name) {
        detItems.push({
          entity: 'CategoryName',
          label: 'Category Name',
          field: 'CategoryName',
          from: (baseline.name ?? '').trim(),
          to: currentFromCache.name
        });
      }

      const mapOld = new Map<string, any>();
      (baseline.items ?? []).forEach((d: any, idx: number) => {
        mapOld.set(this.makeDetailKey(d, idx), d);
      });

      currentFromCache.items.forEach((d: any, idx: number) => {
        const key = this.makeDetailKey(d, idx);
        const old = mapOld.get(key);
        const label = `Detail #${(d?.sort ?? (idx + 1))}`;

        if (!old) {
          detItems.push({
            entity: 'Detail',
            id: d.id ?? null,
            label,
            field: 'NEW',
            from: '',
            to: this.formatNewRowAddedText(d),
          });
          return;
        }

        mapOld.delete(key);

        const pairs: Array<[string, any, any]> = [
          ['__index', old.sort ?? null, d.sort ?? null],
          ['questionTH', (old.questionTH ?? ''), (d.questionTH ?? '')],
          ['questionEN', (old.questionEN ?? ''), (d.questionEN ?? '')],
          ['type', (old.type ?? 'Answer'), (d.type ?? 'Answer')],
          ['activeStatus', !!old.activeStatus, !!d.activeStatus],
        ];
        if (includeScoring) {
          pairs.push(['scoringMethod', (old.scoringMethod ?? null), (d.scoringMethod ?? null)]);
        }

        pairs.forEach(([field, from, to]) => {
          if (String(from) !== String(to)) {
            const prettyFrom = (field === 'scoringMethod' && this.isQuiz2)
              ? (Number(from) === 2 ? 'Reverse' : 'Normal')
              : from;
            const prettyTo = (field === 'scoringMethod' && this.isQuiz2)
              ? (Number(to) === 2 ? 'Reverse' : 'Normal')
              : to;

            detItems.push({
              entity: 'Detail',
              id: d.id ?? null,
              label,
              field,
              from: prettyFrom,
              to: prettyTo,
            });
          }
        });
      });

      for (const old of mapOld.values()) {
        const label = `Detail #${old?.sort ?? '-'}`;
        const parts = [
          `TH: ${old?.questionTH || '-'}`,
          `EN: ${old?.questionEN || '-'}`,
          `Type: ${old?.type || 'Answer'}`,
          `Status: ${old?.activeStatus ? 'Active' : 'Inactive'}`
        ];
        if (includeScoring) {
          const pretty = this.isQuiz2 ? (Number(old?.scoringMethod) === 2 ? 'Reverse' : 'Normal')
                                      : (Number(old?.scoringMethod) || '-');
          parts.push(`ScoringMethod: ${pretty}`);
        }

        detItems.push({
          entity: 'Detail',
          id: old?.id ?? null,
          label,
          field: 'DELETE',
          from: parts.join(', '),
          to: '(deleted)',
        });
      }

      if (detItems.length) {
        editGroups.push({ section: 'Category Details', items: detItems });
      }
    }

    // เรียง "New Category" ก่อนเสมอ เพื่อความชัดเจน
    return [...newCatGroups, ...editGroups];
  }

  onCategoryNameBlur() {
    if (!this.isEnabledCardDetails) return;
    if (this.isProgrammaticUpdate) return;

    const oldName = (this.detailsBaseline?.name ?? '').trim();
    const nowName = (this.pendingCategoryNameDraft ?? this.categoryDetailsFG.get('CategoryName')?.value ?? '').trim();

    if (oldName !== nowName) {
      // เก็บค่าไว้ใช้ตอน Save ใหญ่ผ่าน cache/baseline
    }

    this.pendingCategoryNameDraft = null;
  }

  private makeDetailKey(d: any, idx: number): string {
    if (d?.id != null && d?.id !== '') return `id:${String(d.id)}`;
    const th = (d?.questionTH ?? '').trim();
    const en = (d?.questionEN ?? '').trim();
    const s  = (d?.sort ?? idx + 1);
    return `new:${th}|${en}|${s}`;
  }

  private normDetailField(field: string, val: any) {
    if (field === 'scoringMethod') {
      if (this.isQuiz2) {
        if (val === 'Reverse' || val === 2 || val === '2') return 2;
        if (val === 'Normal'  || val === 1 || val === '1') return 1;
        return 1;
      } else if (this.isAboutMe) {
        const n = Number(val);
        return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : null;
      }
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    }
    if (field === 'activeStatus') return !!val;
    if (field === '__index' || field === 'sort') return val == null ? null : Number(val);
    return typeof val === 'string' ? val.trim() : val;
  }

  private formatNewRowAddedText(
    item: { questionTH?: string; questionEN?: string; type?: string; scoringMethod?: number | string | null },
  ): string {
    const parts = [
      `TH: ${(item.questionTH ?? '').trim() || '-'}`,
      `EN: ${(item.questionEN ?? '').trim() || '-'}`,
      `Type: ${item.type ?? 'Answer'}`,
    ];

    if (this.isQuiz2) {
      const smNum = (item.scoringMethod === 2 || item.scoringMethod === '2') ? 2 : 1;
      const smLabel = smNum === 2 ? 'Reverse' : 'Normal';
      parts.push(`ScoringMethod: ${smLabel}`);
    } else if (this.isAboutMe) {
      const n = Number(item.scoringMethod);
      if (Number.isFinite(n)) parts.push(`ScoringMethod: ${n}`);
    }

    return `+ Added (${parts.join(', ')})`;
  }

  private readBaselineStore(): Record<string, DetailsSnapshot> {
    try { return JSON.parse(sessionStorage.getItem(this.DETAILS_BASELINE_STORE) || '{}'); }
    catch { return {}; }
  }
  private writeBaselineStore(store: Record<string, DetailsSnapshot>) {
    try { sessionStorage.setItem(this.DETAILS_BASELINE_STORE, JSON.stringify(store)); } catch {}
  }
  private baselineKey(catId: number | string): string {
    return `${this.categoryType || 'default'}:${String(catId)}`;
  }
  private setBaselineFor(catId: number | string, snap: DetailsSnapshot) {
    const store = this.readBaselineStore();
    store[this.baselineKey(catId)] = snap;
    this.writeBaselineStore(store);
  }
  private getBaselineFor(catId: number | string): DetailsSnapshot | null {
    const store = this.readBaselineStore();
    return store[this.baselineKey(catId)] ?? null;
  }
  private deleteBaselineFor(catId: number | string) {
    const store = this.readBaselineStore();
    delete store[this.baselineKey(catId)];
    this.writeBaselineStore(store);
  }

  private unmarkDirty(categoryId: number | string) {
    const ids = this.readDirty().filter(id => String(id) !== String(categoryId));
    this.writeDirty(ids);
  }

  private isNewCategoryId(cid: string | number): boolean {
    return this.isTempId(cid) || !this.getBaselineFor(cid);
  }

  private toNumberOrZero(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private getCategoryActiveFlag(catId: string | number): boolean {
    const idx = this.categoriesFA.controls.findIndex(
      (fg: FormGroup) => String(fg.value.categoryId) === String(catId)
    );
    if (idx > -1) {
      return !!(this.categoriesFA.at(idx).value as CategoryForm).activeStatus;
    }
    return true;
  }

  private detailKeyForCompare(d: { id?: any; questionTH?: string; questionEN?: string; sort?: any; }, idx: number) {
    if (d?.id != null && d?.id !== '') return `id:${String(d.id)}`;
    const th = (d?.questionTH ?? '').trim();
    const en = (d?.questionEN ?? '').trim();
    const s  = (d?.sort ?? idx + 1);
    return `new:${th}|${en}|${s}`;
  }

  private buildCategorySavePayload(
    catId: string | number,
    current: DetailsSnapshot,
    baseline: DetailsSnapshot | null
  ): CategorySavePayload {
    // ใหม่ => null, เดิม => ตัวเลขเดิม
    const categoryIdOut: number | null = this.isTempId(catId)
      ? null
      : (this.toNumberOrZero(catId) || null);

    // ส่ง true ตามสเปคใหม่
    const isCategoryActive = true;

    // map baseline ด้วย id (ใช้ตรวจว่า changed)
    const baselineById = new Map<number, any>();
    (baseline?.items ?? []).forEach((b: any) => {
      const idNum = this.toNumberOrZero(b?.id);
      if (idNum > 0) baselineById.set(idNum, b);
    });

    // ใช้ไว้ mark ลบ
    const baseMapForDelete = new Map<string, any>();
    (baseline?.items ?? []).forEach((d: any, idx: number) => {
      baseMapForDelete.set(this.detailKeyForCompare(d, idx), d);
    });

    const questions: QuestionPayload[] = [];

    // เพิ่ม/แก้ไข
    (current.items ?? []).forEach((d: any, idx: number) => {
      const curKey = this.detailKeyForCompare(d, idx);
      if (baseMapForDelete.has(curKey)) baseMapForDelete.delete(curKey);

      const old = this.toNumberOrZero(d?.id) > 0 ? baselineById.get(this.toNumberOrZero(d?.id)) : null;
      const changed = this.isDetailChanged(d, old);
      if (!changed) return;

      const idOut = this.toNumberOrZero(d?.id) > 0 ? this.toNumberOrZero(d?.id) : null;
      const scoringOut = this.normalizeScoringForPayload(d?.scoringMethod); // ไม่มีให้เป็น null

      questions.push({
        id: idOut,
        questionTH: (d?.questionTH ?? '').trim(),
        questionEN: (d?.questionEN ?? '').trim(),
        type: (d?.type ?? 'Answer'),
        sort: this.toNumberOrZero(d?.sort) || 0,
        scoringMethod: scoringOut,
        isActive: !!d?.activeStatus,
        isDeleted: false,
      });
    });

    // ลบ
    Array.from(baseMapForDelete.values()).forEach((old: any) => {
      const idOut = this.toNumberOrZero(old?.id) || null;
      const scoringOut = this.normalizeScoringForPayload(old?.scoringMethod);

      questions.push({
        id: idOut,
        questionTH: (old?.questionTH ?? '').trim(),
        questionEN: (old?.questionEN ?? '').trim(),
        type: (old?.type ?? 'Answer'),
        sort: this.toNumberOrZero(old?.sort) || 0,
        scoringMethod: scoringOut,
        isActive: !!old?.activeStatus,
        isDeleted: true,
      });
    });

    return {
      categoryId: categoryIdOut,
      categoryName: (current?.name ?? '').trim(),
      categoryType: this.categoryType || '',
      isCategoryActive,
      questions,
    };
  }

  private isDetailChanged(current: any, baseline: any): boolean {
    if (!baseline) return true;
    const trim = (s:any) => (typeof s === 'string' ? s.trim() : s);

    const curSort = this.toNumberOrZero(current?.sort);
    const oldSort = this.toNumberOrZero(baseline?.sort);

    const curScore = this.toNumberOrZero(current?.scoringMethod);
    const oldScore = this.toNumberOrZero(baseline?.scoringMethod);

    return (
      trim(current?.questionTH) !== trim(baseline?.questionTH) ||
      trim(current?.questionEN) !== trim(baseline?.questionEN) ||
      (current?.type ?? 'Answer') !== (baseline?.type ?? 'Answer') ||
      curSort !== oldSort ||
      !!current?.activeStatus !== !!baseline?.activeStatus ||
      curScore !== oldScore
    );
  }

  /*** Helper ใหม่สำหรับ map จาก response (revision ล่าสุด) ***/
  private pickLatestRevision(revs: any[]): any {
    if (!Array.isArray(revs) || revs.length === 0) return null;
    return revs.reduce((acc, r) => {
      const aRev = acc?.revisionId ?? 0;
      const rRev = r?.revisionId ?? 0;
      if (rRev > aRev) return r;
      if (rRev === aRev && (r?.id ?? 0) > (acc?.id ?? 0)) return r;
      return acc;
    }, revs[0]);
  }

  private mapCategoryToBaselineSnapshot(cat: any): DetailsSnapshot {
    const items: DetailsSnapshot['items'] = [];

    for (const q of (cat?.questions ?? [])) {
      const latest = this.pickLatestRevision(q?.revision ?? []);
      if (!latest) continue;

      const rawType = (latest.type ?? 'Answer');
      const normalizedType = (String(rawType).toLowerCase() === 'value') ? 'Value'
                          : (String(rawType).toLowerCase() === 'answer') ? 'Answer'
                          : rawType;

      items.push({
        id: latest.id ?? null,
        questionTH: (latest.questionTH ?? '').trim(),
        questionEN: (latest.questionEN ?? '').trim(),
        type: normalizedType,
        sort: Number.isFinite(Number(latest.sort)) ? Number(latest.sort) : null,
        activeStatus: latest.status === 1,
        scoringMethod: this.normalizeScoring(latest.scoringMethod),
      });
    }

    items.sort((a: any, b: any) =>
      (a.sort ?? 0) - (b.sort ?? 0) ||
      (Number(a.id) || 0) - (Number(b.id) || 0)
    );

    return {
      name: (cat?.categoryName ?? '').trim(),
      items,
    };
  }

  private populateDetailsFromSnapshot(snap: DetailsSnapshot): void {
    this.clearFormArrayQuietly(this.detailsFA);
    (snap.items ?? []).forEach(d => {
      const apiLike = {
        id: d.id,
        questionTH: d.questionTH,
        questionEN: d.questionEN,
        type: d.type,
        sort: d.sort,
        status: d.activeStatus ? 1 : 0,
        scoringMethod: d.scoringMethod,
      };
      this.detailsFA.push(this.buildDetailFG(apiLike), { emitEvent: false });
    });
    this.rebuildDetailsRowsFromForm();
  }

  /*** เช็คว่า row ปัจจุบันคือแถวล่าสุดในตาราง category หรือไม่ ***/
  private isLatestCategoryRow(row: any): boolean {
    if (!row) return false;

    // เกณฑ์ที่ 1: เป็นแถวสุดท้ายตาม index ที่แสดง
    const byIndex = typeof row.index === 'number' && row.index === this.categoryRows.length;

    // เกณฑ์ที่ 2: categoryId มากสุด (กันกรณี index ไม่แม่น)
    const nums = (this.categoryRows || [])
      .map(r => Number(r.categoryId))
      .filter(n => Number.isFinite(n));
    const maxId = nums.length ? Math.max(...nums) : null;
    const byId = maxId !== null && Number(row.categoryId) === maxId;

    return byIndex || byId;
  }

  /*** revision helper & handlers ***/
  /** ใช้ category.revisionId เป็นแหล่งที่มาหลักของรายการ revision */
  private getRevisionsForCategory(cat: any): number[] {
    const latest = Number(cat?.revisionId);
    if (Number.isFinite(latest) && latest >= 1) {
      // คืนลิสต์ 1..latest ครบถ้วน (เช่น 1,2,3,4,5)
      return Array.from({ length: latest }, (_, i) => i + 1);
    }

    // Fallback: รวบรวมจาก question.revision[] เหมือนเดิม
    const set = new Set<number>();
    for (const q of (cat?.questions ?? [])) {
      for (const r of (q?.revision ?? [])) {
        const rid = Number(r?.revisionId ?? r?.id ?? r);
        if (Number.isFinite(rid)) set.add(rid);
      }
    }
    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.length ? arr : [1];
  }

  onRevisionChange(val: string | number) {
    const selected = Number(val);
    if (!Number.isFinite(selected)) return;

    this.syncRevisionAndPagination(selected);      // ซิงก์เลขหน้าให้ตรง revision
    this.loadRevisionForSelectedCategory(selected); // โหลดเหมือนเลือกจาก dropdown
  }

  /** เลือก snapshot ของแต่ละคำถามตาม revisionId ที่ขอ (ถ้าไม่มี exact match จะ fallback ไป revision ที่ใกล้ที่สุดที่น้อยกว่า) */
  private mapCategoryToSnapshotForRevision(cat: any, revisionId: number): DetailsSnapshot {
    const items: DetailsSnapshot['items'] = [];

    for (const q of (cat?.questions ?? [])) {
      const revs = Array.isArray(q?.revision) ? q.revision : [];

      // 1) พยายามหา exact match ก่อน
      let pick = revs.find((r: any) => Number(r?.revisionId) === Number(revisionId)) ?? null;

      // 2) ถ้าไม่เจอ ให้ fallback หา revision ที่ <= revisionId แล้วเลือกตัว “ล่าสุด” ในกลุ่มนั้น
      if (!pick) {
        const eligible = revs.filter((r: any) => Number(r?.revisionId) <= Number(revisionId));
        pick = this.pickLatestRevision(eligible); // ใช้ helper เดิม
      }
      if (!pick) continue;

      const rawType = (pick.type ?? 'Answer');
      const normalizedType =
        String(rawType).toLowerCase() === 'value'  ? 'Value'  :
        String(rawType).toLowerCase() === 'answer' ? 'Answer' : rawType;

      items.push({
        id: pick.id ?? null,
        questionTH: (pick.questionTH ?? '').trim(),
        questionEN: (pick.questionEN ?? '').trim(),
        type: normalizedType,
        sort: Number.isFinite(Number(pick.sort)) ? Number(pick.sort) : null,
        activeStatus: pick.status === 1,
        scoringMethod: this.normalizeScoring(pick.scoringMethod),
      });
    }

    items.sort((a: any, b: any) =>
      (a.sort ?? 0) - (b.sort ?? 0) ||
      (Number(a.id) || 0) - (Number(b.id) || 0)
    );

    return {
      name: (cat?.categoryName ?? '').trim(),
      items,
    };
  }

  /** โหลดและแสดงข้อมูลของ revision ที่เลือก สำหรับ category ปัจจุบัน (read-only) */
  private loadRevisionForSelectedCategory(revisionId: number) {
    const catId = this.formDetails.get('selectedCategoryId')?.value;

    // ต้องเป็น category ที่ “บันทึกแล้ว” เท่านั้น (id ชั่วคราวจะไม่มีประวัติ)
    if (!catId || this.isTempId(catId)) {
      this.notify.warn('Select a saved category to view revision history.');
      return;
    }

    this.isProgrammaticUpdate = true;
    this.applicationQuestionService
      .getRevisionCategoryTypesInfoQuestionDetails(Number(catId), Number(revisionId))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          // API อาจคืน object เดี่ยว หรือ array; รองรับทั้งสองแบบ
          const cat =
            Array.isArray(resp)
              ? resp.find((c: any) => String(c?.categoryId) === String(catId))
              : resp;

          if (!cat) {
            this.notify.error('No data found for this revision.');
            this.isProgrammaticUpdate = false;
            return;
          }

          // map ให้กลายเป็น snapshot ของ revision ที่เลือก
          const snap = this.mapCategoryToSnapshotForRevision(cat, Number(revisionId));

          // ใส่ค่าในฟอร์ม/ตาราง (ไม่ emit เพื่อไม่ไปเปิดปุ่ม Save)
          this.categoryDetailsFG.patchValue(
            { CategoryName: snap.name },
            { emitEvent: false }
          );
          this.populateDetailsFromSnapshot(snap); // ใช้ helper เดิม (push แบบ emitEvent:false อยู่แล้ว)

          // โหมดดูย้อนหลัง = ปิดการแก้ไข
          this.categoryDetailsFG.disable({ emitEvent: false });
          this.isEditDetails = false;
          this.isAddMode = false;
          this.isViewMode = true;
          this.isEditMode = false;
          this.isViewingRevisionHistory = true;

          // เก็บสถานะหน้า/รีวิชันตาม category
          const cid = String(catId);
          this.historyStateByCat.set(cid, {
            revision: Number(revisionId),
            page: this.getPageForRevision(Number(revisionId)),
            totalPages: Math.max(1, this.revisionOptions.length),
          });
        },
        error: (err) => {
          const msg = err?.error?.message || err?.message || 'Cannot load this revision.';
          this.notify.error(msg);
        },
        complete: () => {
          this.isProgrammaticUpdate = false;
        }
      });
  }

  /** แปลง revision -> page (index + 1) */
  private getPageForRevision(rev: number): number {
    const idx = this.revisionOptions.findIndex(r => r === rev);
    return idx >= 0 ? idx + 1 : this.revisionOptions.length;
  }

  private syncRevisionAndPagination(rev: number, persist: boolean = true) {
    this.currentRevision = Number(rev);

    if (persist) {
      const cid = String(this.formDetails.get('selectedCategoryId')?.value ?? '');
      if (cid) {
        const page = this.getPageForRevision(this.currentRevision); // คำนวณหน้าไว้เก็บ state
        this.historyStateByCat.set(cid, {
          revision: this.currentRevision,
          page,
          totalPages: Math.max(1, this.revisionOptions.length),
        });
      }
    }
  }

  private hasScoringMethod(): boolean {
    return this.isQuiz2 || this.isAboutMe;
  }

  private normalizeScoringForPayload(val: any): number | null {
    if (!this.hasScoringMethod()) return null;
    if (this.isQuiz2) {
      const n = Number(val);
      return n === 2 ? 2 : 1; // Normal=1, Reverse=2
    }
    if (this.isAboutMe) {
      const n = Number(val);
      return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
    }
    return null;
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
    this.canEditSelectedCategory = false;

    sessionStorage.removeItem('categoryList');
  }
}
