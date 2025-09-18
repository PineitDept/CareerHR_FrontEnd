import { Component, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Columns } from '../../../../../../../../shared/interfaces/tables/column.interface';
import { TablesComponent } from '../../../../../../../../shared/components/tables/tables.component';
import { ActivatedRoute } from '@angular/router';
import { ScoreService } from '../../../../../../../../services/score/score.service';
import { MatDialog } from '@angular/material/dialog';
import { NotificationService } from '../../../../../../../../shared/services/notification/notification.service';
import { CaptchaDialogComponent } from '../../../../../../../../shared/components/dialogs/captcha-dialog/captcha-dialog.component';
import { Subject, takeUntil } from 'rxjs';

type ScoreItem = {
  id: number | null;
  condition: string;        // server: condition (string number)
  conditionDetail: string;  // server: conditionDetail -> ใช้แสดงในคอลัมน์ "Condition"
  score: number;            // server: score
  activeStatus: boolean;    // map จาก isActive (Boolean ตรง ๆ)
  isDelete: boolean;        // ควบคุมการแสดงปุ่ม Delete
  // เกณฑ์ที่ถูกต้อง: true = อนุญาต toggle, false = ไม่อนุญาต
  isDisable: boolean;
};

@Component({
  selector: 'app-score-details',
  templateUrl: './score-details.component.html',
  styleUrl: './score-details.component.scss'
})
export class ScoreDetailsComponent {
  @ViewChild('scoreDetailsTable') scoreDetailsTable!: TablesComponent;

  filterButtons: { label: string; key: string; color: string }[] = [];
  disabledKeys: string[] = [];

  scoreType: number = 0;
  scoreName: string = '';
  formDetails!: FormGroup;

  // ค่าเริ่มต้นของคอลัมน์ Action ให้มีเฉพาะ 'edit-inrow'
  scoreDetailsColumns: Columns = [
    { header: 'No.', field: '__index', type: 'number', align: 'center', width: '7%' },
    { header: 'Condition', field: 'conditionDetail', type: 'text', width: '56%', wrapText: true },
    { header: 'Score', field: 'score', type: 'number', align: 'center', width: '12%' },
    { header: 'Status', field: 'activeStatus', type: 'toggle', align: 'center', width: '7%' },
    { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '18%', textlinkActions: ['edit-inrow'], useRowTextlinkActions: true }
  ];

  scoreDetailsRows: any[] = [];

  isEditMode = false;        // เปิดแก้ไขเมื่อกด Edit
  isViewingRevision = false; // true เมื่อดูข้อมูลย้อนหลังตาม revision

  isAddingRow = false;
  fieldErrors = false;
  duplicateRowIndex: number | null = null;

  detailsRequiredFooterFields: string[] = ['conditionDetail','score'];

  /*** Revision History state ***/
  revisionOptions: number[] = [];
  currentRevision: number = 1;         // เลข revision ที่กำลังดู
  private _latestRevision: number = 1; // จำ revision ล่าสุดจาก server

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private scoreService: ScoreService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private notify: NotificationService,
  ) { }

  // ======= Getters =======
  get scoreSettingsFA(): FormArray { return this.formDetails.get('scoreSettings') as FormArray; }

  /** แสดงปุ่ม Add Condition เฉพาะเมื่อ scoreType เป็น 8 หรือ 9 */
  get canShowAddButton(): boolean {
    return this.scoreType === 8 || this.scoreType === 9;
  }

  ngOnInit() {
    this.initializeForm();
    this.ensureFilterButtons();

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.scoreName = (params['scoreName'] || '').split('-').join(' ');
        this.scoreType = Number(params['scoreType'] || 0);

        this.formDetails.patchValue({ scoreName: this.scoreName }, { emitEvent: false });
        this.fetchScoreSettingDetailsByType();
      });
  }

  initializeForm() {
    this.formDetails = this.fb.group({
      scoreName: [{ value: this.scoreName, disabled: true }],
      // ใช้ชื่อ array เป็น scoreSettings ตามที่กำหนด
      scoreSettings: this.fb.array([]),
    });
  }

  private ensureFilterButtons() {
    if (this.isEditMode) {
      this.filterButtons = [{ label: 'Save', key: 'save', color: '#000055' }];
      this.setSaveEnabled(this.hasChanges());
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

  // ======= Mapping helpers =======
  private clearFormArrayQuietly(fa: FormArray) {
    for (let i = fa.length - 1; i >= 0; i--) fa.removeAt(i, { emitEvent: false });
  }

  private buildFG(item: ScoreItem): FormGroup {
    return this.fb.group({
      id: [item.id],
      condition: [item.condition],
      conditionDetail: [item.conditionDetail],
      score: [item.score],
      activeStatus: [item.activeStatus],
      isDelete: [item.isDelete],
      isDisable: [item.isDisable], // true = อนุญาต toggle
    });
  }

  private rebuildRowsFromForm() {
    const arr = this.scoreSettingsFA.getRawValue() as ScoreItem[];

    this.scoreDetailsRows = arr.map((it) => {
      // default ต้องมี edit เสมอ
      const actions = new Set<string>(['edit-inrow']);

      // แสดง delete เฉพาะเมื่อ isDelete = true
      if (it.isDelete) actions.add('delete');

      return {
        id: it.id,
        condition: it.condition,
        conditionDetail: it.conditionDetail,
        score: it.score,
        activeStatus: !!it.activeStatus,
        isDelete: !!it.isDelete,
        isDisable: !!it.isDisable,
        textlinkActions: Array.from(actions), // ใช้ action จากแถว
      };
    });
  }

  private mapServerToItems(resp: any): ScoreItem[] {
    const list = Array.isArray(resp?.scoreSettings) ? resp.scoreSettings : [];
    const items: ScoreItem[] = list.map((s: any) => ({
      id: Number.isFinite(Number(s?.id)) ? Number(s.id) : null,
      condition: String(s?.condition ?? ''),
      conditionDetail: String(s?.conditionDetail ?? '').trim(),
      score: Number(s?.score ?? 0) || 0,
      activeStatus: !!s?.isActive,     // isActive เป็น boolean อยู่แล้ว
      isDelete: !!s?.isDelete,         // ควบคุมปุ่ม Delete
      isDisable: !!s?.isDisable,       // true = อนุญาต toggle, false = ไม่อนุญาต
    }));

    // เรียงตาม condition (numeric) -> id
    items.sort((a, b) =>
      (Number(a.condition) || 0) - (Number(b.condition) || 0) ||
      (Number(a.id) || 0) - (Number(b.id) || 0)
    );

    return items;
  }

  // ======= Data load =======
  fetchScoreSettingDetailsByType() {
    this.scoreService.getScoreSettingDetailsByType(this.scoreType).subscribe({
      next: (response) => {
        // divisionId = เลข revision ล่าสุด
        const latest = Number(response?.divisionId) || 1;
        this._latestRevision = Math.max(1, latest);
        this.revisionOptions = Array.from({ length: this._latestRevision }, (_, i) => i + 1);
        this.currentRevision = this._latestRevision; // แสดง revision ล่าสุดเสมอ

        const items = this.mapServerToItems(response);
        this.clearFormArrayQuietly(this.scoreSettingsFA);
        items.forEach(it => this.scoreSettingsFA.push(this.buildFG(it), { emitEvent: false }));
        this.rebuildRowsFromForm();

        // โหมดอ่าน (disabled) เมื่อไม่ได้กด Edit
        this.isViewingRevision = false;
        this.isEditMode = false;
        this.ensureFilterButtons();
      },
      error: (error) => {
        console.error('Error fetching score details by type:', error);
        this.isEditMode = false;
        this.ensureFilterButtons();
      },
    });
  }

  // ======= Toolbar actions =======
  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit': this.onEditClicked(); break;
      case 'save': this.onSaveClicked(); break;
    }
  }

  onEditClicked() {
    // อนุญาตแก้ไขได้เฉพาะขณะดู revision ล่าสุด
    if (this.currentRevision !== this._latestRevision) {
      this.notify.warn('กรุณาเลือก Revision ล่าสุดก่อนทำการแก้ไข');
      return;
    }
    this.isEditMode = true;
    this.isViewingRevision = false;
    this.ensureFilterButtons();
  }

  onSaveClicked() {
    if (!this.hasChanges()) return;

    // TODO: เมื่อ backend พร้อมใช้งาน ให้เรียก service บันทึกจริง
    const payload = this.buildSavePayload();
    console.log('ScoreSetting SAVE payload =>', payload);
    this.notify.success('บันทึกชั่วคราว (เดโม่): ส่ง payload ดูใน console');

    // ตัวอย่าง:
    // this.scoreService.saveScoreSettingDetails(payload).subscribe({
    //   next: () => { this.notify.success('บันทึกสำเร็จ'); this.fetchScoreSettingDetailsByType(); },
    //   error: (err) => this.notify.error(err?.error?.message || err?.message || 'บันทึกไม่สำเร็จ')
    // });

    this.isEditMode = false;
    this.ensureFilterButtons();
  }

  // ======= Inline row create/edit/delete =======
  onAddConditionClicked() {
    if (!this.isEditMode || !this.canShowAddButton) return;
    this.isAddingRow = true;
    this.scoreDetailsTable.startInlineCreate({ activeStatus: true }, 'bottom');
  }

  onInlineSave(payload: any) {
    if (!this.isEditMode) { this.isAddingRow = false; return; }

    const normalized: ScoreItem = {
      id: null,
      condition: String(payload?.condition ?? ''),
      conditionDetail: String(payload?.conditionDetail ?? '').trim(),
      score: Number(payload?.score ?? 0) || 0,
      activeStatus: !!(payload?.activeStatus ?? (payload?.status === 1)),
      isDelete: true,     // แถวใหม่ให้ลบได้ (ปรับ rule ได้)
      isDisable: true,    // true = อนุญาต toggle (ตั้ง default ให้แก้ได้)
    };

    this.scoreSettingsFA.push(this.buildFG(normalized), { emitEvent: false });
    this.rebuildRowsFromForm();
    this.isAddingRow = false;
    this.touchChanged();
  }

  onInlineEditSave(updatedRow: any) {
    if (!this.isEditMode) return;

    const idx = this.findIndexByRow(updatedRow);
    if (idx < 0) return;

    const patch: Partial<ScoreItem> = {
      condition: String(updatedRow?.condition ?? ''),
      conditionDetail: String(updatedRow?.conditionDetail ?? '').trim(),
      score: Number(updatedRow?.score ?? 0) || 0,
      activeStatus: !!(updatedRow?.activeStatus ?? (updatedRow?.status === 1)),
    };

    this.scoreSettingsFA.at(idx).patchValue(patch, { emitEvent: false });
    this.rebuildRowsFromForm();
    this.touchChanged();
  }

  onInlineCancel() {
    this.isAddingRow = false;
    this.fieldErrors = false;
  }

  onDeleteRowClicked(row: any) {
    if (!this.isEditMode) return;

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

      const idx = this.findIndexByRow(row);
      if (idx < 0) return;

      this.scoreSettingsFA.removeAt(idx);
      this.rebuildRowsFromForm();
      this.touchChanged();
    });
  }

  private findIndexByRow(row: any): number {
    const arr = this.scoreSettingsFA.getRawValue() as ScoreItem[];
    // map โดยใช้ id ก่อน ถ้าไม่มีค่อย fallback ด้วย condition + conditionDetail + score
    if (row?.id != null) {
      const byId = arr.findIndex((it) => it.id === row.id);
      if (byId > -1) return byId;
    }
    const cond = String(row?.condition ?? '');
    const label = String(row?.conditionDetail ?? '').trim();
    const sc = Number(row?.score ?? 0) || 0;
    return arr.findIndex(it => it.condition === cond && it.conditionDetail === label && (Number(it.score)||0) === sc);
  }

  // ======= Toggle (เกณฑ์ isDisable: true = อนุญาต, false = ไม่อนุญาต) =======
  onToggleChangeDetails(e: { row: any; checked: boolean; checkbox: HTMLInputElement }) {
    // ต้องอยู่ในโหมดแก้ไขก่อน
    if (!this.isEditMode) {
      e.checkbox.checked = !!e.row.activeStatus;
      this.notify.warn('กรุณากด Edit ก่อนแก้ไขสถานะ');
      return;
    }

    const idx = this.findIndexByRow(e.row);
    if (idx < 0) return;

    // เกณฑ์ถูกต้อง: isDisable=true -> อนุญาต, isDisable=false -> ไม่อนุญาต
    const allowToggle = !!e.row?.isDisable;
    if (!allowToggle) {
      e.checkbox.checked = !!e.row.activeStatus; // revert กลับ
      this.notify.warn('เงื่อนไขนี้ไม่สามารถแก้ไข Active/Inactive ได้');
      return;
    }

    // อนุญาต: อัปเดตค่าใน FormArray และ rows
    this.scoreSettingsFA.at(idx).patchValue({ activeStatus: !!e.checked }, { emitEvent: false });
    this.rebuildRowsFromForm();
    this.touchChanged();
  }

  // ======= Revision footer =======
  onRevisionChange(val: string | number) {
    const requested = Number(val);
    if (!Number.isFinite(requested) || requested < 1) return;

    // ถ้าเป็น revision ล่าสุด -> โหลดล่าสุดและพร้อมแก้ไข (เมื่อกด Edit)
    if (requested === this._latestRevision) {
      this.isViewingRevision = false;
      this.fetchScoreSettingDetailsByType();
      return;
    }

    // ดูย้อนหลัง -> ปิดโหมดแก้ไข และโหลดข้อมูลตาม revision ที่เลือก
    this.isEditMode = false;
    this.isViewingRevision = true;
    this.ensureFilterButtons();

    this.loadRevisionSnapshot(requested);
  }

  private loadRevisionSnapshot(revisionId: number) {
    // หมายเหตุ: endpoint ตัวอย่าง — ปรับตาม backend จริงหาก path ต่างออกไป
    this.scoreService.getRevisionScoreSettingDetailsByType(this.scoreType, revisionId).subscribe({
      next: (resp) => {
        const items = this.mapServerToItems(resp);
        this.clearFormArrayQuietly(this.scoreSettingsFA);
        items.forEach(it => this.scoreSettingsFA.push(this.buildFG(it), { emitEvent: false }));
        this.rebuildRowsFromForm();
        this.currentRevision = revisionId;
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Cannot load this revision.';
        this.notify.error(msg);
      }
    });
  }

  // ======= Save helpers =======
  private hasChanges(): boolean {
    // เวอร์ชันเบา: ถือว่ามีการเปลี่ยนเมื่อเข้าระยะ Edit (ถ้าต้องการ exact diff ค่อยเพิ่ม baseline)
    return this.isEditMode;
  }

  private touchChanged() { this.setSaveEnabled(true); }

  private buildSavePayload() {
    const rows = this.scoreSettingsFA.getRawValue() as ScoreItem[];

    // ตัวอย่าง payload (ปรับตามสัญญา API จริงเมื่อเปิดใช้งาน save)
    return {
      type: this.scoreType,
      scoreName: this.scoreName,
      items: rows.map((r, idx) => ({
        id: r.id,
        condition: r.condition,             // code เงื่อนไข (string/number)
        conditionDetail: r.conditionDetail, // label สำหรับแสดง
        score: Number(r.score) || 0,
        isActive: !!r.activeStatus,
        isDelete: !!r.isDelete,             // เผื่อ backend ต้องการรู้สิทธิ์
        isDisable: !!r.isDisable,           // ส่งตาม semantics ที่ถูกต้อง
        sort: idx + 1,
        isDeleted: false,
      }))
    };
  }

  // ======= Cleanup =======
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
