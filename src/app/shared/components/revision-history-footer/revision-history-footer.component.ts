import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { ConnectedPosition } from '@angular/cdk/overlay';

@Component({
  selector: 'app-revision-history-footer',
  templateUrl: './revision-history-footer.component.html',
  styleUrl: './revision-history-footer.component.scss'
})
export class RevisionHistoryFooterComponent {
  /** ข้อความฝั่งซ้าย */
  @Input() label = 'Revision History';
  /** รายการ revision (เรียงจากน้อยไปมาก) */
  @Input() revisionOptions: number[] = [];
  /** revision ที่เลือกอยู่ */
  @Input() currentRevision: number | null = null;
  /** ขั้นต่ำของความกว้าง overlay (0 = เท่าปุ่มเป๊ะ ๆ) */
  @Input() minOverlayWidth = 0;

  /** emit เมื่อผู้ใช้เปลี่ยน revision (จาก dropdown หรือตัวเลขหน้า) */
  @Output() revisionChange = new EventEmitter<number>();

  // ===== cdk overlay =====
  overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  ];
  isRevOpen = false;
  activeRevIndex = 0;
  revOverlayWidth = 160;

  @ViewChild('revBtn') revBtn!: ElementRef<HTMLButtonElement>;

  // ===== pagination (ผูกกับ revisionOptions) =====
  get historyTotalPages(): number { return Math.max(1, this.revisionOptions.length || 1); }
  get historyPage(): number {
    const idx = this.revisionOptions.findIndex(r => r === (this.currentRevision ?? this.revisionOptions.at(-1)!));
    return (idx >= 0 ? idx + 1 : this.historyTotalPages);
  }
  historyPageList: (number | '…')[] = [];

  ngOnChanges() {
    this.buildHistoryPageList();
    this.syncActiveIndex();
  }

  private syncActiveIndex() {
    const idx = this.revisionOptions.findIndex(r => r === this.currentRevision);
    this.activeRevIndex = idx >= 0 ? idx : Math.max(0, this.revisionOptions.length - 1);
  }

  private buildHistoryPageList() {
    const total = this.historyTotalPages;
    const cur = this.historyPage;
    const out: (number | '…')[] = [];
    const push = (a: number, b: number) => { for (let i = a; i <= b; i++) out.push(i); };

    if (total <= 7) { push(1, total); }
    else if (cur <= 4) { push(1, 5); out.push('…', total - 1, total); }
    else if (cur >= total - 3) { out.push(1, 2, '…'); push(total - 4, total); }
    else { out.push(1, 2, '…', cur - 1, cur, cur + 1, '…', total - 1, total); }

    this.historyPageList = out;
  }

  // ===== overlay controls =====
  toggleRevOverlay() { this.isRevOpen ? this.closeRevOverlay() : this.openRevOverlay(); }
  openRevOverlay() {
    this.updateRevOverlayWidth();
    this.isRevOpen = true;
    this.syncActiveIndex();
  }
  closeRevOverlay() { this.isRevOpen = false; }

  moveActiveRev(delta: number) {
    if (!this.isRevOpen) this.openRevOverlay();
    const max = (this.revisionOptions.length || 1) - 1;
    const next = (this.activeRevIndex || 0) + delta;
    this.activeRevIndex = Math.max(0, Math.min(max, next));
  }
  confirmActiveRev() {
    const rev = this.revisionOptions[this.activeRevIndex || 0];
    if (rev != null) { this.selectRevision(rev); this.closeRevOverlay(); }
  }
  onSelectRevisionMouseDown(rev: number, ev: MouseEvent) {
    ev.preventDefault();
    this.selectRevision(rev); this.closeRevOverlay();
  }

  // ===== pagination click -> คำนวณ revision แล้ว emit =====
  onClickPage(n: number) {
    const idx = Math.max(0, Math.min(this.revisionOptions.length - 1, Math.floor(n) - 1));
    const rev = this.revisionOptions[idx];
    this.selectRevision(rev);
  }

  private selectRevision(rev: number) {
    if (rev == null) return;
    this.currentRevision = rev;
    this.revisionChange.emit(rev);
    this.buildHistoryPageList();
    this.syncActiveIndex();
    if (this.isRevOpen) this.updateRevOverlayWidth();
  }

  // ===== ให้ overlay กว้างเท่าปุ่ม =====
  private updateRevOverlayWidth() {
    try {
      const el = this.revBtn?.nativeElement;
      const rect = el?.getBoundingClientRect?.();
      const w = Math.round(rect?.width ?? el?.offsetWidth ?? 160);
      this.revOverlayWidth = this.minOverlayWidth ? Math.max(this.minOverlayWidth, w) : w;
    } catch {
      this.revOverlayWidth = this.minOverlayWidth || 160;
    }
  }
  @HostListener('window:resize') onWindowResize() {
    if (this.isRevOpen) this.updateRevOverlayWidth();
  }
}
