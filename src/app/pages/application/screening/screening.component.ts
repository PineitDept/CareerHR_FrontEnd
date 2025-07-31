import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApplicationService } from '../../../services/application/application.service';
import { ICandidateFilterRequest } from '../../../interfaces/Application/application.interface';
import { Columns } from '../../../shared/interfaces/tables/column.interface';

@Component({
  selector: 'app-screening',
  templateUrl: './screening.component.html',
  styleUrl: './screening.component.scss'
})

export class ScreeningComponent {
  constructor(
    private router: Router,
    private applicationService: ApplicationService,

  ) {

  }
  isLoading: boolean = false;
  screeningFiterRequest: ICandidateFilterRequest = {
    page: 1,
    pageSize: 30
  };
  searchForm = { searchBy: '', searchValue: '' };
  searchByOptions: string[] = ['Application ID', 'Application Name', 'University'];

  STORAGE_KEY: string = 'screeningFiterSettings';
  STORAGE_SORTCOLUMN_KEY: string = 'screeningFiterSortColumn';
  STORAGE_CLICKED_KEY: string = 'candidateclickedRowIndexes';

  tableResetKey = 0;

  tabMenus = [
    { key: '', label: 'All Applications', count: 0 },
    { key: 'pending', label: 'Pending', count: 0 },
    { key: 'accept', label: 'Accepted', count: 0 },
    { key: 'decline', label: 'Declined', count: 0 },
    { key: 'hold', label: 'On Hold', count: 0 },
  ];
  activeTab: string = this.tabMenus[0].key;

  columns: Columns = [
    { header: 'Screening', field: 'screening', type: 'badge', align: 'center' },
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
    { header: 'Screen By', field: 'employeeAction', type: 'text', align: 'center', sortable: true },   
  ];

  filterDateRange: { month: string; year: string } = { month: '', year: '' };
  preClickedIds: string[] = [];
  ngOnInit() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      this.screeningFiterRequest = JSON.parse(saved);
      this.activeTab = this.screeningFiterRequest.statusGroup || '';
      this.filterDateRange.month = this.screeningFiterRequest.month || '';
      this.filterDateRange.year = this.screeningFiterRequest.year || '';
    }
    const savedClickedRowIds = localStorage.getItem(this.STORAGE_CLICKED_KEY);
    this.preClickedIds = savedClickedRowIds ? JSON.parse(savedClickedRowIds) : [];
    this.fetchListCandidate();
  }

  saveFiltersToStorage(key_storage: string, value_storage: string) {
    localStorage.setItem(key_storage, value_storage);
  }

  async onSearch(form: { searchBy: string; searchValue: string }) {
    const useSearch: string[] = ['Application ID', 'Application Name', 'University'];

    if (useSearch.includes(form.searchBy)) {
      this.screeningFiterRequest.search = form.searchValue;
    }
    this.screeningFiterRequest.page = 1;
    this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.screeningFiterRequest));
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListCandidate();
  }
  async onClearSearch() {
    this.screeningFiterRequest.search = null as any;
    this.screeningFiterRequest.page = 1;
    this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.screeningFiterRequest));
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListCandidate();
  }

  async onDateRangeSelected(event: { startDate: string; endDate: string }) {
    const startDatemounth: string = event.startDate.substring(5, 7);
    const endDatemounth: string = event.endDate.substring(5, 7);

    const mounth: string = startDatemounth === endDatemounth ? endDatemounth : '';
    const year: string = event.endDate.substring(0, 4);

    this.screeningFiterRequest.page = 1;
    this.screeningFiterRequest.month = mounth;
    this.screeningFiterRequest.year = year;
     this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.screeningFiterRequest));
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListCandidate();
  }

  async onTabChanged(tab: string) {
    this.screeningFiterRequest.status = tab;
    this.screeningFiterRequest.page = 1;
    this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.screeningFiterRequest));
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListCandidate();
  }
  onRowClick(row: any) {
    console.log('Row clicked:', row);
  }

  async onColumnClick(column: string) {
    this.screeningFiterRequest.sortFields = column;
    this.screeningFiterRequest.page = 1;
    this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.screeningFiterRequest));
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListCandidate();
  }
  onScroll(event: any): void {
    const element = event.target;
    // เช็คว่า scroll ถึงล่างสุดหรือยัง
    if (element.scrollHeight - element.scrollTop < element.clientHeight + 2) {
      if (this.screeningFiterRequest.hasNextPage && !this.isLoading) {
        this.screeningFiterRequest.page++;
        this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.screeningFiterRequest));
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
    // console.log('this.screeningFiterRequest : ', this.screeningFiterRequest);
    this.applicationService.getApplications(this.screeningFiterRequest).subscribe({
      next: (res) => {
        console.log('res : ', res);
        this.screeningFiterRequest.page = res.page;
        this.screeningFiterRequest.hasNextPage = res.hasNextPage;

        this.tabMenus.forEach(menu => {
          if (menu.key === '') {
            // All Applications → ใช้ totalItems แทน
            menu.count = res.totalItems;
          } else {
            // ใช้ statusGroupCount จาก API
            menu.count = res.statusCounts?.[menu.key] ?? 0;
          }
        });

        const newRows = res.items.map((item: any) => {
          const summary = item.summary;
          return {
            id: summary.userID,
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
           employeeAction: summary.employeeAction?.split(" ")[0] || '',
            screening: { label: summary.screening, class: this.getBadgeClasses(summary.screening), 
            }
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
      case 'Accepted':
        return ['bg-mint', 'tw-text-green-600', 'tw-ring-green-600/10']; // เขียวสด
      case 'On Hold':
        return ['bg-yellow', 'tw-text-green-600', 'tw-ring-yellow-500/10']; // เหลืองทอง
      case 'Declined':
        return ['tw-bg-red-500', 'tw-text-white', 'tw-ring-red-500/10']; // แดงสด
      default:
        return ['tw-bg-gray-50', 'tw-text-gray-600', 'tw-ring-gray-500/10'];
    }
  }
  onClickedRowsChanged(clickedRowIds: Set<string>) {
    const arr = Array.from(clickedRowIds);
    this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(arr));
    console.log('clickedRowIds', clickedRowIds);
  }
}
