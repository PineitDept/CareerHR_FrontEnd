import { ChangeDetectorRef, Component, HostListener, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { defaultFilterButtons, PreferredSkillsColumn, RequirementsColumns, ResponsibilitiesColumns } from '../../../../../../../../../app/constants/admin-setting/job-position.constants';
import { JobPositionService } from '../../../../../../../../../app/services/admin-setting/job-position/job-position.service';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TablesComponent } from '../../../../../../../../shared/components/tables/tables.component';
import { CdkDropdownComponent } from '../../../../../../../../shared/components/cdk-dropdown/cdk-dropdown.component';
import { CaptchaDialogComponent } from '../../../../../../../../shared/components/dialogs/captcha-dialog/captcha-dialog.component';
import { distinctUntilChanged, forkJoin, map } from 'rxjs';
import { GeneralBenefitsService } from '../../../../../../../../services/admin-setting/general-benefits/general-benefits.service';
import { IApiResponse, IBenefitsFilterRequest, IBenefitsWithPositionsDto, IComputerWithPositionsDto, ILanguageWithPositionsDto, IUniversityWithPositionsDto } from '../../../../../../../../interfaces/admin-setting/general-benefits.interface';
import { QualityDialogComponent } from '../../../../../../../../shared/components/dialogs/quality-dialog/quality-dialog.component';
import { JobPositionDetails } from '../../../../../../../../interfaces/admin-setting/job-position.interface';
import { CdkOverlayOrigin, ConnectedPosition, FlexibleConnectedPositionStrategy, Overlay, OverlayRef, ScrollStrategyOptions } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { AlertDialogComponent } from '../../../../../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { NotificationService } from '../../../../../../../../shared/services/notification/notification.service';

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
type DropdownOption = { label: string; value: any; disabled?: boolean };
type DropdownCtx = { control: FormControl; options: DropdownOption[]; multi: boolean; title?: string } | null;

type JobPositionCache = {
  form: {
    namePosition: string;
    education: any;
    workingDetails: any;
    minExperience: any;
    maxExperience: any;
    minSalary: any;
    maxSalary: any;
    qualityPst: any;
    activeStatus: boolean;
  };
  selections: {
    selectedIdsBenefits: number[];
    selectedIdsLanguage: number[];
    selectedIdsComputer: number[];
    selectedIdsComputerSupport: number[];
    selectedIdsBonus: number[];
    locations: number[];
  };
  lists: {
    responsibilities: string[];
    requirements: string[];
    preferredSkills: string[];
  };
  isEditing: boolean;
  ts: number;
};

@HostListener('window:beforeunload')

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
  settingComputerSkillsAll: any[] = [];
  coreComputerPool: any[] = [];
  supportComputerPool: any[] = [];
  settingBonusSkills: any[] = [];

  preselectedbenefits: number[] | null = null;
  preselectedlanguageSkills: number[] | null = null;
  preselectedcomputerSkills: number[] | null = null;
  preselectedbonusSkills: number[] | null = null;
  preselectedCoreIds: number[] | null = null;
  preselectedSupportIds: number[] | null = null;
  computerSkill: any[] = [];
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

  locationsList: any;

  private overlayRef: OverlayRef | null = null;
  private positionStrategy!: FlexibleConnectedPositionStrategy;


  dropdownCtx: DropdownCtx = null;
  dropdownSearch = '';

  educationOptions: DropdownOption[] = [];
  workingOptions: DropdownOption[] = [];

  // educationOptions: DropdownOption[] = [
  //   { label: "Bachelor's Degree or Higher", value: 'BD' },
  //   { label: "Master's Degree or Higher", value: 'MD' },
  //   { label: "High School or Higher", value: 'HS' },
  // ];

  // workingOptions: DropdownOption[] = [
  //   { label: 'Full Time', value: 61 },
  //   { label: 'Part Time', value: 62 },
  //   { label: 'Contract', value: 63 },
  // ];

  @ViewChild('dropdownOverlayTpl', { static: true }) dropdownOverlayTpl!: TemplateRef<any>;

  overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  private readonly cacheKeyBase = 'job-position-details:';
  private cacheKey(): string {
    return `${this.cacheKeyBase}${this.idjobPst || 'new'}`;
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(_: Event) {
    this.saveCache();
  }

  constructor(
    private jobPositionService: JobPositionService,
    private benefitsService: GeneralBenefitsService,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private overlay: Overlay,
    private vcr: ViewContainerRef,
    private sso: ScrollStrategyOptions,
    private notificationService: NotificationService,
  ) { }

  ngOnInit() {
    this.jobPositionService.setEMailType('job-position');
    this.initializeForm();
    this.formDetails.disable({ emitEvent: false });

    // ⛳ เก็บทุกครั้งที่แก้ฟอร์ม (ไม่ต้องเช็ค isEditing สำหรับการ saveCache)
    this.formDetails.valueChanges
      .pipe(
      // กันการยิงถี่ตอนพิมพ์
      // ใช้ auditTime/ debounceTime ได้ตามชอบ
    )
      .subscribe(() => {
        this.saveCache();
        if (this.isEditing) {
          this.nextTick(() => this.setButtonDisabled('save', !this.hasFormChanged()));
        }
      });

    // ⛳ ดูแลคอนโทรลที่เป็น array (dual-listbox / locations)
    this.watchArrayControlForCaching('selectedIdsBenefits');
    this.watchArrayControlForCaching('selectedIdsLanguage');
    this.watchArrayControlForCaching('selectedIdsComputer');
    this.watchArrayControlForCaching('selectedIdsComputerSupport');
    this.watchArrayControlForCaching('selectedIdsBonus');
    this.watchArrayControlForCaching('locations');

    // ที่เหลือตามเดิม
    this.route.queryParams.subscribe(params => {
      this.idjobPst = params['idjobPst'] || '';
      this.fetchWorkDetailsDetails();
      this.fetchEducationLevelsDetails();
      this.fetchBenefitsDetails();
      this.fetchLanguageDetails();
      this.fetchComputerDetails();
      this.fetchBonusDetails();
      this.fetchLocationDetails();
      this.fetchJobDetails();

      if (this.idjobPst === '') {
        setTimeout(() => {
          this.isEditing = true
          this.formDetails.enable();

          const restored = this.restoreFromCacheIfAny?.() ?? false;
          if (!restored || this.formDetails.get('qualityPst')?.value == '') {
            this.formDetails.get('qualityPst')?.setValue(0)
            this.nextTick(() => this.setActionButtons('edit'));
          }
        }, 100)
      }
    });
  }

  ngAfterViewInit() {
    this.nextTick(() => this.setActionButtons('view'));
  }

  private watchArrayControlForCaching(name: string) {
    const ctrl = this.formDetails.get(name);
    if (!ctrl) return;
    ctrl.valueChanges
      .pipe(
        map(v => Array.isArray(v) ? [...v] : v),
        distinctUntilChanged((a, b) => this.stableStringify(a) === this.stableStringify(b))
      )
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
      qualityPst: [0],
      activeStatus: [false],
      selectedIdsBenefits: [] as number[],
      selectedIdsLanguage: [] as number[],
      selectedIdsComputer: [] as number[],
      selectedIdsComputerSupport: [] as number[],
      selectedIdsBonus: [] as number[],
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
    this.saveCache();
  }

  toggleQuality(): void {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(QualityDialogComponent, {
      width: '350px',
      panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
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
        this.saveCache();
      }
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
          education: response.ideducation,
          workingDetails: response.workingDetails,
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

        // this.initialSnapshot = {
        //   categoryRows: JSON.parse(JSON.stringify(this.categoryRows)),
        //   responsibilitiesRows: JSON.parse(JSON.stringify(this.responsibilitiesRows)),
        //   requirementsRows: JSON.parse(JSON.stringify(this.requirementsRows)),
        //   preferredSkillsRows: JSON.parse(JSON.stringify(this.preferredSkillsRows)),
        // };

        this.cdr.detectChanges();

        this.preselectedbenefits = Array.isArray(response.benefits) ? response.benefits.map(Number) : [];
        this.preselectedlanguageSkills = Array.isArray(response.languageSkills) ? response.languageSkills.map(Number) : [];
        // this.preselectedcomputerSkills = Array.isArray(response.computerSkills) ? response.computerSkills.map(Number) : [];
        // this.preselectedcomputerSkills = Array.isArray(response.computerSkills) ? response.computerSkills.map((skill: any) => Number(skill.id)) : [];
        const computerSkills = Array.isArray(response.computerSkills) ? response.computerSkills : [];
        this.preselectedCoreIds = computerSkills.filter((s: any) => +s.typeSkill === 1).map((s: any) => +s.id);
        this.preselectedSupportIds = computerSkills.filter((s: any) => +s.typeSkill === 2).map((s: any) => +s.id);
        this.preselectedbonusSkills = Array.isArray(response.bonusSkills) ? response.bonusSkills : [];

        this.computerSkill = response.computerSkills

        this.tryApplyPreselect(this.settingWelfareBenefits, 'item', this.preselectedbenefits, 'selectedIdsBenefits');
        this.tryApplyPreselect(this.settingLanguageSkills, 'idlanguage', this.preselectedlanguageSkills, 'selectedIdsLanguage');
        this.tryApplyPreselect(this.settingComputerSkills, 'idcpSkill', this.preselectedCoreIds, 'selectedIdsComputer');
        this.tryApplyPreselect(this.settingComputerSkills, 'idcpSkill', this.preselectedSupportIds, 'selectedIdsComputerSupport');
        this.tryApplyPreselect(this.settingBonusSkills, 'id', this.preselectedbonusSkills, 'selectedIdsBonus');
        this.rebuildComputerPools();

        this.initialSnapshot = {
          form: {
            namePosition: response.namePosition ?? '',
            education: response.ideducation ?? '',
            workingDetails: response.workingDetails ?? '',
            minExperience: response.experienceMin ?? '',
            maxExperience: response.experienceMax ?? '',
            minSalary: response.salaryMin ?? '',
            maxSalary: response.salaryMax ?? '',
            qualityPst: response.quality ?? 0,
            activeStatus: (response.status === 31),
          },
          selections: {
            selectedIdsBenefits: this.preselectedbenefits,
            selectedIdsLanguage: this.preselectedlanguageSkills,
            selectedIdsComputer: this.preselectedcomputerSkills,
            selectedIdsComputerSupport: this.preselectedcomputerSkills,
            selectedIdsBonus: this.preselectedbonusSkills,
            locations: this.toNumArr(response.locations),
          },
          lists: {
            responsibilities: this.cleanStringList(response.responsibilities),
            requirements: this.cleanStringList(response.requirements),
            preferredSkills: this.cleanStringList(response.preferredSkills),
          }
        };

        const restored = this.restoreFromCacheIfAny?.() ?? false;
        if (restored) {
          // this.initialSnapshot = sessionStorage.getItem(this.cacheKey());
        }

        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  private cleanStringList(list: unknown): string[] {
    return Array.isArray(list)
      ? list.map(x => String(x ?? '').trim()).filter(Boolean)
      : [];
  }

  protected currentFilterParams: IBenefitsFilterRequest = {
    page: 1,
    pageSize: 30,
  };

  fetchBenefitsDetails() {
    this.benefitsService.setBenefitType('general-benefits');
    this.benefitsService.getBenefitsWeb<IBenefitsWithPositionsDto>(this.currentFilterParams).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.items ?? (res as any)?.data ?? []);
        this.settingWelfareBenefits = (list as any[]).filter(x => Number(x?.status) !== 2);

        // this.tryApplyPreselect(this.settingWelfareBenefits, 'item', this.preselectedbenefits, 'selectedIdsBenefits');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  fetchLanguageDetails() {
    this.benefitsService.setBenefitType('language-skills');
    this.benefitsService.getBenefitsWeb<ILanguageWithPositionsDto>(this.currentFilterParams).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.items ?? (res as any)?.data ?? []);
        this.settingLanguageSkills = (list as any[]).filter(x => Number(x?.status) !== 2);

        // this.tryApplyPreselect(this.settingLanguageSkills, 'idlanguage', this.preselectedlanguageSkills, 'selectedIdsLanguage');
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  fetchComputerDetails() {
    this.benefitsService.setBenefitType('computer-skills');
    this.benefitsService.getBenefitsWeb<IComputerWithPositionsDto>(this.currentFilterParams).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.items ?? (res as any)?.data ?? []);
        this.settingComputerSkillsAll = (list as any[]).filter(x => Number(x?.status) !== 2);
        this.settingComputerSkills = this.settingComputerSkillsAll;

        this.rebuildComputerPools();
      },
      error: (error) => console.error('Error fetching category types details:', error),
    });
  }


  private rebuildComputerPools() {
    const coreSel = new Set(this.toNumArr(this.formDetails.get('selectedIdsComputer')?.value));
    const supportSel = new Set(this.toNumArr(this.formDetails.get('selectedIdsComputerSupport')?.value));

    this.coreComputerPool = this.settingComputerSkillsAll.filter(
      x => !supportSel.has(Number(x.idcpSkill))
    );

    this.supportComputerPool = this.settingComputerSkillsAll.filter(
      x => !coreSel.has(Number(x.idcpSkill))
    );

    this.cdr.markForCheck();
  }

  fetchBonusDetails() {
    this.jobPositionService.getAllJobBonusDetails().subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.items ?? (res as any)?.data ?? []);
        this.settingBonusSkills = (list as any[]).filter(x => x?.isActive !== false);
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  fetchLocationDetails() {
    this.benefitsService.setBenefitType('location');
    this.benefitsService.getBenefitsWeb<IApiResponse<IUniversityWithPositionsDto>>(this.currentFilterParams).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.items ?? (res as any)?.data ?? []);
        this.locationsList = (list as any[]).filter(x => x?.isActive !== false);
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  fetchEducationLevelsDetails() {
    this.jobPositionService.getAllJobEducationLevels().subscribe({
      next: (res) => {
        this.educationOptions = res.map((item: any) => ({
          label: item.educationName,
          value: item.educationId,
        }));
      },
      error: (error) => {
        console.error('Error fetching education levels:', error);
      },
    });
  }

  fetchWorkDetailsDetails() {
    this.jobPositionService.getAllJobWorkDetails().subscribe({
      next: (res) => {
        this.workingOptions = res.map((item: any) => ({
          label: item.workDetailName,
          value: item.workDetailsId,
        }));
      },
      error: (error) => {
        console.error('Error fetching work details:', error);
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

    const restored = this.restoreFromCacheIfAny?.() ?? false;
    if (!restored) {
    }
  }

  private mapStringListToRows(arr: string[]): any[] {
    return (arr ?? []).map((text, i) => ({
      message: text,
    }));
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
    this.isEditing = true;
    this.formDetails.enable();
    // this.initialSnapshot = this.buildSnapshot();

    this.nextTick(() => this.setActionButtons('edit'));
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
    disabled ? set.add(key) : set.delete(key);
    this.disabledKeys = Array.from(set);
  }

  private toNumArr(v: any): number[] {
    return Array.isArray(v)
      ? v.map(n => Number(n)).filter(n => Number.isFinite(n))
      : [];
  }

  private extractMessages(rows: any[]): string[] {
    return (rows ?? [])
      .map(r => String(r?.message ?? '').trim())
      .filter(Boolean);
  }

  private toRows(msgs: string[]): any[] {
    return (msgs ?? []).map(m => ({ message: m }));
  }


  private buildSnapshot() {
    const f = this.formDetails.getRawValue?.() ?? {};
    return {
      form: {
        namePosition: f.namePosition ?? '',
        education: f.education ?? '',
        workingDetails: f.workingDetails ?? '',
        minExperience: f.minExperience ?? '',
        maxExperience: f.maxExperience ?? '',
        minSalary: f.minSalary ?? '',
        maxSalary: f.maxSalary ?? '',
        qualityPst: f.qualityPst ?? '',
        activeStatus: !!f.activeStatus,
      },
      selections: {
        selectedIdsBenefits: this.toNumArr(this.formDetails.get('selectedIdsBenefits')?.value),
        selectedIdsLanguage: this.toNumArr(this.formDetails.get('selectedIdsLanguage')?.value),
        selectedIdsComputer: this.toNumArr(this.formDetails.get('selectedIdsComputer')?.value),
        selectedIdsComputerSupport: this.toNumArr(this.formDetails.get('selectedIdsComputer')?.value),
        selectedIdsBonus: this.toNumArr(this.formDetails.get('selectedIdsBonus')?.value),
        locations: this.toNumArr(this.locationsCtrl.value),
      },
      lists: {
        responsibilities: this.extractMessages(this.responsibilitiesRows),
        requirements: this.extractMessages(this.requirementsRows),
        preferredSkills: this.extractMessages(this.preferredSkillsRows),
      }
    };
  }

  private stableStringify(x: any): string {
    if (Array.isArray(x)) return '[' + x.map(v => this.stableStringify(v)).join(',') + ']';
    if (x && typeof x === 'object') {
      const keys = Object.keys(x).sort();
      return '{' + keys.map(k => JSON.stringify(k) + ':' + this.stableStringify(x[k])).join(',') + '}';
    }
    return JSON.stringify(x);
  }

  private hasFormChanged(): boolean {
    const raw = sessionStorage.getItem(this.cacheKey());
    if (!raw) return false;

    if (!this.initialSnapshot) return false;
    if (this.isViewMode) return false;
    // if (this.restoreFromCacheIfAny?.()) return false;

    const current = this.buildSnapshot();
    return this.stableStringify(current) !== this.stableStringify(this.initialSnapshot);
  }

  private nextIndex(rows: any[]): number {
    const maxIdx = rows.reduce((m, r) => Math.max(m, Number(r?.index) || 0), 0);
    return maxIdx + 1;
  }

  private nextTick(fn: () => void) {
    Promise.resolve().then(fn);
  }

  // helper: คืนชื่อพร็อพของตารางตาม key
  private tablePropByKey(key: TableKey): 'responsibilitiesRows' | 'requirementsRows' | 'preferredSkillsRows' {
    return key === 'resp' ? 'responsibilitiesRows'
      : key === 'req' ? 'requirementsRows'
        : 'preferredSkillsRows';
  }

  onSaveClicked() {
    if (!this.hasFormChanged()) return;

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
        confirm: true
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (confirmed) {
        const formValue = this.formDetails.getRawValue();

        const previousData: JobPositionDetails = this.previousData;

        const coreIds = this.toNumArr(this.formDetails.get('selectedIdsComputer')?.value);
        const supportIds = this.toNumArr(this.formDetails.get('selectedIdsComputerSupport')?.value);

        const computerSkills = [
          ...coreIds.map(id => ({ id, typeSkill: 1 })),    // Core
          ...supportIds.map(id => ({ id, typeSkill: 2 })), // Support
        ];

        const payload: JobPositionDetails = {
          // idjobPst: +this.idjobPst,
          namePosition: formValue.namePosition ?? previousData.namePosition ?? '',
          ideducation: formValue.education ?? previousData.ideducation ?? null,
          workingDetails: formValue.workingDetails ?? previousData.workingDetails ?? 0,
          experienceMin: formValue.minExperience ?? previousData.experienceMin ?? 0,
          experienceMax: formValue.maxExperience ?? previousData.experienceMax ?? 0,
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

          computerSkills,

          bonusSkills: formValue.selectedIdsBonus?.length
            ? formValue.selectedIdsBonus
            : previousData.bonusSkills ?? [],

          languageSkills: formValue.selectedIdsLanguage?.length
            ? formValue.selectedIdsLanguage
            : previousData.languageSkills ?? [],
        };

        if (this.idjobPst !== '') {
          this.jobPositionService.updateJobPosition(this.idjobPst, payload).subscribe({
            next: () => {
              this.isEditing = false;
              this.formDetails.disable({ emitEvent: false });
              this.initialSnapshot = this.buildSnapshot();
              this.nextTick(() => this.setActionButtons('view'));
              this.clearDraftsForCurrentType();
            },
            error: (err) => {
              this.showValidationErrorsOnly(err);
            }
          });

        } else {
          this.jobPositionService.postJobPosition(payload).subscribe({
            next: () => {
              this.isEditing = false;
              this.formDetails.disable({ emitEvent: false });
              this.initialSnapshot = this.buildSnapshot();
              this.nextTick(() => this.setActionButtons('view'));

              this.clearDraftsForCurrentType();
            },
            error: (err) => {
              this.showValidationErrorsOnly(err);
            }
          });
        }
      }
    });

  }

  // helpers.ts (หรือใส่ไว้ใน component ก็ได้)
  private showValidationErrorsOnly(err: any) {
    const notify = (errorsObj: Record<string, string[]> | null) => {
      if (errorsObj && typeof errorsObj === 'object') {
        console.group('🔴 Validation Errors');
        Object.entries(errorsObj).forEach(([key, val]) => {
          console.error(`${key}:`, (val ?? []).join(', '));
        });
        console.groupEnd();

        const msg = Object.entries(errorsObj)
          .map(([k, v]) => `${k}: ${(v ?? []).join(', ')}`)
          .join('\n');

        // this.notificationService.error(msg || 'Validation error.');
        Object.entries(errorsObj).forEach(([k, v]) => {
          this.notificationService.error(`${k}: ${(v ?? []).join(', ')}`);
        });
        return true;
      }
      return false;
    };

    // 1) รูปแบบปกติ (object)
    if (notify(err?.error?.errors)) return;
    if (notify(err?.error?.error?.errors)) return;

    // 2) ถ้า backend ส่งเป็น JSON string
    if (typeof err?.error === 'string') {
      try {
        const parsed = JSON.parse(err.error);
        if (notify(parsed?.errors) || notify(parsed?.error?.errors)) return;
      } catch { /* noop */ }
    }

    // 3) ถ้าส่งมาเป็น Blob (เช่น text/html, text/plain)
    if (err?.error instanceof Blob) {
      err.error.text().then((t: string) => {
        try {
          const parsed = JSON.parse(t);
          if (notify(parsed?.errors) || notify(parsed?.error?.errors)) return;
        } catch {
          // ถ้า parse ไม่ได้ก็ fallback
          this.notificationService.error('Unexpected error occurred.');
        }
      });
      return; // ออกก่อน เพราะจะไปแสดงใน promise ข้างบน
    }

    // 4) fallback
    this.notificationService.error('Unexpected error occurred.');
  }

  onRowClicked(row: any, action: 'view' | 'edit') {
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
    }
  }

  get categoriesFA() {
    return this.formDetails.get('categories') as any; // FormArray<FormGroup<CategoryForm>>
  }

  get categoryDetailsFG() {
    return this.formDetails.get('categoryDetails') as FormGroup;
  }
  get detailsFA() {
    return this.categoryDetailsFG.get('items') as any;
  }

  get isDisabled() {
    return !this.isEditing
  }

  get locationsCtrl(): FormControl<number[]> {
    return this.formDetails.get('locations') as FormControl<number[]>;
  }

  onEditDetailsClicked() {
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
    this.saveCache();

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
      panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
      disableClose: true,
      data: {
        title: 'Delete',
        message: 'Are you sure you want to delete this item?',
        length: 6,
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

      (this as any)[prop] = next;
      this.formDetails.markAsDirty();
      this.setButtonDisabled('save', !this.hasFormChanged());
      this.cdr.markForCheck();
      this.saveCache();
    });
  }

  onLocationToggle(id: number, checked: boolean) {
    const cur = new Set(this.locationsCtrl.value);
    checked ? cur.add(id) : cur.delete(id);

    // setValue ด้วยอาร์เรย์ใหม่ (immutable) → OnPush เห็นแน่นอน
    this.locationsCtrl.setValue(Array.from(cur), { emitEvent: true });

    this.formDetails.markAsDirty();
    this.cdr.markForCheck();
    this.saveCache();
  }

  // ปิดเฉพาะตัว
  onInlineCancel(key: TableKey) {
    this.addState[key] = false;
    this.fieldErrors = false;
  }



  private buildCachePayload(): JobPositionCache {
    const f = this.formDetails.getRawValue();

    return {
      form: {
        namePosition: f.namePosition ?? '',
        education: f.education ?? '',
        workingDetails: f.workingDetails ?? '',
        minExperience: f.minExperience ?? '',
        maxExperience: f.maxExperience ?? '',
        minSalary: f.minSalary ?? '',
        maxSalary: f.maxSalary ?? '',
        qualityPst: f.qualityPst ?? '',
        activeStatus: !!f.activeStatus,
      },
      selections: {
        selectedIdsBenefits: this.toNumArr(this.formDetails.get('selectedIdsBenefits')?.value),
        selectedIdsLanguage: this.toNumArr(this.formDetails.get('selectedIdsLanguage')?.value),
        selectedIdsComputer: this.toNumArr(this.formDetails.get('selectedIdsComputer')?.value),
        selectedIdsComputerSupport: this.toNumArr(this.formDetails.get('selectedIdsComputer')?.value),
        selectedIdsBonus: this.toNumArr(this.formDetails.get('selectedIdsBonus')?.value),
        locations: this.toNumArr(this.locationsCtrl.value),
      },
      lists: {
        responsibilities: this.extractMessages(this.responsibilitiesRows),
        requirements: this.extractMessages(this.requirementsRows),
        preferredSkills: this.extractMessages(this.preferredSkillsRows),
      },
      isEditing: this.isEditing,
      ts: Date.now(),
    };
  }

  private saveCache(): void {
    if (!this.formDetails || !this.initialSnapshot) return;
    const cache = this.buildCachePayload();
    sessionStorage.setItem(this.cacheKey(), JSON.stringify(cache));

    // if (this.hasFormChanged()) {
    //   const cache = this.buildCachePayload();
    //   sessionStorage.setItem(this.cacheKey(), JSON.stringify(cache));
    // } else {
    //   // sessionStorage.removeItem(this.cacheKey()); // กลับมาเท่า baseline → เคลียร์ cache
    // }
  }

  // public hasPendingDrafts(): boolean {
  //   const cache = this.buildCachePayload();
  //   sessionStorage.setItem(this.cacheKey(), JSON.stringify(cache));
  // }

  private restoreFromCacheIfAny(): boolean {
    const raw = sessionStorage.getItem(this.cacheKey());
    if (!raw) return false;

    try {
      const cache = JSON.parse(raw) as JobPositionCache;

      // form fields
      this.formDetails.patchValue(cache.form, { emitEvent: false });

      // selections
      this.formDetails.get('selectedIdsBenefits')?.setValue(cache.selections.selectedIdsBenefits ?? [], { emitEvent: false });
      this.formDetails.get('selectedIdsLanguage')?.setValue(cache.selections.selectedIdsLanguage ?? [], { emitEvent: false });
      this.formDetails.get('selectedIdsComputer')?.valueChanges
        .pipe(distinctUntilChanged((a, b) => this.stableStringify(a) === this.stableStringify(b)))
        .subscribe(() => this.rebuildComputerPools());
      this.formDetails.get('selectedIdsComputerSupport')?.valueChanges
        .pipe(distinctUntilChanged((a, b) => this.stableStringify(a) === this.stableStringify(b)))
        .subscribe(() => this.rebuildComputerPools());
      this.formDetails.get('selectedIdsBonus')?.setValue(cache.selections.selectedIdsBonus ?? [], { emitEvent: false });
      this.locationsCtrl.setValue(cache.selections.locations ?? [], { emitEvent: false });

      // lists -> rows
      this.responsibilitiesRows = this.toRows(cache.lists.responsibilities);
      this.requirementsRows = this.toRows(cache.lists.requirements);
      this.preferredSkillsRows = this.toRows(cache.lists.preferredSkills);

      // this.isEditing = !!cache.isEditing;
      // this.setActionButtons(this.isEditing ? 'edit' : 'view');
      // this.isEditing ? this.formDetails.enable({ emitEvent: false }) : this.formDetails.disable({ emitEvent: false });

      setTimeout(() => {
        this.isEditing = true;
        this.setActionButtons('edit');
        this.disabledKeys = [];
        this.isEditing ? this.formDetails.enable({ emitEvent: false }) : this.formDetails.disable({ emitEvent: false });
      })

      // ถ้า dual-listbox ไม่ refresh เอง ให้ re-emit ค่าหน่อย
      this.reemitControl('selectedIdsBenefits');
      this.reemitControl('selectedIdsLanguage');
      this.reemitControl('selectedIdsComputer');
      this.reemitControl('selectedIdsComputerSupport');
      this.reemitControl('selectedIdsBonus');

      this.cdr.markForCheck();
      return true;
    } catch {
      return false;
    }
  }

  private reemitControl(name: string) {
    const ctrl = this.formDetails.get(name);
    if (!ctrl) return;
    const v = ctrl.value;
    ctrl.setValue(Array.isArray(v) ? [...v] : v, { emitEvent: false });
  }


  public clearDraftsForCurrentType(): void {
    sessionStorage.removeItem(this.cacheKey());
  }

  onBeforeUnload() {
    this.saveCache();
  }
}

