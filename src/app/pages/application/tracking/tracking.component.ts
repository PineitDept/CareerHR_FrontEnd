import { AfterViewInit, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ApplicationService } from '../../../services/application/application.service';
import { ICandidateFilterRequest } from '../../../interfaces/Application/application.interface';
import { Columns } from '../../../shared/interfaces/tables/column.interface';
import { FilterConfig, GroupedCheckboxOption } from '../../../shared/components/filter-check-box/filter-check-box.component';

@Component({
  selector: 'app-tracking',
  templateUrl: './tracking.component.html',
  styleUrl: './tracking.component.scss'
})

export class TrackingComponent implements AfterViewInit {
  private resizeObserver!: ResizeObserver;
  constructor(
    private router: Router,
    private applicationService: ApplicationService,
  ) {

  }
  @ViewChild('filter', { static: false }) filterRef!: ElementRef;
  @ViewChild('tableContainer', { static: false }) tableContainerRef!: ElementRef;

  isLoading: boolean = false;
  trackingFiterRequest: ICandidateFilterRequest = {
    page: 1,
    pageSize: 30
  };
  searchForm = { searchBy: '', searchValue: '' };
  searchByOptions: string[] = ['Application ID', 'Application Name', 'University'];
  filterHeight: number = 0;

  ngAfterViewInit(): void {
    this.updateTableHeight();

    // ใช้ ResizeObserver สังเกต #filter
    if (this.filterRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateTableHeight();
      });
      this.resizeObserver.observe(this.filterRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  updateTableHeight(): void {
    requestAnimationFrame(() => {
      if (this.filterRef?.nativeElement && this.tableContainerRef?.nativeElement) {
        const filterHeight = this.filterRef.nativeElement.offsetHeight;
        const windowHeight = window.innerHeight;
        const newTableHeight = windowHeight - filterHeight - 300;

        this.tableContainerRef.nativeElement.style.height = `${newTableHeight}px`;
      }
    });
  }

  STORAGE_KEY: string = 'trackingFiterSettings';
  STORAGE_SORTCOLUMN_KEY: string = 'trackingFiterSortColumn';
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
    { header: 'Submit Date', field: 'submitDate', type: 'date', align: 'center', sortable: true },
    { header: 'Applicant ID', field: 'userID', type: 'text', align: 'center', sortable: true },
    { header: 'Applicant Name', field: 'fullName', type: 'text', sortable: true },
    { header: 'Job Position', field: 'position', type: 'list', maxWidth: '400px', wrapText: true },
    { header: 'University', field: 'university', type: 'text', maxWidth: '400px', wrapText: true, sortable: true },
    { header: 'GPA', field: 'gpa', type: 'text', align: 'center', sortable: true },
    { header: 'Grade', field: 'gradeCandidate', type: 'text', align: 'center', maxWidth: '20px', sortable: true },
    { header: 'Applied', field: 'applied', type: 'icon', align: 'center' },
    { header: 'Screen', field: 'statusCSD', type: 'icon', align: 'center' },
    { header: 'Interview1', field: 'interview1', type: 'icon', align: 'center' },
    { header: 'Interview2', field: 'interview2', type: 'icon', align: 'center' },
    { header: 'Offered', field: 'offer', type: 'icon', align: 'center' },
    { header: 'Hired', field: 'hired', type: 'icon', align: 'center' },
    { header: 'Last Update', field: 'lastUpdate', type: 'date', align: 'center', sortable: true },
  ];

  filterDateRange: { month: string; year: string } = { month: '', year: '' };
  preClickedIds: string[] = [];

  filterItems: GroupedCheckboxOption[] = [
    {
      groupKey: 'applied',
      groupLabel: 'Applied',
      options: [
        { key: 'received', label: 'Received (20,000)' }
      ]
    },
    {
      groupKey: 'screened',
      groupLabel: 'Screened',
      options: [
        { key: 'accept', label: 'Accept (3,000)' },
        { key: 'decline', label: 'Decline (3,000)' },
        { key: 'on-hold', label: 'On Hold (3,000)' }
      ]
    },
    {
      groupKey: 'interview1',
      groupLabel: 'Interview 1',
      options: [
        { key: 'pending', label: 'Pending' },
        { key: 'scheduled', label: 'Scheduled' },
        { key: 'no-show', label: 'No-Show' },
        { key: 'accept', label: 'Accept' },
        { key: 'decline', label: 'Decline' }
      ]
    },
    {
      groupKey: 'interview2',
      groupLabel: 'Interview 2',
      options: [
        { key: 'pending', label: 'Pending' },
        { key: 'scheduled', label: 'Scheduled' },
        { key: 'no-show', label: 'No-Show' },
        { key: 'accept', label: 'Accept' },
        { key: 'decline', label: 'Decline' }
      ]
    },
    {
      groupKey: 'offered',
      groupLabel: 'Offered',
      options: [
        { key: 'pending', label: 'Pending' },
        { key: 'accept', label: 'Accept' },
        { key: 'decline', label: 'Decline' }
      ]
    },
    {
      groupKey: 'hired',
      groupLabel: 'Hired',
      options: [
        { key: 'onboarded', label: 'Onboarded' },
        { key: 'no-show', label: 'No-Show' },
        { key: 'decline', label: 'Decline' }
      ]
    }
  ];

  // Configuration options
  filterConfig: FilterConfig = {
    // Option 1: Expand all groups by default
    expandAllByDefault: true,
    // Animation duration (optional)
    animationDuration: 300
  };

  onFiltersSelected(filters: Record<string, string[]>) {
    console.log('Selected filters:', filters);
  }

  ngOnInit() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      this.trackingFiterRequest = JSON.parse(saved);
      this.activeTab = this.trackingFiterRequest.statusGroup || '';
      this.filterDateRange.month = this.trackingFiterRequest.month || '';
      this.filterDateRange.year = this.trackingFiterRequest.year || '';
    }
    const savedClickedRowIds = localStorage.getItem(this.STORAGE_CLICKED_KEY);
    this.preClickedIds = savedClickedRowIds ? JSON.parse(savedClickedRowIds) : [];
    this.fetchListTracking();
  }

  saveFiltersToStorage(key_storage: string, value_storage: string) {
    localStorage.setItem(key_storage, value_storage);
  }

  async onSearch(form: { searchBy: string; searchValue: string }) {
    const useSearch: string[] = ['Application ID', 'Application Name', 'University'];

    if (useSearch.includes(form.searchBy)) {
      this.trackingFiterRequest.search = form.searchValue;
    }
    this.trackingFiterRequest.page = 1;
    this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.trackingFiterRequest));
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListTracking();
  }
  async onClearSearch() {
    this.trackingFiterRequest.search = null as any;
    this.trackingFiterRequest.page = 1;
    this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.trackingFiterRequest));
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListTracking();
  }

  async onDateRangeSelected(event: { startDate: string; endDate: string }) {
    const startDatemounth: string = event.startDate.substring(5, 7);
    const endDatemounth: string = event.endDate.substring(5, 7);

    const mounth: string = startDatemounth === endDatemounth ? endDatemounth : '';
    const year: string = event.endDate.substring(0, 4);

    this.trackingFiterRequest.page = 1;
    this.trackingFiterRequest.month = mounth;
    this.trackingFiterRequest.year = year;
    this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.trackingFiterRequest));
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListTracking();
  }

  async onTabChanged(tab: string) {
    this.trackingFiterRequest.status = tab;
    this.trackingFiterRequest.page = 1;
    this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.trackingFiterRequest));
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListTracking();
  }
  onRowClick(row: any) {
    console.log('Row clicked:', row);
  }

  async onColumnClick(column: string) {
    this.trackingFiterRequest.sortFields = column;
    this.trackingFiterRequest.page = 1;
    this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.trackingFiterRequest));
    await this.scrollTableToTop('tw-h-[calc(100vh-370px)]');
    await this.fetchListTracking();
  }
  onScroll(event: any): void {
    const element = event.target;
    // เช็คว่า scroll ถึงล่างสุดหรือยัง
    if (element.scrollHeight - element.scrollTop < element.clientHeight + 2) {
      if (this.trackingFiterRequest.hasNextPage && !this.isLoading) {
        this.trackingFiterRequest.page++;
        this.saveFiltersToStorage(this.STORAGE_KEY, JSON.stringify(this.trackingFiterRequest));
        this.fetchListTracking(true); // true = append
      }
    }
  }

  scrollTableToTop(className = 'tw-h-[calc(100vh-370px)]') {
    const el = document.getElementsByClassName(className)[0];
    if (el) el.scrollTop = 0;
  }

  rows: any[] = [];
  fetchListTracking(append: boolean = false): void {
    if (this.isLoading) return;
    this.isLoading = true;
    console.log('this.trackingFiterRequest : ', this.trackingFiterRequest);
    this.applicationService.getTrackingApplications(this.trackingFiterRequest).subscribe({
      next: (res) => {
        console.log('res : ', res);
        this.trackingFiterRequest.page = res.page;
        this.trackingFiterRequest.hasNextPage = res.hasNextPage;

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
          return {
            id: item.userID,
            submitDate: item.submitDate,
            userID: item.userID,
            fullName: item.fullName,
            position: [...item.positions].map((position: any) => position.namePosition),
            university: item.university,
            gpa: item.gpa,
            gradeCandidate: item.gradeCandidate,
            applied: this.mapStatusIdToIcon(21),
            statusCSD: this.mapStatusIdToIcon(item.statusCSD),
            interview1: this.mapStatusIdToIcon(item.interview1.id),
            interview2: this.mapStatusIdToIcon(item.interview2.id),
            offer: this.mapStatusIdToIcon(item.offer.id),
            hired: this.mapStatusIdToIcon(item.hired.id),
            lastUpdate: item.lastUpdate
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
  mapStatusIdToIcon(id: number): { icon: string; fill?: string; size?: string, extraClass?: string } | null {
    const map: Record<number, { icon: string; fill?: string; size?: string, extraClass?: string }> = {
      12: { icon: 'check-circle-solid', extraClass: 'fill-gray-light-1', size: '25' },           // Pending
      13: { icon: 'check-circle-solid', fill: 'skyblue', size: '25' }, // Scheduled
      14: { icon: 'xmark-circle-solid', fill: 'red', size: '25' },               // No-Show
      20: { icon: 'check-circle-solid', fill: 'orange', size: '25' },   // On Hold
      21: { icon: 'check-circle-solid', fill: 'green', size: '25' },    // Accept
      22: { icon: 'xmark-circle-solid', fill: 'red', size: '25' },          // Decline
      30: { icon: 'check-circle-solid', fill: 'green', size: '25' },    // Onboarded
      31: { icon: 'xmark-circle-solid', fill: 'red', size: '25' },               // Hired No-show
    };

    return map[id] || map[12];
  }

  onClickedRowsChanged(clickedRowIds: Set<string>) {
    const arr = Array.from(clickedRowIds);
    this.saveFiltersToStorage(this.STORAGE_CLICKED_KEY, JSON.stringify(arr));
    console.log('clickedRowIds', clickedRowIds);
  }
}
