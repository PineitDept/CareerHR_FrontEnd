import { ChangeDetectorRef, Component, HostListener, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { defaultFilterButtons, PreferredSkillsColumn, RequirementsColumns, ResponsibilitiesColumns } from '../../../../../../../../../app/constants/admin-setting/interviewer.constants';
import { InterviewerService } from '../../../../../../../../../app/services/admin-setting/interviewer/interviewer.service';
import { InterviewerDetails } from '../../../../../../../../interfaces/admin-setting/interviewer.interface';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TablesComponent } from '../../../../../../../../shared/components/tables/tables.component';
import { CdkDropdownComponent } from '../../../../../../../../shared/components/cdk-dropdown/cdk-dropdown.component';
import { CaptchaDialogComponent } from '../../../../../../../../shared/components/dialogs/captcha-dialog/captcha-dialog.component';
import { distinctUntilChanged, forkJoin, map, Observable } from 'rxjs';
import { GeneralBenefitsService } from '../../../../../../../../services/admin-setting/general-benefits/general-benefits.service';
import { IApiResponse, IBenefitsFilterRequest, IBenefitsWithPositionsDto, IComputerWithPositionsDto, ILanguageWithPositionsDto, IUniversityWithPositionsDto } from '../../../../../../../../interfaces/admin-setting/general-benefits.interface';
import { QualityDialogComponent } from '../../../../../../../../shared/components/dialogs/quality-dialog/quality-dialog.component';
import { CdkOverlayOrigin, ConnectedPosition, FlexibleConnectedPositionStrategy, Overlay, OverlayRef, ScrollStrategyOptions } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { AlertDialogComponent } from '../../../../../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { NotificationService } from '../../../../../../../../shared/services/notification/notification.service';


type InterviewerCache = {
  form: {
    teamName: string;
    isActive: boolean;
  };
  selections: {
    selectedIdsInterviewer: number[];
  };
  isEditing: boolean;
  ts: number;
};

@Component({
  selector: 'app-interviewer-teams-details',
  templateUrl: './interviewer-teams-details.component.html',
  styleUrl: './interviewer-teams-details.component.scss'
})
export class InterviewerTeamsDetailsComponent {
  @ViewChild('ResponsibilitiesTable') ResponsibilitiesTable!: TablesComponent;
  @ViewChild('RequirementsTable') RequirementsTable!: TablesComponent;
  @ViewChild('PreferredSkillsTable') PreferredSkillsTable!: TablesComponent;

  isEditing = false;
  private initialSnapshot: any = null;

  formDetails!: FormGroup;
  filterButtons = defaultFilterButtons();

  disabledKeys: string[] = [];

  AttrID: string = '';
  teamId: string = '';
  EmailSubject: string = '';

  settingInterviewer: any[] = [];
  preselectedInterviewer: number[] | null = null;

  categoryRows: any[] = [];
  categoryDetailsRows: any[] = [];
  previousData!: InterviewerDetails;

  isEnabledCardDetails = false;

  isViewMode = false;
  isAddMode = false;
  isEditMode = false;
  isEditDetails = false;

  fieldErrors = false;
  duplicateRowIndex: number | null = null;

  private readonly cacheKeyBase = 'interviewer-teams-details:';
  private cacheKey(): string {
    return `${this.cacheKeyBase}${this.teamId || 'new'}`;
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(_: Event) {
    this.saveCache();
  }

  constructor(
    private interviewerService: InterviewerService,
    private benefitsService: GeneralBenefitsService,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService,
  ) { }

  ngOnInit() {
    this.initializeForm();
    this.formDetails.disable({ emitEvent: false });

    this.formDetails.valueChanges.pipe().subscribe(() => {
      this.saveCache();
      if (this.isEditing) {
        this.nextTick(() => this.setButtonDisabled('save', !this.hasFormChanged()));
      }
    });

    this.watchArrayControlForCaching('selectedIdsInterviewer');

    this.route.queryParams.subscribe(params => {
      this.teamId = params['teamId'] || '';

      this.fetchInterviewerDetails().subscribe(() => {
        const restored = this.restoreFromCacheIfAny();

        if (restored) {
          this.reemitControl('selectedIdsInterviewer');
          this.isEditing = true;
          this.formDetails.enable({ emitEvent: false });
          this.nextTick(() => this.setActionButtons('edit'));

          if (this.teamId) {
            this.fetchInterviewerTeamDetails(true);
          } else {
            this.initialSnapshot = this.emptyBaseline();
            this.isAddMode = true;
          }
        } else {
          if (this.teamId) {
            this.fetchInterviewerTeamDetails(false);
          } else {
            this.initialSnapshot = this.emptyBaseline();
            this.isEditing = true;
            this.formDetails.enable({ emitEvent: false });
            this.setActionButtons('edit');
            this.isAddMode = true;
          }
        }
      });
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
      teamName: [''],
      isActive: [true],
      selectedIdsInterviewer: [] as number[],
    });
  }

  onUserToggleRequested(event?: Event): void {
    if (!this.isEditing) return;

    const current = this.formDetails.get('isActive')?.value;

    this.formDetails.get('isActive')?.setValue(!current);

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.saveCache();
  }

  onAddClicked() {
    console.log('Add Category clicked');
  }

  private emptyBaseline() {
    return {
      form: { teamName: '', isActive: true },
      selections: { selectedIdsInterviewer: [] as number[] }
    };
  }

  fetchInterviewerTeamDetails(baselineOnly = false) {
    if (!this.teamId) return;

    this.interviewerService.getTeamById(this.teamId).subscribe({
      next: (response) => {
        this.previousData = response;
        const preselected = Array.isArray(response.members)
          ? response.members.map((m: any) => Number(m.interviewerId))
          : [];

        this.initialSnapshot = {
          form: {
            teamName: response.teamName ?? '',
            isActive: response.isActive === true,
          },
          selections: {
            selectedIdsInterviewer: preselected,
          }
        };

        if (!baselineOnly) {
          this.formDetails.patchValue({
            teamName: response.teamName,
            isActive: response.isActive === true,
          }, { emitEvent: false });
          this.tryApplyPreselect(this.settingInterviewer, 'idEmployee', preselected, 'selectedIdsInterviewer');
        }

        this.cdr.markForCheck();
      },
      error: (error) => console.error(error),
    });
  }

  protected currentFilterParams: IBenefitsFilterRequest = {
    page: 1,
    pageSize: 30,
  };

  fetchInterviewerDetails(): Observable<any[]> {
    this.benefitsService.setBenefitType('interviewer-list');
    return this.benefitsService.getBenefitsWeb<IBenefitsWithPositionsDto>(this.currentFilterParams).pipe(
      map((res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.items ?? (res as any)?.data ?? []);
        this.settingInterviewer = (list as any[]).filter(x => x?.isActive !== false);
        this.cdr.markForCheck();
        return this.settingInterviewer;
      })
    );
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

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit':
        this.onEditClicked();
        break;
      case 'save':
        this.onSaveClicked()
        break;
    }
  }

  onEditClicked() {
    this.isEditing = true;
    this.formDetails.enable();
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

  private buildSnapshot() {
    const f = this.formDetails.getRawValue?.() ?? {};
    return {
      form: {
        teamName: f.teamName ?? '',
        isActive: !!f.isActive,
      },
      selections: {
        selectedIdsInterviewer: this.toNumArr(this.formDetails.get('selectedIdsInterviewer')?.value),
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
    if (!this.initialSnapshot) return false;
    if (this.isViewMode) return false;

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

        const previousData: InterviewerDetails = this.previousData;

        const payload: InterviewerDetails = {
          teamName: formValue.teamName ?? previousData.teamName ?? '',
          isActive: formValue.isActive ? true : false
        };

        console.log('🚀 ส่ง payload:', payload);


        const newIds = this.formDetails.get('selectedIdsInterviewer')?.value ?? [];

        if (this.teamId !== '') {

          const oldIds = (this.previousData.members ?? []).map((m: any) => Number(m.interviewerId));

          const idsToAdd = newIds.filter((id: number) => !oldIds.includes(id));
          const idsToRemove = oldIds.filter((id: number) => !newIds.includes(id));

          const addRequests = idsToAdd.map((id: number) =>
            this.interviewerService.addTeamMember(this.teamId, id)
          );
          const removeRequests = idsToRemove.map((id: number) =>
            this.interviewerService.removeTeamMember(this.teamId, id)
          );

          const allRequests = [...addRequests, ...removeRequests];

          if (allRequests.length) {
            forkJoin(allRequests).subscribe({
              next: () => {
                console.log('อัปเดตสมาชิกทีมเรียบร้อย');
              },
              error: (err) => {
                console.error('อัปเดตสมาชิกล้มเหลว', err);
              }
            });
          }

          this.interviewerService.updateTeam(this.teamId, payload).subscribe({
            next: () => {
              this.isEditing = false;
              this.formDetails.disable({ emitEvent: false });
              this.initialSnapshot = this.buildSnapshot();
              this.nextTick(() => this.setActionButtons('view'));
              this.clearDraftsForCurrentType();
            },
            error: (err) => {
              this.notificationService.error(err.error?.error?.errors?.teamName || 'Update failed.');
            }
          });
        } else {
          const filteredInterviewers = this.settingInterviewer.filter(i => newIds.includes(i.idEmployee));

          const payloadCreate: InterviewerDetails = {
            teamName: formValue.teamName ?? previousData.teamName ?? '',
            interviewerIds: newIds,
          };

          this.interviewerService.createTeam(payloadCreate).subscribe({
            next: () => {
              this.isEditing = false;
              this.formDetails.disable({ emitEvent: false });
              this.initialSnapshot = this.buildSnapshot();
              this.nextTick(() => this.setActionButtons('view'));
              this.clearDraftsForCurrentType();
            },
            error: (err) => {
              this.notificationService.error(err.error?.error?.errors?.teamName || 'Create failed.');
            }
          });
        }

      }
    });

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
      this.detailsFA.at(idx).patchValue({ isActive: e.checked });
      e.checkbox.checked = e.checked;
    }
  }

  get categoriesFA() {
    return this.formDetails.get('categories') as any;
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

  private buildCachePayload(): InterviewerCache {
    const f = this.formDetails.getRawValue();

    return {
      form: {
        teamName: f.teamName ?? '',
        isActive: !!f.isActive,
      },
      selections: {
        selectedIdsInterviewer: this.toNumArr(this.formDetails.get('selectedIdsInterviewer')?.value),
      },
      isEditing: this.isEditing,
      ts: Date.now(),
    };
  }

  private saveCache(): void {
    if (!this.formDetails || !this.initialSnapshot) return;
    if (this.hasFormChanged()) {
      const cache = this.buildCachePayload();
      sessionStorage.setItem(this.cacheKey(), JSON.stringify(cache));
    }
  }

  private restoreFromCacheIfAny(): boolean {
    const raw = sessionStorage.getItem(this.cacheKey());
    if (!raw) return false;

    try {
      const cache = JSON.parse(raw) as InterviewerCache;

      // form fields
      this.formDetails.patchValue(cache.form, { emitEvent: false });

      // selections
      setTimeout(() => {
        this.formDetails.get('selectedIdsInterviewer')?.setValue(cache.selections.selectedIdsInterviewer ?? [], { emitEvent: false });

        this.isEditing = true;
        this.setActionButtons('edit');
        this.disabledKeys = [];
        this.isEditing ? this.formDetails.enable({ emitEvent: false }) : this.formDetails.disable({ emitEvent: false });
      })

      this.reemitControl('selectedIdsInterviewer');

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