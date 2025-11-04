import { formatDate, Location } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { Router } from '@angular/router';
import dayjs from 'dayjs';

@Component({
  selector: 'app-filter',
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss'
})
export class FilterComponent {

  @Input() actionButtons: {
    label: string;
    key: string;
    color?: string;
    textColor?: string;
    borderColor?: string;
    outlineBtn?: boolean;
    options?: Array<{ label: string; value: any }>;
  }[] = [];
  @Input() disabledKeys: string[] = [];
  @Input() selectedRows: any[] = [];
  @Input() filterDynamicButton: boolean = false;
  @Input() ButtonBackSave: boolean = false;
  @Input() filterDate: boolean = true;
  @Input() filterOurCompany: boolean = false;
  @Input() filterDateRange: { month: string; year: string } = { month: '', year: '' };
  @Input() disabledFilterDateRange: boolean = false;
  @Input() GradeSelect: boolean = false;
  @Input() DateCalendar: boolean = false;
  @Input() showAllYearOption: boolean = false;
  @Input() defaultYearAll: boolean = false;
  @Input() defaultLastMonth: boolean = false;

  @Output() buttonClicked = new EventEmitter<string>();
  @Output() dateRangeSelected = new EventEmitter<{ startDate: string; endDate: string }>();
  @Output() gradeSelected = new EventEmitter<string>();
  @Output() DateToday = new EventEmitter<Date>();
  @Output() selectChanged = new EventEmitter<{ key: string; value: any; label: string }>();

  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth(); // 0-indexed
  years = Array.from({ length: 6 }, (_, i) => String(this.currentYear - i));
  allMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  months = this.getMonthsByYear(String(this.currentYear));

  ourCompany = ['All', 'PPC', 'PMC', 'PIM'];
  allGrade = ['All Grade', 'A', 'B', 'C', 'D', 'E', 'N/A'];

  selectedYear = String(this.currentYear);
  selectedMonth = 'All';
  selectedCompany = 'All';
  selectedGrade = 'All Grade';
  currentMonthName: string | undefined;
  formattedToday: string | undefined;

  isYearOpen = false;
  isMonthOpen = false;
  isGradeOpen = false;

  @ViewChild('yearDropdown') yearDropdown!: ElementRef;
  @ViewChild('monthDropdown') monthDropdown!: ElementRef;
  @ViewChild('gradeDropdown') gradeDropdown!: ElementRef;

  openActionKey: string | null = null;

  // === states for "Other year" ===
  otherYearMode = false;        // เปิด/ปิดส่วนกรอกเลข "Other"
  otherYearInput: string = '';  // ค่าปีที่กรอกใน "Other"
  usedOtherYear = false;        // เคยยืนยัน "Other" แล้วหรือยัง

  @ViewChild('otherYearInputRef') otherYearInputRef!: ElementRef<HTMLInputElement>;

  constructor(
    private router: Router,
    private location: Location
  ) { }

  ngOnInit() {
    this.years = this.getYearsWithOptionalAll();
    this.selectedYear = this.defaultYearAll ? 'All' : String(this.currentYear);

    if (this.defaultLastMonth) {
      const today = new Date();
      this.selectedYear = String(today.getFullYear());
      this.selectedMonth = this.allMonths[today.getMonth()];
    }

    if (!this.DateCalendar) {
      this.emitDateRange();
    }

    const storedGradeIndex = sessionStorage.getItem('benefitsFiterSettings_Grade');
    const value = this.allGrade[Number(storedGradeIndex)]
    this.selectedGrade = value;

    if (this.DateCalendar) {
      this.months = this.allMonths

      const today = new Date();
      this.selectedMonth = this.months[today.getMonth()];

      this.formattedToday = formatDate(today, 'yyyy-MM-dd', 'en-US');
      this.dateRangeSelected.emit({ startDate: this.formattedToday, endDate: this.formattedToday });
    }
  }

  getYearsWithOptionalAll(): string[] {
    const baseYears = Array.from({ length: 6 }, (_, i) => String(this.currentYear - i));
    return this.showAllYearOption ? ['All', ...baseYears, 'Other'] : [...baseYears, 'Other'];
  }

  isWhite(c?: string): boolean {
    const s = (c || '').trim().toLowerCase();
    return s === '#ffffff' || s === 'white' || s === 'rgb(255, 255, 255)';
  }

  onBackClick() {
    // const fullUrl = this.router.url;           // เช่น /applications/screening/application-form?id=123
    // const [pathOnly] = fullUrl.split('?');     // ตัด query ออก -> /applications/screening/application-form

    // // ===== [A] รองรับเส้นทางของ application module =====
    // if (pathOnly.startsWith('/applications/')) {
    //   // กรณีหน้าแบบ /applications/.../application-form[/*]
    //   if (/\/application-form(?:\/.*)?$/.test(pathOnly)) {
    //     const basePath = pathOnly.replace(/\/application-form(?:\/.*)?$/, '');
    //     this.router.navigateByUrl(basePath || '/applications');
    //     return;
    //   }

    //   // เผื่อกรณีอนาคต: /applications/.../details[/*]
    //   if (/\/details(?:\/.*)?$/.test(pathOnly)) {
    //     const basePath = pathOnly.replace(/\/details(?:\/.*)?$/, '');
    //     this.router.navigateByUrl(basePath || '/applications');
    //     return;
    //   }
    // }

    // // ===== [B] พฤติกรรมเดิม (หน้าทั่วไปที่ลงท้ายด้วย /details) =====
    // if (pathOnly.includes('/details')) {
    //   const basePath = pathOnly.replace(/\/details(?:\/.*)?$/, '');
    //   this.router.navigateByUrl(basePath || '/');
    //   return;
    // }

    // หากไม่เข้าเงื่อนไขใด ๆ จะไม่ทำอะไรเพิ่มเติม หรือจะใส่ fallback ก็ได้ตามต้องการ
    // this.router.navigateByUrl('/');

    this.location.back()
  }

  toggleDropdown(type: 'year' | 'month' | 'grade') {
    this.isYearOpen = type === 'year' ? !this.isYearOpen : false;
    this.isMonthOpen = type === 'month' ? !this.isMonthOpen : false;
    this.isGradeOpen = type === 'grade' ? !this.isGradeOpen : false;

    if (type === 'year' && this.isYearOpen) {
      if (this.usedOtherYear) {
        // เคยยืนยัน Other มาก่อน → เปิดมาให้ expand พร้อมกรอกค่าปัจจุบัน
        this.otherYearMode = true;
        this.otherYearInput = this.selectedYear && /^\d{1,4}$/.test(this.selectedYear)
          ? this.selectedYear
          : (this.otherYearInput || String(this.currentYear));
        setTimeout(() => this.otherYearInputRef?.nativeElement?.focus(), 0);
      } else {
        // ยังไม่เคยยืนยัน → เปิดมาจะปิด Other
        this.otherYearMode = false;
      }
    }
  }

  onActionButtonClick(key: string) {
    this.buttonClicked.emit(key);
  }

  selectOption(type: 'year' | 'month' | 'company' | 'grade', value: string) {
    if (type === 'year') {

      if (value === 'Other') {
        this.otherYearMode = true;

        // หาปีตัวเลขสุดท้ายก่อน 'Other' แล้ว -1
        let lastNumeric = this.years
          .slice(0, this.years.length - 1)            // ตัด 'Other'
          .map(y => Number(y))
          .filter(n => Number.isFinite(n))
          .pop();

        const fallback = this.currentYear;            // เผื่อไม่เจอเลข
        const def = ((lastNumeric ?? fallback) - 1);

        // min/max ปลอดภัย
        const minY = 1900;
        const maxY = this.currentYear + 50;
        const clamped = Math.min(Math.max(def, minY), maxY);

        this.otherYearInput = String(clamped);

        setTimeout(() => this.otherYearInputRef?.nativeElement?.focus(), 0);
        return; // ยังไม่ emit จนกว่าจะกด Confirm
      }

      // เลือกปีปกติ → ปิด Other, ล้างค่า, ยกเลิกสถานะ usedOtherYear
      this.selectedYear = value;
      this.months = this.getMonthsByYear(value);
      this.selectedMonth = 'All';
      this.isYearOpen = false;

      // reset สถานะ Other ตาม requirement
      this.otherYearMode = false;
      this.usedOtherYear = false;
      this.otherYearInput = '';

      if (this.DateCalendar) {
        this.months = this.allMonths;
        this.selectedMonth = 'January';
      }

    } else if (type === 'month') {
      this.selectedMonth = value;
      this.isMonthOpen = false;
    } else if (type === 'company') {
      this.selectedCompany = value;
    } else if (type === 'grade') {
      this.selectedGrade = value;
      this.isGradeOpen = false;
      this.gradeSelected.emit(this.selectedGrade);
    }

    this.emitDateRange();
  }

  onConfirmOtherYear(ev?: MouseEvent) {
    ev?.stopPropagation();

    const num = Number(this.otherYearInput);
    const minY = 1900;
    const maxY = this.currentYear + 50;

    if (!Number.isFinite(num) || !/^\d{1,4}$/.test(String(num)) || num < minY || num > maxY) {
      return;
    }

    const numStr = String(num);

    // เช็คว่าปีที่ยืนยัน "ตรงกับ option ปีที่มีอยู่" หรือไม่ (ยกเว้น 'All' และ 'Other')
    const isInYearOptions = this.years
      .filter(y => y !== 'All' && y !== 'Other')
      .some(y => y === numStr);

    this.selectedYear = numStr;
    this.months = this.getMonthsByYear(this.selectedYear);
    this.selectedMonth = 'All';

    // ปิด dropdown เสมอ
    this.isYearOpen = false;

    if (isInYearOptions) {
      // ตรงกับ option ปี → ถือว่าเลือกปีปกติ
      this.usedOtherYear = false;    // ครั้งหน้า Other จะไม่ auto-expand
      this.otherYearMode = false;    // ปิดแผง Other
      this.otherYearInput = '';      // เคลียร์ค่าอินพุต
    } else {
      // ไม่ตรงกับ option ปี → ถือว่าใช้ Other ที่ยืนยันแล้ว
      this.usedOtherYear = true;     // ครั้งหน้าเปิด dropdown → auto-expand Other
      this.otherYearMode = false;    // ปิดชั่วคราวเมื่อกดยืนยัน (ตามพฤติกรรมเดิม)
      // เก็บ otherYearInput ไว้ก็ได้ หากอยากดึงกลับมาโชว์ตอนเปิดใหม่ (ตอน auto-expand)
    }

    this.emitDateRange();
  }

  // ป้องกันคลิกในกล่อง Other ให้ dropdown ไม่ปิดเอง
  onOtherContainerClick(ev: MouseEvent) {
    ev.stopPropagation();
  }

  getMonthsByYear(year: string): string[] {
    const baseMonths = (year === String(this.currentYear))
      ? this.allMonths.slice(0, this.currentMonth + 1)
      : [...this.allMonths];

    if (this.DateCalendar) {
      return this.allMonths;
    } else {
      return ['All', ...baseMonths];
    }

    // return ['All', ...baseMonths];
  }

  onAllListClick() {
    this.selectedMonth = 'All';
    this.selectedYear = 'All';

    // if (this.defaultYearAll) {
    //   this.selectedYear = 'All';
    // }
    this.emitDateRange(true);
  }

  onClickToday() {
    const today = new Date();

    this.selectedYear = String(today.getFullYear());
    this.selectedMonth = this.allMonths[today.getMonth()];

    this.emitDateRange();

    this.DateToday.emit();
  }

  emitDateRange(isAllList = false) {
    // if (this.selectedYear === 'All') {
    //   this.dateRangeSelected.emit({ startDate: '', endDate: '' });
    //   return;
    // }

    const year = Number(this.selectedYear);
    let startDate: string;
    let endDate: string;

    // if (this.selectedYear === 'All') {
    //   startDate = `${year}-01-01`;
    //   endDate = `${year}-12-31`;
    //   this.dateRangeSelected.emit({ startDate, endDate });
    // }

    if (this.selectedMonth === 'All') {
      startDate = `${year}-01-01`;

      if (year === this.currentYear && isAllList) {
        endDate = dayjs().format('YYYY-MM-DD');
      } else {
        endDate = `${year}-12-31`;
      }

    } else {
      const monthIndex = this.allMonths.indexOf(this.selectedMonth); // 0-based
      startDate = dayjs(new Date(year, monthIndex, 1)).format('YYYY-MM-DD');

      if (year === this.currentYear && monthIndex === this.currentMonth) {
        endDate = dayjs().format('YYYY-MM-DD');
      } else {
        endDate = dayjs(new Date(year, monthIndex + 1, 0)).format('YYYY-MM-DD');
      }
    }

    this.dateRangeSelected.emit({ startDate, endDate });
  }

  toggleActionDropdown(key: string, ev?: MouseEvent) {
    ev?.stopPropagation();
    this.openActionKey = this.openActionKey === key ? null : key;
  }

  selectActionOption(
    btn: { key: string; label: string; options?: Array<{ label: string; value: any }> },
    opt: { label: string; value: any },
    ev?: MouseEvent
  ) {
    ev?.stopPropagation();
    this.openActionKey = null;
    this.selectChanged.emit({ key: btn.key, value: opt.value, label: opt.label });
  }

  onBackSave() {
    this.buttonClicked.emit('saveback');
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent) {
    this.openActionKey = null;
    const target = event.target as Node;
    if (!this.yearDropdown?.nativeElement.contains(target)) {
      this.isYearOpen = false;
    }
    if (!this.monthDropdown?.nativeElement.contains(target)) {
      this.isMonthOpen = false;
    }
    if (!this.gradeDropdown?.nativeElement.contains(target)) {
      this.isGradeOpen = false;
    }
  }

  onOtherHeaderClick() {
    if (!this.otherYearMode) {
      // ยังไม่ขยาย → ทำเหมือนเลือก "Other" (จะเซ็ต default และ focus input)
      this.selectOption('year', 'Other');
    } else {
      // ขยายอยู่
      if (!this.usedOtherYear) {
        // ยังไม่ Confirm → อนุญาตให้คลิกปิดได้ (collapse เฉพาะส่วน Other)
        this.otherYearMode = false;
        // ไม่ emit ช่วงวันที่ เพราะยังไม่ได้ยืนยันอะไร
      }
      // ถ้า usedOtherYear === true (เคย Confirm แล้ว) จะ "ไม่" ปิดเมื่อคลิกหัวข้อ
      // ตามกติกาที่ให้ Other auto-expand เมื่อเปิด dropdown ครั้งถัดไป
    }
  }

  isYearActive(y: string): boolean {
    return this.selectedYear === y;
  }

  private isInYearOptionsList(yearStr: string): boolean {
    // เช็คในรายการปีปกติ (ตัด 'All' และ 'Other')
    return this.years
      .filter(v => v !== 'All' && v !== 'Other')
      .includes(yearStr);
  }

  isOtherActive(): boolean {
    // Active เมื่อ “ยืนยันใช้ Other” และค่าที่เลือกไม่ตรงกับ option ปีปกติ
    // หมายเหตุ: เมื่อ onConfirmOtherYear พบว่าค่าตรงกับ option จะเซ็ต usedOtherYear=false อยู่แล้ว
    return this.usedOtherYear
      && /^\d{1,4}$/.test(this.selectedYear)
      && !this.isInYearOptionsList(this.selectedYear);
  }

  isMonthActive(m: string): boolean {
    return this.selectedMonth === m;
  }
}
