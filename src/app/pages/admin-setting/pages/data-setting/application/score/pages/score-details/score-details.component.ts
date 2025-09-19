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
import { UniversityPickerDialogComponent } from '../../../../../../../../shared/components/dialogs/university-picker-dialog/university-picker-dialog.component';

type ScoreItem = {
  id: number | null;
  tempId?: string | null;     // ใช้ระบุตัวตนชั่วคราวตอน id=null
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

  private readonly CONDITION_PREFIX_MAP: Record<number, string> = {
    3: '≥ ',
    8: 'Score EQ > ',
    9: 'Score Ethics > ',
  };

  inlineFieldErrors: Record<string, boolean> = {};

  private readonly GRADE_OPTIONS = [
    { key: 1, label: 'Candidate Grade A to Pass' },
    { key: 2, label: 'Candidate Grade B to Pass' },
    { key: 3, label: 'Candidate Grade C to Pass' },
    { key: 4, label: 'Candidate Grade D to Pass' },
    { key: 5, label: 'Candidate Grade F to Pass' },
  ];

  constructor(
    private route: ActivatedRoute,
    private scoreService: ScoreService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private notify: NotificationService,
  ) { }

  // ======= Getters =======
  get scoreSettingsFA(): FormArray { return this.formDetails.get('scoreSettings') as FormArray; }

  /** แสดงปุ่ม Add Condition เฉพาะเมื่อ scoreType เป็น 3, 8 หรือ 9 */
  get canShowAddButton(): boolean {
    return  this.scoreType === 3 || this.scoreType === 8 || this.scoreType === 9;
  }

  // ใช้กับ <app-tables> เพื่อให้ render prefix lock
  get conditionLockedCfg() {
    const prefix = this.CONDITION_PREFIX_MAP[this.scoreType];
    return prefix ? { field: 'conditionDetail', prefix } : null;
  }

  ngOnInit() {
    this.initializeForm();
    this.ensureFilterButtons();

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.scoreName = (params['scoreName'] || '').split('-').join(' ');
        this.scoreType = Number(params['scoreType'] || 0);

        this.setupColumnsByType();

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

  private setupColumnsByType() {
    if (this.scoreType === 3) {
      this.scoreDetailsColumns = [
        { header: 'University', field: 'universityName', type: 'text', width: '25%', wrapText: true, editing: false, align: 'center' }, // merge
        { header: 'GPA Condition', field: 'conditionDetail', type: 'text', width: '30%', wrapText: true, editing: true, align: 'center' },
        { header: 'Score', field: 'score', type: 'number', align: 'center', width: '12%' },
        { header: 'Status', field: 'activeStatus', type: 'toggle', align: 'center', width: '7%' },
        { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '18%', textlinkActions: ['edit-inrow'], useRowTextlinkActions: true },
      ];
    } else if (this.scoreType === 10) {
      this.scoreDetailsColumns = [
        { header: 'No.', field: '__index', type: 'number', align: 'center', width: '8%' },
        // Condition เป็น select (ใช้ dropdown overlay ของ TablesComponent)
        {
          header: 'Condition',
          field: 'conditionDetail',
          type: 'select',
          width: '54%',
          align: 'left',
          options: this.GRADE_OPTIONS.map(o => o.label), // แสดง label
        },
        { header: 'Score', field: 'score', type: 'number', align: 'center', width: '12%' },
        { header: 'Status', field: 'activeStatus', type: 'toggle', align: 'center', width: '8%' },
        { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '18%', textlinkActions: ['edit-inrow'], useRowTextlinkActions: true },
      ];
    } else if ([4,5,6,7].includes(this.scoreType)) {
      this.scoreDetailsColumns = [
        { header: 'No.', field: '__index', type: 'number', align: 'center', width: '7%', editing: false },
        { header: 'Condition', field: 'conditionDetail', type: 'text', width: '56%', wrapText: true, editing: false },
        { header: 'Score', field: 'score', type: 'number', align: 'center', width: '12%', editing: true },
        { header: 'Status', field: 'activeStatus', type: 'toggle', align: 'center', width: '7%', /* toggle คุมที่ parent อยู่แล้ว */ },
        { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '18%', textlinkActions: ['edit-inrow'], useRowTextlinkActions: true },
      ];
    } else {
      // เดิม (type อื่น)
      this.scoreDetailsColumns = [
        { header: 'No.', field: '__index', type: 'number', align: 'center', width: '7%' },
        { header: 'Condition', field: 'conditionDetail', type: 'text', width: '56%', wrapText: true },
        { header: 'Score', field: 'score', type: 'number', align: 'center', width: '12%' },
        { header: 'Status', field: 'activeStatus', type: 'toggle', align: 'center', width: '7%' },
        { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '18%', textlinkActions: ['edit-inrow'], useRowTextlinkActions: true }
      ];
    }
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
      tempId: [item.tempId ?? null],
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

    if (this.scoreType === 3) {
      const prefix = this.CONDITION_PREFIX_MAP[3] || '≥ ';
      const isZero = (v: any) => {
        // รองรับ '0', '0.0', 0, '0.00 ' ฯลฯ แต่ไม่ถือ '' / null เป็นศูนย์
        if (v === '' || v === null || v === undefined) return false;
        const n = Number(String(v).trim());
        return Number.isFinite(n) && n === 0;
      };

      this.scoreDetailsRows = arr.map((it) => {
        const actions = new Set<string>(['edit-inrow']);
        if (it.isDelete) actions.add('delete');

        // ซ่อน Edit เฉพาะแถว GPA=0 และ Score=0
        const hideEdit = isZero(it.condition) && isZero(it.score);
        if (hideEdit) actions.delete('edit-inrow');

        return {
          id: it.id,
          tempId: it.tempId ?? null,
          universityName: it.conditionDetail,
          condition: it.condition,
          conditionDetail: `${prefix}${it.condition}`,
          score: it.score,
          activeStatus: !!it.activeStatus,
          isDelete: !!it.isDelete,
          isDisable: !!it.isDisable,
          // 👇 จุดชี้ขาด: ให้ตารางอ่าน action จากแถวนี้จริง ๆ
          textlinkActions: Array.from(actions),
        };
      });
      return;
    }

    if (this.scoreType === 10) {
      this.scoreDetailsRows = arr.map((it) => {
        const actions = new Set<string>(['edit-inrow']);
        if (it.isDelete) actions.add('delete');

        // แสดง label ตาม score (1-5) หาก conditionDetail ว่าง
        const s = Number(it.score) || 0;
        const label = it.conditionDetail?.trim()
          ? it.conditionDetail.trim()
          : (s >= 1 && s <= 5 ? this.gradeLabelByKey(s) : '');

        return {
          id: it.id,
          tempId: it.tempId ?? null,
          condition: it.condition,             // ไม่ได้ใช้ใน type 10 แต่คงไว้
          conditionDetail: label,              // แสดง label
          score: s,                            // 1..5
          activeStatus: !!it.activeStatus,
          isDelete: !!it.isDelete,
          isDisable: !!it.isDisable,
          textlinkActions: Array.from(actions),
        };
      });
      return;
    }

    if (this.scoreType === 8 || this.scoreType === 9) {
      this.scoreDetailsRows = arr.map((it) => {
        const actions = new Set<string>(['edit-inrow']);
        if (it.isDelete) actions.add('delete');

        // อ่านค่าตัวเลขจาก conditionDetail ที่มี prefix ("Score EQ > " หรือ "Score Ethics > ")
        const condNum = this.extractConditionNumber(String(it.conditionDetail ?? ''), /*forcePrefix*/ false);
        const isZeroCond = condNum !== null && condNum === 0;
        const isZeroScore = (Number(it.score) || 0) === 0;

        // ถ้าเงื่อนไข=0 และ score=0 -> ซ่อน Edit
        if (isZeroCond && isZeroScore) {
          actions.delete('edit-inrow');
        }

        return {
          id: it.id,
          tempId: it.tempId ?? null,
          condition: it.condition,                 // เก็บไว้ตามเดิม
          conditionDetail: it.conditionDetail,     // แสดง label เดิม (มี prefix)
          score: Number(it.score) || 0,
          activeStatus: !!it.activeStatus,
          isDelete: !!it.isDelete,
          isDisable: !!it.isDisable,
          textlinkActions: Array.from(actions),
        };
      });
      return;
    }

    // ---------- ของเดิมสำหรับ type อื่น ----------
    this.scoreDetailsRows = arr.map((it) => {
      const actions = new Set<string>(['edit-inrow']);
      if (it.isDelete) actions.add('delete');
      return {
        id: it.id,
        tempId: it.tempId ?? null,
        condition: it.condition,
        conditionDetail: it.conditionDetail,
        score: it.score,
        activeStatus: !!it.activeStatus,
        isDelete: !!it.isDelete,
        isDisable: !!it.isDisable,
        textlinkActions: Array.from(actions),
      };
    });
  }

  private mapServerToItems(resp: any): ScoreItem[] {
    const list = Array.isArray(resp?.scoreSettings) ? resp.scoreSettings : [];

    const items: ScoreItem[] = list.map((s: any) => {
      const base: ScoreItem = {
        id: Number.isFinite(Number(s?.id)) ? Number(s.id) : null,
        tempId: null,
        condition: String(s?.condition ?? ''),        // ค่าตัวเลขจริง (string)
        conditionDetail: String(s?.conditionDetail ?? '').trim(), // เดิม = label
        score: Number(s?.score ?? 0) || 0,
        activeStatus: !!s?.isActive,
        isDelete: !!s?.isDelete,
        isDisable: !!s?.isDisable,
      };
      return base;
    });

    // ✅ type 3: preserve order ตาม API
    if (this.scoreType !== 3) {
      items.sort((a, b) =>
        (Number(a.condition) || 0) - (Number(b.condition) || 0) ||
        (Number(a.id) || 0) - (Number(b.id) || 0)
      );
    }

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

    if (this.scoreType === 3) {
      const items = this.scoreSettingsFA.getRawValue() as ScoreItem[];
      const universities = Array.from(
        new Set(items.map(it => String(it.conditionDetail || '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      const dialogRef = this.dialog.open(UniversityPickerDialogComponent, {
        width: '520px',
        panelClass: 'custom-dialog-container',
        disableClose: true,
        data: { universities },
      });

      dialogRef.afterClosed().subscribe((selected: string | null) => {
        if (!selected) return;

        const newItem: ScoreItem = {
          id: null,
          tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          condition: '',
          conditionDetail: selected,
          score: 0,
          activeStatus: true,
          isDelete: true,
          isDisable: true,
        };

        const items = this.scoreSettingsFA.getRawValue() as ScoreItem[];

        // หา index ที่จะแทรก
        const lastIdxOfUni = (() => {
          let idx = -1;
          for (let i = 0; i < items.length; i++) {
            if ((items[i]?.conditionDetail || '').trim() === selected.trim()) {
              idx = i;
            }
          }
          return idx;
        })();

        let insertAt: number;
        if (lastIdxOfUni === -1) {
          insertAt = items.length;
          for (let i = 0; i < items.length; i++) {
            const name = String(items[i].conditionDetail || '');
            if (selected.localeCompare(name) < 0) { insertAt = i; break; }
          }
          this.scoreSettingsFA.insert(insertAt, this.buildFG(newItem), { emitEvent: false });
        } else {
          insertAt = lastIdxOfUni + 1;
          this.scoreSettingsFA.insert(insertAt, this.buildFG(newItem), { emitEvent: false });
        }

        // rebuild แล้วเปิด inline-edit ที่ตำแหน่งแทรกทันที
        this.rebuildRowsFromForm();
        this.touchChanged();

        // ให้แน่ใจว่า view อัปเดตแล้วค่อยสั่งเปิด edit
        setTimeout(() => {
          this.scoreDetailsTable?.openInlineEditAt(insertAt);
        });
      });

      return;
    }

    // type อื่น ๆ (เดิม)
    this.isAddingRow = true;
    this.scoreDetailsTable.startInlineCreate({ activeStatus: true }, 'bottom');
  }

  onInlineSave(payload: any) {
    if (!this.isEditMode) { this.isAddingRow = false; return; }

    // === รองรับ type=3 ให้เช็คเหมือน onInlineEditSave / onInlineSaveAttempt ===
    if (this.scoreType === 3) {
      // payload.conditionDetail จะเป็น "≥ x.xx" (จาก input-affix)
      const num = this.extractConditionNumber(String(payload?.conditionDetail ?? ''), /*forcePrefix*/ true);
      const valid = num !== null && num >= 0 && num <= 4;

      if (!valid) {
        this.fieldErrors = true;
        this.inlineFieldErrors = { conditionDetail: true };
        this.notify.error('GPA ต้องอยู่ระหว่าง 0.00 – 4.00');
        return;
      }

      // หา index ของ "แถวใหม่" ล่าสุด เพื่อระบุ university (จากฟอร์ม)
      // ปกติกรณี type=3 เราเพิ่มแถวใน FormArray ไปก่อนแล้ว (ตอนเลือกมหาลัย) แล้วค่อยเปิดแก้ไข
      // ตรงนี้ therefore ให้ map จาก rows -> index ปัจจุบันที่กำลัง save โดยจับ tempId หากมี
      const uniName = String(payload?.universityName ?? '').trim();
      const skipIdx = (() => {
        const idx = this.findIndexByRow(payload);
        return idx >= 0 ? idx : undefined;
      })();

      const dupIdx = this.findDuplicateGpaIndexWithinUniversity(uniName, num!, skipIdx);
      if (dupIdx !== -1) {
        this.fieldErrors = true;
        this.inlineFieldErrors = { conditionDetail: true };
        this.duplicateRowIndex = dupIdx;
        this.notify.error(`GPA ซ้ำกับแถวที่ ${dupIdx + 1} ของ "${uniName}"`);
        return;
      }

      // ผ่าน: อัปเดตค่าในฟอร์ม (condition = ตัวเลขจริง, เก็บ label มหาลัยเดิมใน conditionDetail)
      const idx = this.findIndexByRow(payload);
      if (idx >= 0) {
        const curr = this.scoreSettingsFA.at(idx).getRawValue() as ScoreItem;
        this.scoreSettingsFA.at(idx).patchValue({
          condition: String(num),
          score: Number(payload?.score ?? curr.score) || 0,
          activeStatus: !!(payload?.activeStatus ?? curr.activeStatus),
        }, { emitEvent: false });

        this.rebuildRowsFromForm();
        this.touchChanged();
      }

      // ปิดโหมด add + ให้ตารางรีเซ็ตเป็นปุ่ม Edit/Delete
      this.isAddingRow = false;
      // ตารางของคุณจะปิดอินไลน์ในฝั่ง self เมื่อ parent เปลี่ยน rows; ถ้าจำเป็น เรียก:
      this.scoreDetailsTable?.commitInlineSave?.();

      return;
    }
    // === END (type=3) ===

    // ====== เดิม (type อื่น) ======
    if (this.scoreType === 8) {
      const num = this.extractConditionNumber(String(payload?.conditionDetail ?? ''));
      if (num == null) {
        this.fieldErrors = true;
        this.notify.warn('กรุณากรอกตัวเลขหลัง "Score EQ > "');
        return;
      }
      const dupIdx = this.findDuplicateIndexByNumber(num);
      if (dupIdx !== -1) {
        this.fieldErrors = true;
        this.duplicateRowIndex = dupIdx;
        this.notify.error(`ค่าเงื่อนไขซ้ำกับแถวที่ ${dupIdx + 1}`);
        return;
      }
    }

    if (this.scoreType === 10) {
      // รับจาก footerRow (ถ้าเปิด isAddMode) หรือจาก inline create
      const label = String(payload?.conditionDetail ?? '').trim();
      const key = this.gradeKeyByLabel(label);
      let s = Number(payload?.score);
      s = Number.isFinite(s) ? Math.trunc(s) : (key ?? 0);

      // อนุญาตให้เลือกผ่าน dropdown (label) หรือกรอก score (1..5) แล้ว map อีกฝั่งให้ตรง
      if (key == null && (s < 1 || s > 5)) {
        this.fieldErrors = true;
        this.inlineFieldErrors = { conditionDetail: !label, score: true };
        this.notify.error('กรุณาเลือก Condition (dropdown) หรือกรอก Score เป็นจำนวนเต็ม 1–5');
        return;
      }

      const finalScore = key ?? s;
      const finalLabel = key != null ? label : this.gradeLabelByKey(finalScore);

      const normalized: ScoreItem = {
        id: null,
        tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        condition: '',                    // not used for type 10
        conditionDetail: finalLabel,      // แสดง label
        score: finalScore,                // 1..5
        activeStatus: !!payload?.activeStatus,
        isDelete: true,
        isDisable: true,
      };

      this.scoreSettingsFA.push(this.buildFG(normalized), { emitEvent: false });
      this.rebuildRowsFromForm();
      this.isAddingRow = false;
      this.touchChanged();
      return;
    }

    const normalized: ScoreItem = {
      id: null,
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, // <— NEW: ให้แถวใหม่ type อื่นมี tempId ด้วย
      condition: String(payload?.condition ?? ''),
      conditionDetail: String(payload?.conditionDetail ?? '').trim(),
      score: Number(payload?.score ?? 0) || 0,
      activeStatus: !!(payload?.activeStatus ?? (payload?.status === 1)),
      isDelete: true,
      isDisable: true,
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

    // ---- แก้ได้เฉพาะ score สำหรับ type 4/5/6/7 ----
    if ([4,5,6,7].includes(this.scoreType)) {
      let s = Number(updatedRow?.score);
      if (!Number.isFinite(s)) s = 0;
      if (s < 0) s = 0;
      if (s > (this.scoreType === 10 ? 5 : 1)) {
        s = this.scoreType === 10 ? 5 : 1;
      }

      this.scoreSettingsFA.at(idx).patchValue(
        { score: s },
        { emitEvent: false }
      );

      this.rebuildRowsFromForm();
      this.touchChanged();
      return;
    }

    // ----- Validation เฉพาะ type=3 : GPA 0.00-4.00 -----
    if (this.scoreType === 3) {
      // ดึงเลขจาก conditionDetail ที่มี prefix "≥ "
      const num = this.extractConditionNumber(String(updatedRow?.conditionDetail ?? ''), /*forcePrefix*/ true);
      // เฉพาะช่วง 0..4
      const valid = num !== null && num >= 0 && num <= 4;
      if (!valid) {
        this.inlineFieldErrors = { conditionDetail: true };
        this.notify.error('GPA ต้องอยู่ระหว่าง 0.00 – 4.00');
        // revert กลับค่าเดิมจากฟอร์ม
        this.rebuildRowsFromForm();
        return;
      }
      this.inlineFieldErrors = {};

      // ปรับค่าในฟอร์ม: condition = ตัวเลขจริง, conditionDetail = label มหาลัยเดิม
      const curr = this.scoreSettingsFA.at(idx).getRawValue() as ScoreItem;
      const patch: Partial<ScoreItem> = {
        condition: String(num),
        // conditionDetail ของ type=3 คือ university label เดิม -> ไม่แตะ
        score: Number(updatedRow?.score ?? curr.score) || 0,
        activeStatus: !!(updatedRow?.activeStatus ?? curr.activeStatus),
      };
      this.scoreSettingsFA.at(idx).patchValue(patch, { emitEvent: false });
      this.rebuildRowsFromForm();
      this.touchChanged();
      return;
    }
    // -----------------------------------------------------

    // ----- กรณีพิเศษ type 10 -----
    if (this.scoreType === 10) {
      // ตรวจ score เป็นจำนวนเต็มบวก 1..5
      let s = Number(updatedRow?.score);
      if (!Number.isFinite(s)) s = 0;
      s = Math.trunc(s);
      if (s < 1 || s > 5) {
        this.inlineFieldErrors = { score: true };
        this.notify.error('Score ต้องเป็นจำนวนเต็มตั้งแต่ 1–5');
        this.rebuildRowsFromForm();
        return;
      }

      // map score -> label
      const label = this.gradeLabelByKey(s);
      if (!label) {
        this.inlineFieldErrors = { score: true };
        this.notify.error('ไม่พบตัวเลือกของ Score นี้');
        this.rebuildRowsFromForm();
        return;
      }

      // ปรับค่าในฟอร์ม (conditionDetail = label, score = key)
      const curr = this.scoreSettingsFA.at(idx).getRawValue() as ScoreItem;
      this.scoreSettingsFA.at(idx).patchValue({
        conditionDetail: label,
        score: s,
        activeStatus: !!(updatedRow?.activeStatus ?? curr.activeStatus),
      }, { emitEvent: false });

      this.inlineFieldErrors = {};
      this.rebuildRowsFromForm();
      this.touchChanged();
      return;
    }

    // ====== ของเดิมสำหรับ type อื่น ======
    if (this.scoreType === 8) {
      const num = this.extractConditionNumber(String(updatedRow?.conditionDetail ?? ''));
      if (num == null) {
        this.fieldErrors = true;
        this.notify.warn('กรุณากรอกตัวเลขหลัง "Score EQ > "');
        this.rebuildRowsFromForm();
        return;
      }
      const dupIdx = this.findDuplicateIndexByNumber(num, idx);
      if (dupIdx !== -1) {
        this.fieldErrors = true;
        this.duplicateRowIndex = dupIdx;
        this.notify.error(`ค่าเงื่อนไขซ้ำกับแถวที่ ${dupIdx + 1}`);
        this.rebuildRowsFromForm();
        return;
      }
    }

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

    // NEW: pre-check min-one rules for type 8/9
    if (this.isTypeWithMinOneRules()) {
      const total = this.getTotalRows();
      if (total <= 1) {
        this.notify.warn('ต้องเหลือข้อมูลอย่างน้อย 1 แถว ไม่สามารถลบแถวสุดท้ายได้');
        return;
      }

      const idx = this.findIndexByRow(row);
      if (idx < 0) return;

      const items = this.scoreSettingsFA.getRawValue() as ScoreItem[];
      const activeCount = items.filter(it => it.activeStatus).length;
      const rowIsActive = !!items[idx]?.activeStatus;

      // ถ้าจะลบแถวที่ active อยู่ และตอนนี้มี active เหลือแค่ 1 -> ห้ามลบ
      if (rowIsActive && activeCount <= 1) {
        this.notify.warn('ต้องมีอย่างน้อย 1 แถวที่ Active อยู่ ไม่สามารถลบแถวที่ Active แถวสุดท้ายได้');
        return;
      }
    }

    // ดำเนินการเปิดยืนยัน (ตามเดิม)
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

      // ป้องกัน race: ตรวจอีกครั้งหลังยืนยัน (เผื่อมี toggle/l ลบแถวอื่นระหว่าง dialog)
      if (this.isTypeWithMinOneRules()) {
        const total = this.getTotalRows();
        if (total <= 1) {
          this.notify.warn('ต้องเหลือข้อมูลอย่างน้อย 1 แถว ไม่สามารถลบแถวสุดท้ายได้');
          return;
        }

        const items = this.scoreSettingsFA.getRawValue() as ScoreItem[];
        const activeCount = items.filter(it => it.activeStatus).length;
        const rowIsActive = !!items[idx]?.activeStatus;

        if (rowIsActive && activeCount <= 1) {
          this.notify.warn('ต้องมีอย่างน้อย 1 แถวที่ Active อยู่ ไม่สามารถลบแถวที่ Active แถวสุดท้ายได้');
          return;
        }
      }

      // ลบได้
      this.scoreSettingsFA.removeAt(idx);
      this.rebuildRowsFromForm();
      this.touchChanged();
    });
  }

  onInlineCancelRow(row: any) {
    // เคลียร์สถานะ error/ไฮไลต์ทุกครั้งที่กด Cancel
    this.fieldErrors = false;
    this.inlineFieldErrors = {};       // ล้าง error รายฟิลด์ (เช่น conditionDetail)
    this.duplicateRowIndex = null;     // ยกเลิกแถวที่ถูกไฮไลต์

    if (this.scoreType !== 3) return;

    const idx = this.findIndexByRow(row);
    if (idx < 0) return;

    const item = this.scoreSettingsFA.at(idx).getRawValue() as ScoreItem;
    const isNewUnsaved =
      item.id == null &&
      !!item.tempId &&
      (item.condition == null || String(item.condition).trim() === '');

    if (isNewUnsaved) {
      this.scoreSettingsFA.removeAt(idx);   // ลบทิ้งทั้งแถว เพราะยังไม่เคย Save inline
      this.rebuildRowsFromForm();
      this.touchChanged();
    }
  }

  private findIndexByRow(row: any): number {
    const arr = this.scoreSettingsFA.getRawValue() as ScoreItem[];

    // 1) tempId ก่อน (แถวใหม่ยังไม่มี id)
    if (row?.tempId) {
      const byTmp = arr.findIndex((it) => it.tempId === row.tempId);
      if (byTmp > -1) return byTmp;
    }

    // 2) จากนั้นค่อยลอง id
    if (row?.id != null) {
      const byId = arr.findIndex((it) => it.id === row.id);
      if (byId > -1) return byId;
    }

    // 3) สุดท้าย fallback แบบเดิม
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

    // NEW: min-one rules for type 8/9
    if (this.isTypeWithMinOneRules()) {
      const total = this.getTotalRows();
      const activeCount = this.getActiveCount();
      const isCurrentlyActive = !!e.row.activeStatus;
      const wantActive = !!e.checked;

      // ห้ามปิด Active เมื่อเหลือแถวเดียว
      if (total === 1 && isCurrentlyActive && !wantActive) {
        e.checkbox.checked = true; // revert
        this.notify.warn('เหลือข้อมูลเพียง 1 แถว จึงต้องเป็น Active เสมอ');
        return;
      }

      // ห้ามปิด Active จนไม่เหลือแถว Active เลย
      if (isCurrentlyActive && !wantActive && activeCount <= 1) {
        e.checkbox.checked = true; // revert
        this.notify.warn('ต้องมีอย่างน้อย 1 แถวที่ Active อยู่ ไม่สามารถปิด Active ทั้งหมดได้');
        return;
      }
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

  // ดึงตัวเลขทศนิยมไม่ติดลบจาก conditionDetail
  private extractConditionNumber(text: string, forcePrefix = false): number | null {
    if (typeof text !== 'string') return null;
    let s = text.trim();
    const prefix = this.CONDITION_PREFIX_MAP[this.scoreType] ?? '';

    // ถ้าบังคับมี prefix (เช่น type 3) ให้ตัด prefix เท่านั้น
    if (prefix) {
      if (forcePrefix) {
        if (!s.startsWith(prefix)) return null;
        s = s.slice(prefix.length).trim();
      } else if (s.startsWith(prefix)) {
        s = s.slice(prefix.length).trim();
      }
    }

    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  // หา index ของแถวที่มีค่าซ้ำ (ข้าม index ที่กำลังแก้)
  private findDuplicateIndexByNumber(n: number, skipIndex?: number): number {
    const arr = (this.scoreSettingsFA.getRawValue() as ScoreItem[]) || [];
    for (let i = 0; i < arr.length; i++) {
      if (skipIndex != null && i === skipIndex) continue;
      const m = this.extractConditionNumber(arr[i]?.conditionDetail ?? '');
      if (m != null && m === n) return i;
    }
    return -1;
  }

  onInlineSaveAttempt(e: { draft: any; original: any }) {
    if (this.scoreType !== 3) {
      this.scoreDetailsTable.commitInlineSave();
      return;
    }

    // 1) แยกเลขจาก "≥ x.xx"
    const num = this.extractConditionNumber(String(e?.draft?.conditionDetail ?? ''), /*forcePrefix*/ true);
    const valid = num !== null && num >= 0 && num <= 4;

    if (!valid) {
      this.inlineFieldErrors = { conditionDetail: true };
      this.notify.error('GPA ต้องอยู่ระหว่าง 0.00 – 4.00');
      return;
    }

    // 2) กันซ้ำภายในมหาวิทยาลัยเดียวกัน
    const uniName = String(e?.original?.universityName ?? '').trim();
    const idx = this.findIndexByRow(e.original);
    const dupIdx = this.findDuplicateGpaIndexWithinUniversity(uniName, num!, idx);

    if (dupIdx !== -1) {
      this.inlineFieldErrors = { conditionDetail: true };
      this.duplicateRowIndex = dupIdx;
      this.notify.error(`GPA ซ้ำกับแถวที่ ${dupIdx + 1} ของ "${uniName}"`);
      return;
    }

    // 3) ผ่าน: เขียนกลับฟอร์ม แล้ว commit
    this.inlineFieldErrors = {};
    if (idx >= 0) {
      const curr = this.scoreSettingsFA.at(idx).getRawValue() as ScoreItem;
      this.scoreSettingsFA.at(idx).patchValue({
        condition: String(num),
        score: Number(e.draft?.score ?? curr.score) || 0,
        activeStatus: !!(e.draft?.activeStatus ?? curr.activeStatus),
      }, { emitEvent: false });
    }

    this.rebuildRowsFromForm();
    this.touchChanged();
    this.scoreDetailsTable.commitInlineSave(); // ปิด edit-inrow -> แสดง Edit/Delete
  }

  private findDuplicateGpaIndexWithinUniversity(
    universityName: string,
    gpa: number,
    skipIndex?: number
  ): number {
    const arr = (this.scoreSettingsFA.getRawValue() as ScoreItem[]) || [];
    for (let i = 0; i < arr.length; i++) {
      if (skipIndex != null && i === skipIndex) continue;
      const sameUni = String(arr[i]?.conditionDetail || '').trim() === String(universityName || '').trim();
      const g = Number(arr[i]?.condition);
      if (sameUni && Number.isFinite(g) && g === gpa) return i;
    }
    return -1;
  }

  // === helpers เฉพาะกฎ scoreType 8/9 ===
  private isTypeWithMinOneRules(): boolean {
    return this.scoreType === 8 || this.scoreType === 9;
  }

  private getTotalRows(): number {
    return this.scoreSettingsFA?.length ?? 0;
  }

  private getActiveCount(): number {
    const arr = (this.scoreSettingsFA.getRawValue() as ScoreItem[]) || [];
    return arr.reduce((acc, it) => acc + (it.activeStatus ? 1 : 0), 0);
  }

  private gradeLabelByKey(k: number): string {
    return this.GRADE_OPTIONS.find(o => o.key === k)?.label ?? '';
  }
  private gradeKeyByLabel(label: string): number | null {
    const f = this.GRADE_OPTIONS.find(o => o.label === label?.trim());
    return f ? f.key : null;
  }

  // map เมื่อเลือกค่าใน dropdown (TablesComponent -> selectChanged)
  onSelectChanged(e: { rowIndex: number; field: string; value: string }) {
    if (this.scoreType !== 10) return;
    if (e.field !== 'conditionDetail') return;

    const idx = e.rowIndex;
    const items = this.scoreSettingsFA.getRawValue() as ScoreItem[];
    if (idx < 0 || idx >= items.length) return;

    // แปลง label -> key (1..5) แล้ว map ไปที่ score
    const key = this.gradeKeyByLabel(e.value);
    if (key == null) return;

    this.scoreSettingsFA.at(idx).patchValue({
      conditionDetail: e.value,
      score: key,
    }, { emitEvent: false });

    this.rebuildRowsFromForm();
    this.touchChanged();
  }

  onInlineFieldCommit(e: { rowIndex: number; field: string; value: any }) {
    // ใช้เฉพาะกรณี type 10 + commit ของ field 'score'
    if (this.scoreType !== 10) return;
    if (!e || e.rowIndex == null || e.rowIndex < 0) return;
    if (e.field !== 'score') return;

    // บังคับให้เป็นจำนวนเต็ม 1..5
    let s = Number(e.value);
    if (!Number.isFinite(s)) s = 0;
    s = Math.trunc(s);
    if (s < 1) s = 1;
    if (s > 5) s = 5;

    // หา label ให้ตรงกับ score
    const label = this.gradeLabelByKey(s);
    if (!label) {
      // ถ้าไม่เจอ label (ไม่น่าจะเกิด) — กันพลาด: ไม่อัปเดตอะไร แต่แจ้งเตือนเบา ๆ
      this.notify.warn('ไม่พบตัวเลือกที่ตรงกับคะแนนที่กรอก');
      return;
    }

    // อัปเดต FormArray แถวที่กำลังแก้ไขอยู่
    const items = this.scoreSettingsFA.getRawValue() as ScoreItem[];
    if (e.rowIndex >= items.length) return;

    this.scoreSettingsFA.at(e.rowIndex).patchValue({
      conditionDetail: label,
      score: s,
    }, { emitEvent: false });

    // รีบิลด์แถวในตารางและเปิดปุ่ม Save
    this.rebuildRowsFromForm();
    this.touchChanged();
  }

  // ======= Cleanup =======
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
