import { Component, EventEmitter, Input, Output } from '@angular/core';

type Variant = 'green' | 'blue' | 'gray' | 'red' | 'white';
type StepperTheme = 'default' | 'soft'; // เพิ่มธีม

export interface StepItem {
  label: string;
  sub?: string;
  date?: string;
  /** ถ้าไม่ส่ง variant มา จะใช้ 'white' เป็นค่าเริ่มต้น */
  variant?: Variant;
}

@Component({
  selector: 'app-stepper',
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.scss',
})
export class StepperComponent {
  /** โหมดใหม่: ส่งรายการ StepItem (label/sub/date/variant) */
  @Input() items: StepItem[] = [];

  /** โหมดเดิม: ส่งเฉพาะชื่อสเต็ปเป็น string[] (fallback ถ้า items ว่าง) */
  @Input() steps: string[] = [];

  @Input() activeIndex = 0;
  @Input() disableStep: string[] = [];

  /** ธีมสี: default (เข้ม) หรือ soft (โทนใกล้พาสเทล) */
  @Input() theme: StepperTheme = 'default';

  @Output() stepChanged = new EventEmitter<number>();

  /** palette เดิม */
  private PALETTE = {
    green: '#0AAA2A',
    blue: '#0A57C3',
    red: '#DC2626',
    gray: '#F3F4F6',
    white: '#FFFFFF',
    grayBorder: '#E5E7EB',
    textGray: '#737373',
    textDark: '#374151',
  };

  /** palette โทน soft (ใกล้พาสเทล) */
  private PALETTE_SOFT = {
    green: '#00AA55', // เขียว
    blue:  '#4EA7F5', // ฟ้าน้ำทะเล
    red:   '#930000', // แดง
    gray:  '#F5F7FA', // เทาอ่อน
    white: '#FFFFFF',
    grayBorder: '#E5E7EB',
    textGray: '#6B7280',
    textDark: '#374151',
  };

  /** เลือก palette ตาม theme */
  private get P() {
    return this.theme === 'soft' ? this.PALETTE_SOFT : this.PALETTE;
  }

  /** รวมเป็นรายการที่ใช้แสดงจริง (ถ้า items ว่างจะ map จาก steps เดิม) */
  get viewItems(): StepItem[] {
    if (this.items?.length) return this.items.map(it => ({ variant: 'white', ...it }));
    return (this.steps || []).map(label => ({ label, variant: 'white' as Variant }));
  }

  /** ชื่อ (label) ทั้งหมด ใช้ตรวจ disable */
  get labelList(): string[] {
    return this.viewItems.map(v => v.label);
  }

  /** คลิกลูกศร/ขั้น */
  stepActive(index: number) {
    const label = this.viewItems[index]?.label;
    if (!label) return;
    if (this.disableStep.includes(label)) return; // ปิดคลิกตามที่ parent กำหนด
    this.activeIndex = index;
    this.stepChanged.emit(index);
  }

  /** สีพื้นของ step */
  bgOf(v?: Variant): string {
    switch (v) {
      case 'green': return this.P.green;
      case 'blue':  return this.P.blue;
      case 'red':   return this.P.red;
      case 'gray':  return this.P.gray;
      case 'white':
      default:      return this.P.white;
    }
  }

  /** สีตัวอักษรของ step */
  textOf(v?: Variant): string {
    if (v === 'green' || v === 'blue' || v === 'red') return '#FFFFFF';
    return this.P.textDark;
  }

  /** สีเส้น/กรอบวงกลมเลข */
  circleBorderOf(v?: Variant): string {
    if (v === 'green' || v === 'blue' || v === 'red') return 'rgba(255,255,255,0.8)';
    return this.P.grayBorder;
  }

  /** สีเลขในวงกลม */
  circleTextOf(v?: Variant): string {
    if (v === 'green' || v === 'blue' || v === 'red') return '#FFFFFF';
    return '#4B5563'; // tw-gray-600
  }

  /** สีตัวอักษรกรณี default */
  get defaultTextColor(): string {
    return this.P.textGray;
  }

  /** เป็นสเต็ปสุดท้ายหรือไม่ (เพื่อตัดหัวลูกศร) */
  isLast(i: number): boolean {
    return i === this.viewItems.length - 1;
  }

  /** สเต็ปนี้ถูก disable ไหม */
  isDisabled(i: number): boolean {
    const label = this.viewItems[i]?.label;
    return !!label && this.disableStep.includes(label);
  }

  /** สีเส้นคั่น */
  dividerColorOf(v?: Variant): string {
    // พื้นสีเข้ม → ใช้ขาวโปร่งแสงเพื่อความเนียน
    if (v === 'green' || v === 'blue' || v === 'red') return 'rgba(255,255,255,0.82)';
    // พื้นอ่อน/ขาว → ใช้เทาอุ่น
    return '#CBD5E1';
  }

  /** เงาเส้นคั่น */
  dividerShadowOf(v?: Variant): string {
    if (v === 'green' || v === 'blue' || v === 'red') return 'rgba(0,0,0,0.15)';
    return 'rgba(255,255,255,0.6)';
  }
}
