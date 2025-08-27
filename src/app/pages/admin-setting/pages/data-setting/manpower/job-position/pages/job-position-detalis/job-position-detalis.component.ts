import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { defaultFilterButtons, PreferredSkillsColumn, RequirementsColumns, ResponsibilitiesColumns } from '../../../../../../../../../app/constants/admin-setting/job-position.constants';
import { JobPositionService } from '../../../../../../../../../app/services/admin-setting/job-position/job-position.service';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TablesComponent } from '../../../../../../../../shared/components/tables/tables.component';
import { CaptchaDialogComponent } from '../../../../../../../../shared/components/dialogs/captcha-dialog/captcha-dialog.component';
import { forkJoin } from 'rxjs';
import { GeneralBenefitsService } from '../../../../../../../../services/admin-setting/general-benefits/general-benefits.service';
import { IApiResponse, IBenefitsFilterRequest, IUniversityWithPositionsDto } from '../../../../../../../../interfaces/admin-setting/general-benefits.interface';
import { QualityDialogComponent } from '../../../../../../../../shared/components/dialogs/quality-dialog/quality-dialog.component';
import { JobPositionDetails } from '../../../../../../../../interfaces/admin-setting/job-position.interface';
import { CdkOverlayOrigin, FlexibleConnectedPositionStrategy, OverlayRef } from '@angular/cdk/overlay';

type CategoryForm = {
  categoryId: number | string | null;
  categoryName: string;
  activeStatus: boolean;
};

type CategoryDetailForm = {
  id: number | string | null;
  subject: string;
  message: string;
  activeStatus: boolean;
};

type TableKey = 'resp' | 'req' | 'pref';

@Component({
  selector: 'app-job-position-detalis',
  templateUrl: './job-position-detalis.component.html',
  styleUrl: './job-position-detalis.component.scss'
})
export class JobPositionDetalisComponent {
  @ViewChild('ResponsibilitiesTable') ResponsibilitiesTable!: TablesComponent;
  @ViewChild('RequirementsTable') RequirementsTable!: TablesComponent;
  @ViewChild('PreferredSkillsTable') PreferredSkillsTable!: TablesComponent;

  addState: Record<TableKey, boolean> = { resp: false, req: false, pref: false };

  isEditing = false;
  private initialSnapshot: any = null;

  formDetails!: FormGroup;
  filterButtons = defaultFilterButtons();
  responsibilitiesColumns = ResponsibilitiesColumns();
  requirementsColumns = RequirementsColumns();
  preferredSkillsColumn = PreferredSkillsColumn();

  disabledKeys: string[] = [];

  AttrID: string = '';
  idjobPst: string = '';
  EmailSubject: string = '';
  responsibilitiesRows: any[] = [];
  requirementsRows: any[] = [];
  preferredSkillsRows: any[] = [];

  settingWelfareBenefits: any[] = [];
  settingLanguageSkills: any[] = [];
  settingComputerSkills: any[] = [];
  pendingSelectedIds: number[] | null = null;

  preselectedbenefits: number[] | null = null;
  preselectedlanguageSkills: number[] | null = null;
  preselectedcomputerSkills: number[] | null = null;

  categoryRows: any[] = [];
  categoryDetailsRows: any[] = [];
  previousData!: JobPositionDetails;

  isEnabledCardDetails = false;

  isViewMode = false;
  isAddMode = false;
  isEditMode = false;
  isEditDetails = false;

  fieldErrors = false;
  duplicateRowIndex: number | null = null;

  qualityControl = new FormControl(2);

  locationsList = [
    { id: 91, name: 'Bangkok' },
    { id: 2, name: 'Samut Prakan' },
    { id: 3, name: 'Chonburi' },
    { id: 4, name: 'Saraburi' },
  ];

  private overlayRef: OverlayRef | null = null;
  private positionStrategy!: FlexibleConnectedPositionStrategy;

  constructor(
    private jobPositionService: JobPositionService,
    private benefitsService: GeneralBenefitsService,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.jobPositionService.setEMailType('job-position');

    this.initializeForm();

    this.formDetails.disable({ emitEvent: false });
    this.setActionButtons('view');

    this.formDetails.valueChanges.subscribe(() => {
      if (!this.isEditing) return;
      this.setButtonDisabled('save', !this.hasFormChanged());
    });

    this.route.queryParams.subscribe(params => {
      this.idjobPst = params['idjobPst'] || '';
      this.fetchBenefitsDetails();
      this.fetchLanguageDetails();
      this.fetchComputerDetails();
      this.fetchJobDetails();
    });
  }

  initializeForm() {
    this.formDetails = this.fb.group({
      namePosition: [''],
      education: [''],
      workingDetails: [''],
      minExperience: [''],
      maxExperience: [''],
      minSalary: [''],
      maxSalary: [''],
      qualityPst: [''],
      activeStatus: [false],
      selectedIdsBenefits: [] as number[],
      selectedIdsLanguage: [] as number[],
      selectedIdsComputer: [] as number[],
      locations: new FormControl<number[]>([], { nonNullable: true }),
    });
  }

  onUserToggleRequested(event?: Event): void {
    if (!this.isEditing) return;

    const current = this.formDetails.get('activeStatus')?.value;
    this.formDetails.get('activeStatus')?.setValue(!current);

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  toggleQuality(): void {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });
    console.log(this.formDetails.get('qualityPst')?.value, '=>this.formDetails')

    const dialogRef = this.dialog.open(QualityDialogComponent, {
      width: '350px',
      data: {
        quality: this.formDetails.get('qualityPst')?.value,
        confirm: true
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (result !== false) {
        this.formDetails.get('qualityPst')?.setValue(result);
      }

      console.log(this.formDetails.get('qualityPst')?.value, '=>this.formDetails last')
    });

  }

  onAddClicked() {
    console.log('Add Category clicked');
  }

  private resetAddState(except?: TableKey) {
    (Object.keys(this.addState) as TableKey[]).forEach(k => {
      this.addState[k] = k === except;
    });
  }

  // เปลี่ยนให้รับ ref + key
  onAddQuestionClicked(table: TablesComponent, key: TableKey) {
    this.resetAddState(key);
    table.startInlineCreate({ activeStatus: false, status: 0 }, 'bottom');
  }

  fetchJobDetails() {
    this.jobPositionService.getJobTemplateById(this.idjobPst).subscribe({
      next: (response) => {
        this.previousData = response;

        this.categoryRows = [];

        this.formDetails.patchValue({
          namePosition: response.namePosition,
          education: response.ideducation === 'BD' ? `Bachelor's Degree or Higher` : ``,
          workingDetails: response.workingDetails === 61 ? `Full Time` : ``,
          // education: response.ideducation,
          // workingDetails: response.workingDetails,
          minExperience: response.experienceMin,
          maxExperience: response.experienceMax,
          minSalary: response.salaryMin,
          maxSalary: response.salaryMax,
          qualityPst: response.quality,
          activeStatus: response.status === 31,
        }, { emitEvent: false });

        this.locationsCtrl.setValue(response.locations ?? [], { emitEvent: false });

        this.responsibilitiesRows = Array.isArray(response.responsibilities)
          ? this.mapStringListToRows(response.responsibilities)
          : [];
        this.requirementsRows = Array.isArray(response.requirements)
          ? this.mapStringListToRows(response.requirements)
          : [];
        this.preferredSkillsRows = Array.isArray(response.preferredSkills)
          ? this.mapStringListToRows(response.preferredSkills)
          : [];

        this.initialSnapshot = {
          categoryRows: JSON.parse(JSON.stringify(this.categoryRows)),
          responsibilitiesRows: JSON.parse(JSON.stringify(this.responsibilitiesRows)),
          requirementsRows: JSON.parse(JSON.stringify(this.requirementsRows)),
          preferredSkillsRows: JSON.parse(JSON.stringify(this.preferredSkillsRows)),
        };

        this.cdr.detectChanges();

        console.log(response)

        this.preselectedbenefits = Array.isArray(response.benefits) ? response.benefits.map(Number) : [];
        this.preselectedlanguageSkills = Array.isArray(response.languageSkills) ? response.languageSkills.map(Number) : [];
        this.preselectedcomputerSkills = Array.isArray(response.computerSkills) ? response.computerSkills.map(Number) : [];

        this.tryApplyPreselect(this.settingWelfareBenefits, 'item', this.preselectedbenefits, 'selectedIdsBenefits');
        this.tryApplyPreselect(this.settingLanguageSkills, 'idlanguage', this.preselectedlanguageSkills, 'selectedIdsLanguage');
        this.tryApplyPreselect(this.settingComputerSkills, 'idcpSkill', this.preselectedcomputerSkills, 'selectedIdsComputer');

        this.initialSnapshot = this.buildSnapshot();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  protected currentFilterParams: IBenefitsFilterRequest = {
    page: 1,
    pageSize: 30,
  };

  fetchBenefitsDetails() {
    this.benefitsService.setBenefitType('general-benefits');
    this.benefitsService.getBenefitsWeb<IApiResponse<IUniversityWithPositionsDto>>(this.currentFilterParams).subscribe({
      next: (res) => {
        this.settingWelfareBenefits = (Array.isArray(res) ? res : ((res as any).items ?? (res as any).data ?? [])) as any[];

        this.tryApplyPreselect(this.settingWelfareBenefits, 'item', this.preselectedbenefits, 'selectedIdsBenefits');
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  fetchLanguageDetails() {
    this.benefitsService.setBenefitType('language-skills');
    this.benefitsService.getBenefitsWeb<IApiResponse<IUniversityWithPositionsDto>>(this.currentFilterParams).subscribe({
      next: (res) => {
        this.settingLanguageSkills = (Array.isArray(res) ? res : ((res as any).items ?? (res as any).data ?? [])) as any[];

        this.tryApplyPreselect(this.settingLanguageSkills, 'idlanguage', this.preselectedlanguageSkills, 'selectedIdsLanguage');
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  fetchComputerDetails() {
    this.benefitsService.setBenefitType('computer-skills');
    this.benefitsService.getBenefitsWeb<IApiResponse<IUniversityWithPositionsDto>>(this.currentFilterParams).subscribe({
      next: (res) => {
        this.settingComputerSkills = (Array.isArray(res) ? res : ((res as any).items ?? (res as any).data ?? [])) as any[];

        this.tryApplyPreselect(this.settingComputerSkills, 'idcpSkill', this.preselectedcomputerSkills, 'selectedIdsComputer');
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  private tryApplyPreselect(setting: any[], item: string, list?: any[] | null, SelectText?: string): void {
    if (!Array.isArray(list) || list.length === 0) return;
    if (!Array.isArray(setting) || setting.length === 0) return;

    if (!SelectText) return;
    const selectedControl = this.formDetails.get(SelectText);
    if (!selectedControl) return;

    const validIds = new Set(setting.map(benefit => Number(benefit[item])));
    const filteredIds = list
      .map(id => Number(id))
      .filter(id => validIds.has(id));

    selectedControl.setValue(filteredIds, { emitEvent: false });
  }

  private mapStringListToRows(arr: string[]): any[] {
    return (arr ?? []).map((text, i) => ({
      message: text,
    }));
  }

  putEmailIDsDetails(id: number, payload: { message: string }) {
    // this.jobPositionService.updateEmailTemplate(id, payload).subscribe({
    //   next: (response) => {
    //   },
    //   error: (error) => {
    //     console.error('Error fetching category types details:', error);
    //   },
    // });
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit':
        // this.setActionButtons('edit');
        this.onEditClicked();
        // this.isEditing = true
        // this.formDetails.enable();
        break;
      case 'save':
        this.onSaveClicked()
        break;
    }
  }

  handleEditRow(row: CategoryDetailForm): void {
    this.setButtonDisabled('save', !this.hasFormChanged());
  }

  onEditClicked() {
    console.log('Edit button clicked');

    this.isEditing = true;
    this.formDetails.enable();
    this.initialSnapshot = this.buildSnapshot();
    this.setActionButtons('edit');
  }

  private setActionButtons(mode: 'view' | 'edit') {
    if (mode === 'view') {
      this.filterButtons = [{ label: 'Edit', key: 'edit', color: '#000000' }];
      this.disabledKeys = [];
    } else {
      this.filterButtons = [{ label: 'Save', key: 'save', color: '#000055' }];
      this.disabledKeys = ['save'];
    }
  }

  private setButtonDisabled(key: string, disabled: boolean) {
    const set = new Set(this.disabledKeys);
    if (disabled) set.add(key);
    else set.delete(key);
    this.disabledKeys = Array.from(set);
  }

  private hasFormChanged(): boolean {
    if (!this.initialSnapshot) return false;
    const current = {
      categoryRows: this.categoryRows,
      responsibilitiesRows: this.responsibilitiesRows,
      requirementsRows: this.requirementsRows,
      preferredSkillsRows: this.preferredSkillsRows,
    };
    const initial = {
      categoryRows: this.initialSnapshot.categoryRows,
      responsibilitiesRows: this.initialSnapshot.responsibilitiesRows,
      requirementsRows: this.initialSnapshot.requirementsRows,
      preferredSkillsRows: this.initialSnapshot.preferredSkillsRows,
    };
    return JSON.stringify(current) !== JSON.stringify(initial);
  }

  private nextIndex(rows: any[]): number {
    const maxIdx = rows.reduce((m, r) => Math.max(m, Number(r?.index) || 0), 0);
    return maxIdx + 1;
  }

  // helper: คืนชื่อพร็อพของตารางตาม key
  private tablePropByKey(key: TableKey): 'responsibilitiesRows' | 'requirementsRows' | 'preferredSkillsRows' {
    return key === 'resp' ? 'responsibilitiesRows'
      : key === 'req' ? 'requirementsRows'
        : 'preferredSkillsRows';
  }

  onSaveClicked() {
    if (!this.hasFormChanged()) return;

    const formValue = this.formDetails.getRawValue();

    const previousData: JobPositionDetails = this.previousData;

    const payload: JobPositionDetails = {
      idjobPst: +this.idjobPst,
      namePosition: formValue.namePosition ?? previousData.namePosition ?? '',
      workingDetails: formValue.workingDetails ?? previousData.workingDetails ?? 0,
      experienceMin: formValue.minExperience ?? previousData.experienceMin ?? 0,
      experienceMax: formValue.maxExperience ?? previousData.experienceMax ?? 0,
      ideducation: formValue.education ?? previousData.ideducation ?? null,
      salaryMin: formValue.minSalary ?? previousData.salaryMin ?? 0,
      salaryMax: formValue.maxSalary ?? previousData.salaryMax ?? 0,
      showSalary: (formValue.minSalary || formValue.maxSalary) ? 1 : previousData.showSalary ?? 0,
      quality: formValue.qualityPst ?? previousData.quality ?? 0,
      status: formValue.activeStatus ? 31 : 32,
      locations: formValue.locations?.length ? formValue.locations : (previousData.locations ?? []),

      responsibilities: this.responsibilitiesRows.length
        ? this.responsibilitiesRows.map(row => row.message)
        : previousData.responsibilities ?? [],

      requirements: this.requirementsRows.length
        ? this.requirementsRows.map(row => row.message)
        : previousData.requirements ?? [],

      preferredSkills: this.preferredSkillsRows.length
        ? this.preferredSkillsRows.map(row => row.message)
        : previousData.preferredSkills ?? [],

      benefits: formValue.selectedIdsBenefits?.length
        ? formValue.selectedIdsBenefits
        : previousData.benefits ?? [],

      computerSkills: formValue.selectedIdsComputer?.length
        ? formValue.selectedIdsComputer
        : previousData.computerSkills ?? [],

      languageSkills: formValue.selectedIdsLanguage?.length
        ? formValue.selectedIdsLanguage
        : previousData.languageSkills ?? [],
    };

    console.log('🚀 ส่ง payload:', payload);

    this.isEditing = false;
    this.formDetails.disable({ emitEvent: false });
    this.initialSnapshot = this.buildSnapshot();
    this.setActionButtons('view');

    // this.jobPositionService.updateJobPosition(this.idjobPst, payload).subscribe({
    //   next: () => {
    //     console.log('อัปเดตสำเร็จ');
    //     this.fetchJobDetails();
    //     this.isEditing = false;
    //     this.setActionButtons('view');
    //     this.formDetails.disable({ emitEvent: false });
    //   },
    //   error: (err) => {
    //     console.error('เกิดข้อผิดพลาด:', err);
    //   }
    // });
  }

  private buildSnapshot() {
    const sortNums = (a: number[], uniq = true) => {
      const arr = (a || []).slice().sort((x, y) => x - y);
      return uniq ? Array.from(new Set(arr)) : arr;
    };

    return {
      responsibilitiesRows: this.responsibilitiesRows,
      requirementsRows: this.requirementsRows,
      preferredSkillsRows: this.preferredSkillsRows,

      selectedIdsBenefits: sortNums(this.formDetails.get('selectedIdsBenefits')?.value ?? []),
      selectedIdsLanguage: sortNums(this.formDetails.get('selectedIdsLanguage')?.value ?? []),
      selectedIdsComputer: sortNums(this.formDetails.get('selectedIdsComputer')?.value ?? []),
      locations: sortNums(this.locationsCtrl.value ?? []),

      form: {
        namePosition: this.formDetails.get('namePosition')?.value ?? '',
        education: this.formDetails.get('education')?.value ?? '',
        workingDetails: this.formDetails.get('workingDetails')?.value ?? '',
        minExperience: this.formDetails.get('minExperience')?.value ?? '',
        maxExperience: this.formDetails.get('maxExperience')?.value ?? '',
        minSalary: this.formDetails.get('minSalary')?.value ?? '',
        maxSalary: this.formDetails.get('maxSalary')?.value ?? '',
        qualityPst: this.formDetails.get('qualityPst')?.value ?? '',
        activeStatus: !!this.formDetails.get('activeStatus')?.value,
      }
    };
  }



  private findChangedRows(): any[] {
    const current = this.categoryRows;
    const initial = this.initialSnapshot?.categoryRows ?? [];

    const changed: any[] = [];

    current.forEach((currRow, index) => {
      const initRow = initial.find((row: any) => row.id === currRow.id);

      if (!initRow) {
        // แถวใหม่
        changed.push(currRow);
      } else {
        // เช็คว่า field ไหนเปลี่ยน
        const hasChanged =
          currRow.subject !== initRow.subject ||
          currRow.message !== initRow.message ||
          currRow.activeStatus !== initRow.activeStatus;

        if (hasChanged) {
          changed.push(currRow);
        }
      }
    });

    return changed;
  }

  onRowClicked(row: any, action: 'view' | 'edit') {
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

    this.formDetails.patchValue({
      selectedCategoryId: row?.categoryId ?? null,
      categoryDetails: { CategoryName: row?.categoryName ?? '' }
    });
  }

  onToggleChangeDetails(e: { row: any; checked: boolean; checkbox: HTMLInputElement }) {
    const row = e.row;
    const idx = this.detailsFA.controls.findIndex((fg: FormGroup) => fg.value.id === row.id);
    if (idx > -1) {
      this.detailsFA.at(idx).patchValue({ activeStatus: e.checked });
      e.checkbox.checked = e.checked;
      this.rebuildDetailsRowsFromForm();
    }
  }

  private rebuildDetailsRowsFromForm() {
    // const arr = this.detailsFA.getRawValue() as CategoryDetailForm[];
    // this.categoryDetailsRows = arr.map((it, idx) => ({
    //   id: it.id,
    //   index: idx + 1,
    //   subject: it.subject,
    //   message: it.message,
    //   activeStatus: !!it.activeStatus,
    //   textlinkActions: ['edit-inrow','delete'], // อาจปรับตามสิทธิ์จาก API
    // }));
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
    return !this.isEditing
  }

  get locationsCtrl(): FormControl<number[]> {
    return this.formDetails.get('locations') as FormControl<number[]>;
  }

  onEditDetailsClicked() {
    console.log('Edit Details button clicked');
    this.categoryDetailsFG.enable();
    this.isEditDetails = true;
  }

  onInlineSave(payload: any, key: TableKey, table?: TablesComponent) {
    this.addState[key] = false;

    const prop = this.tablePropByKey(key);
    const current = (this as any)[prop] as any[];
    const normalized = {
      id: payload.id ?? null,
      subject: (payload.subject ?? '').trim(),
      message: (payload.message ?? '').trim(),
      activeStatus: payload.activeStatus ?? (payload.status === 1),
      index: this.nextIndex(current),
      __tmp: true
    };

    (this as any)[prop] = [...current, normalized];

    this.formDetails.markAsDirty();
    this.setButtonDisabled('save', !this.hasFormChanged());
    this.cdr.markForCheck();

    queueMicrotask(() => {
      try {
        table?.tableWrapperRef?.nativeElement?.scrollTo({
          top: table?.tableWrapperRef?.nativeElement?.scrollHeight ?? 0,
          behavior: 'smooth'
        });
      } catch { }
    });
  }

  onDeleteRowClicked(row: any, key: TableKey, index?: number) {
    Promise.resolve().then(() => {
      document.querySelector('.cdk-overlay-container')?.classList.add('dimmed-overlay');
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

    dialogRef.afterClosed().subscribe((ok: boolean) => {
      document.querySelector('.cdk-overlay-container')?.classList.remove('dimmed-overlay');
      if (!ok) return;

      const prop = this.tablePropByKey(key);
      const current = (this as any)[prop] as any[];

      // ลบแบบ immutable: ใช้ index ถ้ามี, ถ้าไม่มีก็ลบด้วย reference
      let next = current;
      if (typeof index === 'number') {
        next = current.filter((_, i) => i !== index);
      } else {
        next = current.filter(r => r !== row);
        // กันพลาดถ้ามีออบเจ็กต์คนละ reference แต่ค่าซ้ำ
        if (next.length === current.length) {
          next = current.filter((r, i) =>
            i !== current.findIndex(x => x?.id === row?.id ? x.id === row.id
              : x?.message === row?.message && x?.subject === row?.subject));
        }
      }

      (this as any)[prop] = next;              // ✅ เปลี่ยน reference
      this.formDetails.markAsDirty();
      this.setButtonDisabled('save', !this.hasFormChanged());
      this.cdr.markForCheck();
    });
  }

  onLocationToggle(id: number, checked: boolean) {
    const cur = new Set(this.locationsCtrl.value);
    checked ? cur.add(id) : cur.delete(id);

    // setValue ด้วยอาร์เรย์ใหม่ (immutable) → OnPush เห็นแน่นอน
    this.locationsCtrl.setValue(Array.from(cur), { emitEvent: true });

    this.formDetails.markAsDirty();
    this.cdr.markForCheck();
  }

  // ปิดเฉพาะตัว
  onInlineCancel(key: TableKey) {
    this.addState[key] = false;
    this.fieldErrors = false;
  }

  // toggleDropdown(rowIndex: number, field: string, origin: CdkOverlayOrigin, event?: Event) {
  //   event?.stopPropagation();
  //   const column = this.columns.find(c => c.field === field);
  //   if (!column?.options) return;

  //   this.openOverlay(origin, { rowIndex, field, options: column.options });
  // }

  // private openOverlay(
  //   origin: CdkOverlayOrigin,
  //   ctx: { rowIndex: number | null; field: string; options: string[] }
  // ) {
  //   const width = origin.elementRef.nativeElement.offsetWidth ?? 180;

  //   if (!this.overlayRef) {
  //     this.positionStrategy = this.overlay.position()
  //       .flexibleConnectedTo(origin.elementRef)
  //       .withPositions(this.overlayPositions)
  //       .withFlexibleDimensions(false)
  //       .withPush(true)
  //       .withViewportMargin(8);

  //     this.overlayRef = this.overlay.create({
  //       positionStrategy: this.positionStrategy,
  //       hasBackdrop: true,
  //       backdropClass: 'cdk-overlay-transparent-backdrop',
  //       scrollStrategy: this.sso.reposition(),
  //       panelClass: 'tw-z-[9999]',
  //     });

  //     this.overlayRef.backdropClick().subscribe(() => this.closeOverlay());
  //     this.overlayRef.detachments().subscribe(() => this.closeOverlay());
  //   } else {

  //     this.positionStrategy.setOrigin(origin.elementRef);
  //     this.overlayRef.updatePosition();
  //   }

  //   const portal = new TemplatePortal(this.dropdownOverlayTpl, this.vcr, { $implicit: null, ctx, width } as any);
  //   if (this.overlayRef.hasAttached()) this.overlayRef.detach();
  //   this.overlayRef.attach(portal);
  // }

  // isDropdownOpen(rowIndex: number, field: string): boolean {
  //   return (
  //     this.dropdownOverlay?.rowIndex === rowIndex &&
  //     this.dropdownOverlay?.field === field
  //   );
  // }

  // selectDropdownOption(rowIndex: number, field: string, value: string) {
  //   const currentRows = this.rowsValue;
  //   if (currentRows[rowIndex]) {
  //     currentRows[rowIndex][field] = value;
  //   }

  //   this.selectChanged.emit({ rowIndex, field, value });

  //   this.dropdownOverlay = null;
  //   this.cdr.detectChanges();
  // }

}

