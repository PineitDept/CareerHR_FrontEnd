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

  @Input() actionButtons: { label: string; key: string; color?: string; outlineBtn?: boolean }[] = [];
  @Input() disabledKeys: string[] = [];
  @Input() selectedRows: any[] = [];
  @Input() filterDynamicButton: boolean = false;
  @Input() filterDate: boolean = true;
  @Input() filterOurCompany: boolean = false;
  @Input() filterDateRange: { month: string; year: string } = { month: '', year: '' };
  @Input() disabledFilterDateRange: boolean = false;
  @Input() GradeSelect: boolean = false;
  @Input() DateCalendar: boolean = false;
  @Input() showAllYearOption: boolean = false;
  @Input() defaultYearAll: boolean = false;

  @Output() buttonClicked = new EventEmitter<string>();
  @Output() dateRangeSelected = new EventEmitter<{ startDate: string; endDate: string }>();
  @Output() gradeSelected = new EventEmitter<string>();
  @Output() DateToday = new EventEmitter<Date>();

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

  constructor(
    private router: Router,
    private location: Location
  ) { }

  ngOnInit() {
    this.years = this.getYearsWithOptionalAll();
    this.selectedYear = this.defaultYearAll ? 'All' : String(this.currentYear);

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
    return this.showAllYearOption ? ['All', ...baseYears] : baseYears;
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
  }

  onActionButtonClick(key: string) {
    this.buttonClicked.emit(key);
  }

  selectOption(type: 'year' | 'month' | 'company' | 'grade', value: string) {
    if (type === 'year') {
      this.selectedYear = value;
      this.months = this.getMonthsByYear(value);
      // if (value !== String(this.currentYear)) {
      this.selectedMonth = 'All';
      // } else {
      //   this.selectedMonth = this.allMonths[this.currentMonth];
      // }
      this.isYearOpen = false;

      if (this.DateCalendar) {
        this.months = this.allMonths
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

    if (this.defaultYearAll) {
      this.selectedYear = 'All';
    }
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

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: MouseEvent) {
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
}
