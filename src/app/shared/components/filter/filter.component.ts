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

  @Input() actionButtons: { label: string; key: string; color?: string }[] = [];
  @Input() disabledKeys: string[] = [];
  @Input() selectedRows: any[] = [];
  @Input() filterDynamicButton: boolean = false;
  @Input() filterDate: boolean = true;
  @Input() filterOurCompany: boolean = false;
  @Input() filterDateRange: { month: string; year: string} = { month: '', year: '' };
  @Input() disabledFilterDateRange: boolean = false;
  @Input() GradeSelect: boolean = false;

  @Output() buttonClicked = new EventEmitter<string>();
  @Output() dateRangeSelected = new EventEmitter<{ startDate: string; endDate: string }>();
  @Output() gradeSelected = new EventEmitter<string>();

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

  isYearOpen = false;
  isMonthOpen = false;
  isGradeOpen = false;

  @ViewChild('yearDropdown') yearDropdown!: ElementRef;
  @ViewChild('monthDropdown') monthDropdown!: ElementRef;
  @ViewChild('gradeDropdown') gradeDropdown!: ElementRef;

  constructor(
    private router: Router
  ) {}

  ngOnInit() {
    this.emitDateRange();

    const storedGradeIndex = localStorage.getItem('benefitsFiterSettings_Grade');
    const value = this.allGrade[Number(storedGradeIndex)]
    this.selectedGrade = value;
  }

  onBackClick() {
    const fullUrl = this.router.url;                  // e.g. /admin-setting/.../application-question/details?categoryType=AboutMe
    const [pathOnly] = fullUrl.split('?');            // ตัด query ออกก่อน

    if (pathOnly.includes('/details')) {
      // ตัดตั้งแต่คำว่า /details และทุกอย่างหลังจากนั้นออก
      const basePath = pathOnly.replace(/\/details(?:\/.*)?$/, '');
      // นำทางกลับไปที่ path ที่ตัดแล้ว (เช่น /admin-setting/data-setting/application/application-question)
      this.router.navigateByUrl(basePath || '/');
      return;
    }
    // const currentUrl = this.router.url;
    // const matched = currentUrl.match(/\/purchasing\/(.*?)-po\/details|\/purchasing\/purchase-order\/details/);

    // if (matched) {
    //   const poType = matched[1]; // e.g., 'asset', 'tools', etc., or undefined if it's a purchase-order
    //   const target = poType ? `/purchasing/${poType}-po` : `/purchasing/purchase-order`;
    //   this.router.navigate([target]);
    // } else {
    //   this.router.navigate(['/purchasing/purchase-order']);
    // }
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

    return ['All', ...baseMonths];
  }

  onAllListClick() {
    this.selectedMonth = 'All';
    this.emitDateRange(true);
  }

  emitDateRange(isAllList = false) {
    const year = Number(this.selectedYear);
    let startDate: string;
    let endDate: string;

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
