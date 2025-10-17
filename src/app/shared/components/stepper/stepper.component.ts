import { Component, EventEmitter, Input, Output } from '@angular/core';

type Variant = 'green' | 'blue' | 'gray' | 'red' | 'white' | 'purple' | 'yellow';
type StepperTheme = 'default' | 'soft';

export interface StepItem {
  label: string;
  sub?: string;
  date?: string;
  variant?: Variant;
}

@Component({
  selector: 'app-stepper',
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.scss',
})
export class StepperComponent {
  @Input() items: StepItem[] = [];
  @Input() steps: string[] = [];
  @Input() activeIndex = 0;
  @Input() disableStep: string[] = [];
  @Input() theme: StepperTheme = 'default';
  @Output() stepChanged = new EventEmitter<number>();

  private PALETTE = {
    green:  '#0AAA2A',
    blue:   '#0A57C3',
    red:    '#DC2626',
    purple: '#6B21A8',
    yellow: '#FFB020',
    gray:   '#F3F4F6',
    white:  '#FFFFFF',
    grayBorder: '#E5E7EB',
    textGray:   '#737373',
    textDark:   '#374151',
  };

  private PALETTE_SOFT = {
    green:  '#00AA55',
    blue:   '#4EA7F5',
    red:    '#930000',
    purple: '#7F56D9',
    yellow: '#F4C15D',
    gray:   '#F5F7FA',
    white:  '#FFFFFF',
    grayBorder: '#E5E7EB',
    textGray:   '#6B7280',
    textDark:   '#374151',
  };

  private get P() {
    return this.theme === 'soft' ? this.PALETTE_SOFT : this.PALETTE;
  }

  get viewItems(): StepItem[] {
    if (this.items?.length) return this.items.map(it => ({ variant: 'white', ...it }));
    return (this.steps || []).map(label => ({ label, variant: 'white' as Variant }));
  }

  trackByLabel = (_: number, it: StepItem) => it?.label ?? _;

  get labelList(): string[] {
    return this.viewItems.map(v => v.label);
  }

  stepActive(index: number) {
    const label = this.viewItems[index]?.label;
    if (!label) return;
    if (this.disableStep.includes(label)) return;
    this.activeIndex = index;
    this.stepChanged.emit(index);
  }

  private isPurpleCase(sub?: string): boolean {
    if (!sub) return false;
    const s = sub.toLowerCase().replace(/\s+/g, ' ').trim();
    const pineNoInterview = /(didn'?t|did'?t)\s*interview.*\(?\s*pine\s*\)?/.test(s);
    const noShow          = /\bno[\s-]?show\b/.test(s);
    return pineNoInterview || noShow;
  }

  private isHold(sub?: string): boolean {
    if (!sub) return false;
    const s = sub.toLowerCase();
    return /\bon\s*hold\b|\bhold\b/.test(s);
  }

  variantOf(it: StepItem): Variant {
    if (this.isHold(it.sub))         return 'yellow';
    if (this.isPurpleCase(it.sub))   return 'purple';
    return (it.variant ?? 'white') as Variant;
  }

  bgOf(v?: Variant): string {
    switch (v) {
      case 'green':  return this.P.green;
      case 'blue':   return this.P.blue;
      case 'red':    return this.P.red;
      case 'purple': return this.P.purple;
      case 'yellow': return this.P.yellow;
      case 'gray':   return this.P.gray;
      case 'white':
      default:       return this.P.white;
    }
  }

  textOf(v?: Variant): string {
    if (v === 'green' || v === 'blue' || v === 'red' || v === 'purple' || v === 'yellow') return '#FFFFFF';
    return this.P.textDark;
  }

  circleBorderOf(v?: Variant): string {
    if (v === 'green' || v === 'blue' || v === 'red' || v === 'purple' || v === 'yellow') return 'rgba(255,255,255,0.8)';
    return this.P.grayBorder;
  }

  circleTextOf(v?: Variant): string {
    if (v === 'green' || v === 'blue' || v === 'red' || v === 'purple' || v === 'yellow') return '#FFFFFF';
    return '#4B5563';
  }

  get defaultTextColor(): string {
    return this.P.textGray;
  }

  isLast(i: number): boolean {
    return i === this.viewItems.length - 1;
  }

  isDisabled(i: number): boolean {
    const label = this.viewItems[i]?.label;
    return !!label && this.disableStep.includes(label);
  }

  dividerColorOf(v?: Variant): string {
    if (v === 'green' || v === 'blue' || v === 'red' || v === 'purple' || v === 'yellow') return 'rgba(255,255,255,0.82)';
    return '#CBD5E1';
  }

  dividerShadowOf(v?: Variant): string {
    if (v === 'green' || v === 'blue' || v === 'red' || v === 'purple' || v === 'yellow') return 'rgba(0,0,0,0.15)';
    return 'rgba(255,255,255,0.6)';
  }
}
