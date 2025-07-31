import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApplicationService } from '../../../services/application/application.service';
import { ICandidateFilterRequest } from '../../../interfaces/Application/application.interface';
import { Columns } from '../../../shared/interfaces/tables/column.interface';

@Component({
  selector: 'app-all-application',
  templateUrl: './all-application.component.html',
  styleUrl: './all-application.component.scss'
})
export class AllApplicationComponent {

  constructor(
    private router: Router,
    private applicationService: ApplicationService,

  ) {

  }
  isLoading: boolean = false;
  candidateFilterRequest: ICandidateFilterRequest = {
    page: 1,
    pageSize: 30
  };
  searchForm = { searchBy: '', searchValue: '' };
  searchByOptions: string[] = ['Application ID', 'Application Name', 'University'];

  STORAGE_KEY: string = 'candidateFilterSettings';
  STORAGE_CLICKED_KEY: string = 'candidateclickedRowIndexes';

  tableResetKey = 0;

  tabMenus = [
    { key: '', label: 'All Applications', count: 0 },
    { key: 'new', label: 'New Applications', count: 0 },
    { key: 'over3', label: 'Over 3 Days', count: 0 },
    { key: 'overweek', label: 'Over 1 Week', count: 0 },
    { key: 'overmonth', label: 'Over 1 Month', count: 0 },
  ];
  activeTab: string = this.tabMenus[0].key;

  columns: Columns = [
    { header: 'Qualified', field: 'qualifield', type: 'icon', align: 'center', minWidth: '30px', sortable: true },
    { header: 'Submit Date', field: 'submitDate', type: 'date', align: 'center', sortable: true },
    { header: 'Applicant ID', field: 'userID', type: 'text', align: 'center', sortable: true },
    { header: 'Applicant Name', field: 'fullName', type: 'text', sortable: true },
    { header: 'Job Position', field: 'position', type: 'list', maxWidth: '400px', wrapText: true },
    { header: 'University', field: 'university', type: 'text', maxWidth: '400px', wrapText: true, sortable: true },
    { header: 'GPA', field: 'gpa', type: 'text', align: 'center', sortable: true },
    { header: 'Grade', field: 'gradeCandidate', type: 'text', align: 'center', maxWidth: '20px', sortable: true },
    { header: 'Total Score', field: 'totalCandidatePoint', type: 'expandable', align: 'right', mainColumn: 'totalCandidatePoint', sortable: true },
    { header: 'Education (1 Point)', field: 'bdPoint', type: 'text', align: 'right', subColumn: 'totalCandidatePoint', sortable: true },
    { header: 'GPA (1 Point)', field: 'gpaScore', type: 'text', align: 'right', subColumn: 'totalCandidatePoint', sortable: true },
    { header: 'Test EQ (1 Point)', field: 'eqScore', type: 'text', align: 'right', subColumn: 'totalCandidatePoint', sortable: true },
    { header: 'Test Ethics (1 Point)', field: 'ethicsScore', type: 'text', align: 'right', subColumn: 'totalCandidatePoint', sortable: true },
    { header: 'Bonus', field: 'totalBonus', type: 'text', align: 'right', sortable: true },
    { header: 'Status', field: 'submitStatusLabel', type: 'badge', align: 'center' },
  ];

  filterDateRange: { month: string; year: string } = { month: '', year: '' };
  preClickedIds: string[] = [];
  ngOnInit() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      this.candidateFilterRequest = JSON.parse(saved);
      this.activeTab = this.candidateFilterRequest.statusGroup || '';
      this.filterDateRange.month = this.candidateFilterRequest.month || '';
      this.filterDateRange.year = this.candidateFilterRequest.year || '';
    }
    const savedClickedRowIds = localStorage.getItem(this.STORAGE_CLICKED_KEY);
    this.preClickedIds = savedClickedRowIds ? JSON.parse(savedClickedRowIds) : [];
    this.fetchListCandidate();
  }

  saveFiltersToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.candidateFilterRequest));
  }

  async onSearch(form: { searchBy: string; searchValue: string }) {
    const useSearch: string[] = ['Application ID', 'Application Name', 'University'];

    if (useSearch.includes(form.searchBy)) {
      this.candidateFilterRequest.search = form.searchValue;
    }
    this.candidateFilterRequest.page = 1;
    this.saveFiltersToStorage();
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListCandidate();
  }
  async onClearSearch() {
    this.candidateFilterRequest.search = null as any;
    this.candidateFilterRequest.page = 1;
    this.saveFiltersToStorage();
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListCandidate();
  }

  async onDateRangeSelected(event: { startDate: string; endDate: string }) {
    const startDatemounth: string = event.startDate.substring(5, 7);
    const endDatemounth: string = event.endDate.substring(5, 7);

    const mounth: string = startDatemounth === endDatemounth ? endDatemounth : '';
    const year: string = event.endDate.substring(0, 4);

    this.candidateFilterRequest.page = 1;
    this.candidateFilterRequest.month = mounth;
    this.candidateFilterRequest.year = year;
    this.saveFiltersToStorage();
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListCandidate();
  }

  async onTabChanged(tab: string) {
    this.candidateFilterRequest.statusGroup = tab;
    this.candidateFilterRequest.page = 1;
    this.saveFiltersToStorage();
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListCandidate();
  }
  onRowClick(row: any) {
    console.log('Row clicked:', row);
  }

  async onColumnClick(column: string) {
    console.log('Column clicked:', column);

    this.candidateFilterRequest.sortFields = column;
    this.candidateFilterRequest.page = 1;
    this.saveFiltersToStorage();
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListCandidate();
  }
  onScroll(event: any): void {
    const element = event.target;
    // เช็คว่า scroll ถึงล่างสุดหรือยัง
    if (element.scrollHeight - element.scrollTop < element.clientHeight + 2) {
      if (this.candidateFilterRequest.hasNextPage && !this.isLoading) {
        this.candidateFilterRequest.page++;
        this.saveFiltersToStorage();
        this.fetchListCandidate(true); // true = append
      }
    }
  }

  scrollTableToTop(className = 'tw-h-[calc(100vh-370px)]') {
    const el = document.getElementsByClassName(className)[0];
    if (el) el.scrollTop = 0;
  }

  rows: any[] = [];
  fetchListCandidate(append: boolean = false): void {
    if (this.isLoading) return;
    this.isLoading = true;
    // console.log('this.candidateFilterRequest : ', this.candidateFilterRequest);
    this.applicationService.getApplications(this.candidateFilterRequest).subscribe({
      next: (res) => {
        console.log('res : ', res);
        this.candidateFilterRequest.page = res.page;
        this.candidateFilterRequest.hasNextPage = res.hasNextPage;

        this.tabMenus.forEach(menu => {
          if (menu.key === '') {
            // All Applications → ใช้ totalItems แทน
            menu.count = res.totalItems;
          } else {
            // ใช้ statusGroupCount จาก API
            menu.count = res.statusGroupCount?.[menu.key] ?? 0;
          }
        });

        const newRows = res.items.map((item: any) => {
          const summary = item.summary;
          return {
            id: summary.userID,
            qualifield: summary.qualifield === 1
              ? { icon: 'check-circle', fill: 'green', size: '25' }
              : { icon: 'xmark-circle', fill: 'red', size: '25' },
            submitDate: summary.submitDate,
            userID: summary.userID,
            fullName: summary.fullName,
            position: [...item.positions].map((position: any) => position.namePosition),
            university: summary.university,
            gpa: summary.gpa,
            gradeCandidate: summary.gradeCandidate,
            totalCandidatePoint: summary.totalCandidatePoint + '/4',
            bdPoint: summary.bdPoint,
            gpaScore: summary.gpaScore,
            eqScore: summary.eqScore,
            ethicsScore: summary.ethicsScore,
            totalBonus: summary.totalBonus,
            submitStatusLabel: { label: summary.submitStatusLabel, class: this.getBadgeClasses(summary.submitStatusLabel) }
          };
        });
        this.rows = append ? [...this.rows, ...newRows] : newRows;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching candidates:', err);
        this.isLoading = false;
      }
    });
  }
  getBadgeClasses(value: string) {
    switch (value) {
      case 'New':
        return ['tw-bg-green-500', 'tw-text-white', 'tw-ring-green-500/10']; // เขียวสด
      case 'Over 3 Day':
        return ['tw-bg-yellow-400', 'tw-text-black', 'tw-ring-yellow-500/10']; // เหลืองทอง
      case 'Over Week':
        return ['tw-bg-red-500', 'tw-text-white', 'tw-ring-red-500/10']; // แดงสด
      case 'Over Month':
        return ['tw-bg-red-900', 'tw-text-white', 'tw-ring-red-900/10']; // แดงเข้ม
      default:
        return ['tw-bg-gray-50', 'tw-text-gray-600', 'tw-ring-gray-500/10'];
    }
  }
  onClickedRowsChanged(clickedRowIds: Set<string>) {
    const arr = Array.from(clickedRowIds);
    localStorage.setItem(this.STORAGE_CLICKED_KEY, JSON.stringify(arr));
    console.log('clickedRowIds', clickedRowIds);
  }
}
