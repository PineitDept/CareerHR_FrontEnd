import { Component, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApplicationQuestionService } from '../../../../../../../../services/admin-setting/application-question/application-question.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Column, Columns } from '../../../../../../../../shared/interfaces/tables/column.interface';
import { TablesComponent } from '../../../../../../../../shared/components/tables/tables.component';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { AlertDialogComponent } from '../../../../../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { CaptchaDialogComponent } from '../../../../../../../../shared/components/dialogs/captcha-dialog/captcha-dialog.component';
import { debounceTime, distinctUntilChanged, map, Subject, takeUntil } from 'rxjs';
import { ConfirmChangesDialogComponent } from '../../../../../../../../shared/components/dialogs/confirm-changes-dialog/confirm-changes-dialog.component';
import { ConfirmChangesData } from '../../../../../../../../shared/interfaces/dialog/dialog.interface';

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

type ChangeItem = {
  entity: 'Category' | 'CategoryName' | 'Detail';
  id?: string | number | null;
  label: string;
  field: string;
  from: any;
  to: any;
};

type ChangeGroup = {
  section: 'Category Table' | 'Category Details';
  items: ChangeItem[];
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

  private DETAILS_CACHE_KEY = 'categoryDetailsCache';
  private CATEGORY_TYPE_DRAFT_PREFIX = 'categoryTypeDraft';
  private DIRTY_PREFIX = 'aqd:dirty';

  private destroy$ = new Subject<void>();

  detailsRequiredFooterFields: string[] = ['questionTH','questionEN','type'];

  private pendingCategoryChanges: ChangeItem[] = [];
  private pendingDetailsChanges: ChangeItem[] = [];

  private baselineCategoriesById = new Map<string, { activeStatus: boolean; categoryName: string }>();
  private baselineDetailsById = new Map<string, {
    sort: number | null;
    questionTH: string;
    questionEN: string;
    type: string;
    activeStatus: boolean;
    scoringMethod: number | null;
  }>();

  private pendingCategoryNameDraft: string | null = null;
  private readonly DETAILS_BASELINE_STORE = 'aqd:detailsBaseline';

  constructor(
    private route: ActivatedRoute,
    private applicationQuestionService: ApplicationQuestionService,
    private fb: FormBuilder,
    private dialog: MatDialog,
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

  private buildColumnsFor() {
    this.setColumnsFor();
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
    if (v === undefined || v === null || v === '') return null;
    if (typeof v === 'string') {
      if (v === 'Normal') return 1;
      if (v === 'Reverse') return 2;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return Number.isFinite(Number(v)) ? Number(v) : null;
  }

  private setActionButtons(_mode?: 'view' | 'edit') {
    // ไม่ว่าจะแบบไหน แสดงปุ่ม Save ปุ่มเดียว
    this.filterButtons = [{ label: 'Save', key: 'save', color: '#000055' }];
    // เริ่มต้นให้ปุ่ม Save ถูกปิดไว้ก่อน จนกว่าจะมี draft/การเปลี่ยนแปลง
    this.disabledKeys = ['save'];
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
      // ✅ ต้องเขียน "cache ทั้งก้อน" กลับ
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
    if (!last) return;
    const row = this.categoryRows.find(r => String(r.categoryId) === String(last));
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

  private createTempId(): string {
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  }
  private isTempId(id: any): boolean {
    return String(id).startsWith('tmp-');
  }

  private hasAnyCachedDraftsForCurrentType(): boolean {
    const type = this.categoryType || 'default';
    const cache = this.readDetailsCache();
    return Object.keys(cache).some(k => k.startsWith(`${type}:`));
  }

  public hasPendingDrafts(): boolean {
    const hasDirty = (this.readDirty()?.length ?? 0) > 0;
    const nameDraft = (this.readCategoryTypeDraft() ?? '').trim();
    const hasCache = this.hasAnyCachedDraftsForCurrentType();
    return hasDirty || !!nameDraft || hasCache;
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
    // util
    const T = (v: any) => (v ?? '').toString().trim();
    const N = (v: any) => (v === undefined || v === null || v === '' ? null : Number(v));
    const B = (v: any) => !!v;

    // 1) ถ้ามี id ให้ใช้ id ก่อน
    if (row?.id != null) {
      const byId = this.detailsFA.controls.findIndex(
        (fg: { value: CategoryDetailForm; }) => (fg.value as CategoryDetailForm).id === row.id
      );
      if (byId > -1) return byId;
    }

    // 2) (สำคัญ) เคสแถวใหม่ id=null → จับด้วย sort ก่อน (sort เป็น unique ลำดับแสดงในตาราง)
    const srt = N(row?.sort);
    if (srt != null) {
      const bySort = this.detailsFA.controls.findIndex(
        (fg: { value: CategoryDetailForm; }) => N((fg.value as CategoryDetailForm).sort) === srt
      );
      if (bySort > -1) return bySort;
    }

    // 3) เผื่อกรณีเดิม: จับคู่ด้วย “เนื้อหา” (อาจไม่เจอถ้าค่าเปลี่ยนไปแล้ว)
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

    // 4) ฟอลแบ็กสุดท้าย: ถ้า row มี index ที่ตารางส่งมา
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

  getCellValue(row: any, field: string): any {
    if (field === '__index') return row?.sort ?? '';
    return field.split('.').reduce((obj, key) => obj?.[key], row);
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
  }

  onAddClicked() {
    this.isProgrammaticUpdate = true;
    try {
      this.isEnabledCardDetails = true;
      this.isAddMode = true;
      this.isViewMode = false;
      this.isEditMode = false;
      this.isEditDetails = true;

      this.categoryDetailsFG.enable({ emitEvent: false });
      this.formDetails.patchValue({ selectedCategoryId: null }, { emitEvent: false });
      this.categoryDetailsFG.reset({ CategoryName: '' }, { emitEvent: false });

      this.clearFormArrayQuietly(this.detailsFA);
      this.categoryDetailsRows = [];

      this.detailsBaseline = { name: '', items: [] };

      this.initialSnapshot = this.formDetails.getRawValue();
      this.formDetails.markAsPristine();

      this.reflectPendingDraftsUI();
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

  fetchCategoryTypesDetails() {
    this.applicationQuestionService.getCategoryTypesInfoQuestionDetails(this.categoryType).subscribe({
      next: (response) => {
        sessionStorage.setItem('categoryList', JSON.stringify(response ?? []));

        this.categoriesFA.clear({ emitEvent: false });
        (response ?? []).forEach((c: any) => this.categoriesFA.push(this.buildCategoryFG(c), { emitEvent: false }));

        this.formDetails.disable({ emitEvent: false });
        this.initialSnapshot = this.formDetails.getRawValue();

        this.applyCachedNamesToCategoryList();
        this.applyCategoryTypeDraft();

        this.rebuildCategoryRowsFromForm();
        this.rebuildBaselineForCategories();

        this.reflectPendingDraftsUI();
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

    const dialogRef = this.dialog.open(ConfirmChangesDialogComponent, {
      width: '856px',
      panelClass: 'custom-dialog-container',
      disableClose: true,
      autoFocus: false,
      data: {
        title: 'Please confirm your changes',
        groups: changeGroups,
        confirm: true,
      } as ConfirmChangesData
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      console.log('Confirmed:', confirmed);
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');
      if (!confirmed) return;

      const value = this.formDetails.getRawValue();
      const dirtyDetailsList = this.collectDirtyDetailsForPayload();

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
        payload.categoryDetailsList = dirtyDetailsList;
      } else {
        payload.selectedCategoryId = null;
        payload.categoryDetailsList = [];
      }

      console.log('SAVE payload:', payload);

      // this.clearCategoryTypeDraft();
      // for (const d of dirtyDetailsList) this.deleteCachedDetails(d.categoryId);
      // this.clearDirty();

      // this.isEditing = false;
      // this.formDetails.disable({ emitEvent: false });
      // this.initialSnapshot = this.formDetails.getRawValue();
      // this.setActionButtons('view');

      // this.pendingCategoryChanges = [];
      // this.pendingDetailsChanges = [];

      // this.rebuildBaselineForCategories();
      // this.rebuildBaselineForDetails();
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

    // กรณี Add ใหม่ -> ออก temp id
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

    // เปรียบเทียบกับ "server baseline" ก่อนตัดสินใจ cache/dirty
    const currentSnap = this.buildCurrentDetailsView(); // มุมมองล่าสุดบนฟอร์ม
    const serverBaseline = this.getBaselineFor(categoryId) || { name: '', items: [] };
    const equalsServer = this.isSameDetails(currentSnap, serverBaseline);

    // อัปเดตชื่อใน list ให้ตรงก่อน (ไม่เกี่ยวกับ dirty)
    this.syncCategoryNameToList(categoryId, name);

    if (equalsServer) {
      // ถ้าเท่ากับ baseline → ลบ draft และ unmark dirty ของหมวดหมู่นี้
      this.deleteCachedDetails(categoryId);
      this.unmarkDirty(categoryId);
    } else {
      // มีความต่างจาก baseline → เก็บเป็น draft และ mark dirty
      this.setCachedDetails(categoryId, { CategoryName: name, items: itemsForCache });
      this.markDirty(categoryId);
    }

    // ตั้ง baseline สำหรับปุ่ม Save Details รอบต่อไป (เทียบกับสถานะที่เพิ่งกดเซฟ)
    this.detailsBaseline = this.buildCurrentDetailsView();
    this.reflectPendingDraftsUI(); // ← จะ disable ปุ่ม Save ใหญ่เองถ้าไม่มี draft/เปลี่ยนแปลงค้างอยู่

    console.log('Saved to cache for categoryId=', categoryId, 'equalsServer=', equalsServer);

    this.categoryDetailsFG.disable({ emitEvent: false });
    this.isEditDetails = false;
    this.isAddMode = false;
    this.isEditMode = true;
    this.isViewMode = false;

    this.pendingDetailsChanges = [];
  }

  onAddQuestionClicked() {
    this.isAddingRow = true;
    if (this.isQuiz2) {
      this.categoryDetailsTable.startInlineCreate({ activeStatus: false, status: 0, type: 'Answer', scoringMethod: 'Normal' }, 'bottom');
    } else if (this.isAboutMe) {
      this.categoryDetailsTable.startInlineCreate({ activeStatus: false, status: 0, type: 'Answer', scoringMethod: 1 }, 'bottom');
    } else {
      this.categoryDetailsTable.startInlineCreate({ activeStatus: false, status: 0, type: 'Answer' }, 'bottom');
    }
  }

  onToggleChange(event: Event): void {
    console.log('Toggle change event:', event);
  }

  onRowClicked(row: any, action: 'view' | 'edit') {
    this.rememberLastSelected(row?.categoryId);
    this.buildColumnsFor();

    this.isProgrammaticUpdate = true;

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

      if (!savedBaseline && categoryId != null) {
        this.applicationQuestionService.getQuestionsByCategory(categoryId).subscribe({
          next: (resp) => {
            const items = (resp ?? []).map((d: any) => ({
              id: d?.id ?? null,
              questionTH: (d?.questionTH ?? '').trim(),
              questionEN: (d?.questionEN ?? '').trim(),
              type: (d?.type ?? 'Answer'),
              sort: (d?.sort ?? d?.sort === 0) ? Number(d.sort) : null,
              activeStatus: d?.status === 1,
              scoringMethod: this.normalizeScoring(d?.scoringMethod),
            }));
            const snap: DetailsSnapshot = {
              name: (row?.categoryName ?? '').trim(),
              items: items.sort((a: any, b: any) =>
                (Number(a.id)||0)-(Number(b.id)||0) ||
                (a.sort ?? 0) - (b.sort ?? 0)
              ),
            };
            this.setBaselineFor(categoryId, snap);
            this.detailsBaseline = snap;
          },
          error: (err) => console.warn('silent baseline fetch failed', err),
        });
      }

      if (!this.hasPendingDrafts()) {
        this.initialSnapshot = this.formDetails.getRawValue();
      }

      this.reflectPendingDraftsUI();

      this.isProgrammaticUpdate = false;
      return;
    }

    this.applicationQuestionService.getQuestionsByCategory(row.categoryId).subscribe({
      next: (response) => {
        this.clearFormArrayQuietly(this.detailsFA);
        (response ?? []).forEach((d: any) => this.detailsFA.push(this.buildDetailFG(d), { emitEvent: false }));
        this.rebuildDetailsRowsFromForm();

        this.categoryDetailsFG.disable({ emitEvent: false });
        this.detailsBaseline = this.buildCurrentDetailsView();
        if (row?.categoryId != null) {
          this.setBaselineFor(row.categoryId, this.detailsBaseline);
        }

        if (!this.hasPendingDrafts()) {
          this.initialSnapshot = this.formDetails.getRawValue();
          this.formDetails.markAsPristine();
        }
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
      const prev = !!(this.categoriesFA.at(idx).value as CategoryForm).activeStatus;
      const next = !!e.checked;

      this.categoriesFA.at(idx).patchValue({ activeStatus: next });
      e.checkbox.checked = next;
      this.rebuildCategoryRowsFromForm();

      if (prev !== next) {
        const idKey = String(row.categoryId);
        const label = `Category "${row.categoryName}"`;
        this.pendingCategoryChanges.push({
          entity: 'Category',
          id: idKey,
          label,
          field: 'activeStatus',
          from: prev,
          to: next,
        });
      }
    }
  }

  onToggleChangeDetails(e: { row: any; checked: boolean; checkbox: HTMLInputElement }) {
    const row = e.row;
    const idx = this.detailsFA.controls.findIndex((fg: FormGroup) => fg.value.id === row.id);
    if (idx > -1) {
      const prev = !!(this.detailsFA.at(idx).value as CategoryDetailForm).activeStatus;
      const next = !!e.checked;

      this.detailsFA.at(idx).patchValue({ activeStatus: next });
      e.checkbox.checked = next;
      this.rebuildDetailsRowsFromForm();

      if (prev !== next) {
        const idKey = String(row?.id ?? `tmp-${idx+1}`);
        const label = `Detail #${idx+1}`;
        this.pendingDetailsChanges.push({
          entity: 'Detail',
          id: idKey,
          label,
          field: 'activeStatus',
          from: prev,
          to: next,
        });
      }
    }
  }

  onEditDetailsClicked() {
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

    const label = `Detail #${finalSort}`;
    this.pendingDetailsChanges = this.pendingDetailsChanges.filter(
      it => !(it.entity === 'Detail' && it.field === 'NEW' && it.label === label)
    );

    const toText = this.formatNewRowAddedText(normalized);

    this.pendingDetailsChanges.push({
      entity: 'Detail',
      id: normalized.id ?? null,
      label,
      field: 'NEW',
      from: '',
      to: toText,
    });

    setTimeout(() => {
      try {
        this.categoryDetailsTable?.tableWrapperRef?.nativeElement?.scrollTo({
          top: this.categoryDetailsTable?.tableWrapperRef?.nativeElement?.scrollHeight ?? 0,
          behavior: 'smooth'
        });
      } catch {}
    }, 0);

    // อย่าเขียน cache/markDirty ที่นี่ — ให้กด Save Details เท่านั้น
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
        caseSensitive: false
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

    const field = e.field;
    const rowFG = this.detailsFA.at(idx);
    const before = rowFG.value[field as keyof CategoryDetailForm];

    if (String(before) !== String(e.value)) {
      const idKey = String(rowFG.value.id ?? `tmp-${idx+1}`);
      const label = `Detail #${idx+1}`;
      const normFrom = (field === 'scoringMethod' && this.isQuiz2)
        ? (+before === 2 ? 'Reverse' : 'Normal')
        : before;
      const normTo = (field === 'scoringMethod' && this.isQuiz2)
        ? (e.value === 'Reverse' ? 'Reverse' : 'Normal')
        : e.value;

      this.pendingDetailsChanges.push({
        entity: 'Detail',
        id: idKey,
        label,
        field: field === 'scoringMethod' ? 'scoringMethod' : 'type',
        from: normFrom,
        to: normTo,
      });
    }

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

    this.pendingDetailsChanges.push({
      entity: 'Detail',
      id: null,
      label: `Row moved`,
      field: '__index',
      from: previousIndex + 1,
      to: currentIndex + 1,
    });

    this.rebuildDetailsRowsFromForm();
    this.categoryDetailsFG.markAsDirty();
    this.formDetails.markAsDirty();
  }

  private rebuildBaselineForCategories() {
    this.baselineCategoriesById.clear();
    const arr = this.categoriesFA.getRawValue() as CategoryForm[];
    arr.forEach(c => {
      this.baselineCategoriesById.set(String(c.categoryId), {
        activeStatus: !!c.activeStatus,
        categoryName: (c.categoryName ?? '').trim(),
      });
    });
  }

  private rebuildBaselineForDetails() {
    this.baselineDetailsById.clear();
    const rows = this.categoryDetailsRows || [];
    rows.forEach(r => {
      const idKey = String(r?.id ?? `tmp-${r?.__index ?? ''}`);
      this.baselineDetailsById.set(idKey, {
        sort: (r?.sort ?? null),
        questionTH: (r?.questionTH ?? '').trim(),
        questionEN: (r?.questionEN ?? '').trim(),
        type: (r?.type ?? 'Answer'),
        activeStatus: !!r?.activeStatus,
        scoringMethod: this.isQuiz2
          ? (r?.scoringMethod === 'Reverse' ? 2 : 1)
          : (Number.isFinite(Number(r?.scoringMethod)) ? Number(r.scoringMethod) : null),
      });
    });
  }

  onInlineEditSave(updatedRow: any) {
    const idx = this.findDetailsIndexByRow(updatedRow);
    if (idx < 0) return;

    const before = this.detailsFA.at(idx).value as CategoryDetailForm;
    const label  = `Detail #${idx + 1}`;

    const patch: Partial<CategoryDetailForm> = {
      questionTH: (updatedRow.questionTH ?? '').trim(),
      questionEN: (updatedRow.questionEN ?? '').trim(),
      type:       updatedRow.type ?? 'Answer',
      activeStatus: !!(updatedRow.activeStatus ?? (updatedRow.status === 1)),
      sort: this.normDetailField('__index', updatedRow.sort ?? before.sort) as number | null,
      scoringMethod: this.normDetailField('scoringMethod', updatedRow.scoringMethod ?? before.scoringMethod) as number | null,
    };

    (['questionTH','questionEN','type','activeStatus','__index','scoringMethod'] as const).forEach((f) => {
      const ov = this.normDetailField(f === '__index' ? '__index' : f, (before as any)[f === '__index' ? 'sort' : f]);
      const nv = this.normDetailField(f, (patch as any)[f === '__index' ? 'sort' : f]);

      if (ov !== nv) {
        this.pendingDetailsChanges = this.pendingDetailsChanges.filter(
          it => !(it.entity === 'Detail' && it.label === label && it.field === f)
        );

        const pretty = (x: any) =>
          f === 'activeStatus' ? (x ? 'Active' : 'Inactive')
        : f === 'scoringMethod' && this.isQuiz2 ? (x === 2 ? 'Reverse' : 'Normal')
        : x;

        this.pendingDetailsChanges.push({
          entity: 'Detail',
          id: before.id ?? null,
          label,
          field: f,
          from: pretty(ov),
          to:   pretty(nv),
        });
      }
    });

    this.detailsFA.at(idx).patchValue(patch, { emitEvent: false });
    this.rebuildDetailsRowsFromForm();
    this.categoryDetailsFG.markAsDirty();
    this.formDetails.markAsDirty();

    // ไม่เขียน cache/markDirty ที่นี่
    this.reflectPendingDraftsUI();
  }

  // ===== NEW: ใช้ snapshot จาก cache เพื่อคำนวณ diff ตอน Save ใหญ่ =====
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

  private collectDiffsBeforeSave(): ChangeGroup[] {
    const groups: ChangeGroup[] = [];

    // 4.1 Category table
    // const catItems: ChangeItem[] = [];
    // const arr = this.categoriesFA.getRawValue() as CategoryForm[];
    // arr.forEach((c) => {
    //   const idKey = String(c.categoryId);
    //   const nowActive = !!c.activeStatus;
    //   const nowName = (c.categoryName ?? '').trim();
    //   const base = this.baselineCategoriesById.get(idKey);
    //   if (base) {
    //     if (base.activeStatus !== nowActive) {
    //       catItems.push({
    //         entity: 'Category',
    //         id: idKey,
    //         label: `Category "${nowName || base.categoryName || '-'}"`,
    //         field: 'activeStatus',
    //         from: base.activeStatus,
    //         to: nowActive,
    //       });
    //     }
    //     if (base.categoryName !== nowName) {
    //       catItems.push({
    //         entity: 'Category',
    //         id: idKey,
    //         label: `Category "${nowName || base.categoryName || '-'}"`,
    //         field: 'categoryName',
    //         from: base.categoryName,
    //         to: nowName,
    //       });
    //     }
    //   }
    // });
    // catItems.push(...this.pendingCategoryChanges);
    // if (catItems.length) {
    //   groups.push({ section: 'Category Table', items: catItems });
    // }

    // 4.2 Category Details — คิดจาก cache ของ dirty เท่านั้น
    const detItems: ChangeItem[] = [];
    const dirtyIds = this.readDirty();
    const includeScoring = this.isQuiz2 || this.isAboutMe;

    dirtyIds.forEach((cid) => {
      const baseline = this.getBaselineFor(cid) || { name: '', items: [] as any[] };
      const currentFromCache = this.buildSnapshotFromCache(cid);
      if (!currentFromCache) return;

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
    });

    if (detItems.length) {
      groups.push({ section: 'Category Details', items: detItems });
    }

    return groups;
  }

  onCategoryNameBlur() {
    if (!this.isEnabledCardDetails) return;
    if (this.isProgrammaticUpdate) return;

    const oldName = (this.detailsBaseline?.name ?? '').trim();
    const nowName = (this.pendingCategoryNameDraft ?? this.categoryDetailsFG.get('CategoryName')?.value ?? '').trim();

    this.pendingDetailsChanges = this.pendingDetailsChanges.filter(
      it => !(it.entity === 'CategoryName' && it.field === 'CategoryName')
    );

    if (oldName !== nowName) {
      this.pendingDetailsChanges.push({
        entity: 'CategoryName',
        label: 'Category Name',
        field: 'CategoryName',
        from: oldName,
        to: nowName,
      });
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
