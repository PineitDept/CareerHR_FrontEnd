// tracking.component.ts
import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  OnDestroy,
  signal,
  computed,
  HostListener,
} from '@angular/core';
import { Observable, tap, catchError, EMPTY, map } from 'rxjs';

import { BaseApplicationComponent } from '../../../shared/base/base-application.component';
import {
  ICandidateFilterRequest,
  ICandidateWithPositionsDto,
  IPositionDto,
  TabMenu,
  ICandidateTrackingFilterRequest,
  SearchForm,
} from '../../../interfaces/Application/application.interface';
import { Columns } from '../../../shared/interfaces/tables/column.interface';
import {
  FilterConfig,
  GroupedCheckboxOption,
} from '../../../shared/components/filter-check-box/filter-check-box.component';
import { TrackingRow } from '../../../interfaces/Application/tracking.interface';
import * as XLSX from 'xlsx-js-style';

// Component-specific Configuration
const TRACKING_CONFIG = {
  STORAGE_KEYS: {
    FILTER_SETTINGS: 'trackingFiterSettings',
    CLICKED_ROWS: 'trackingClickedRowIndexes',
    SORT_CONFIG: 'trackingSortConfig',
    HEADER_SEARCH_FORM: 'trackingHeaderSearchForm',
  },
} as const;
const STATUS_COLOR_MAP: Record<number | string, string> = {
  // Screened statuses (text-based)
  'pending': '#9ca3af',   // gray-400
  'accept': '#16a34a',    // green-600
  'decline': '#dc2626',   // red-600
  'hold': '#f97316',      // orange-500
  'received': '#38bdf8',  // sky-400

  // Interview/Offer/Hired statuses (number-based)
  12: '#9ca3af',  // gray-400 - Pending
  15: '#38bdf8',  // sky-400 - Inprocess
  16: '#2563eb',  // blue-600 - Scheduled
  20: '#f97316',  // orange-500
  21: '#16a34a',  // green-600 - Accept
  22: '#dc2626',  // red-600 - Decline
  23: '#9333ea',  // purple-600 - No-Show
  25: '#ec4899',  // pink-500 - Decline Interview
  40: '#0d9488',  // teal-600 - Accept (Offer)
  41: '#047857',  // emerald-700 - Onboarded
  42: '#d97706',  // amber-600 - Decline (Offer)
  43: '#eab308',  // yellow-500 - OnHold
  44: '#be123c',  // rose-700 - Decline (Hired)
  45: '#9333ea',  // purple-600 - No-Show (Hired)
};
// Status ID to Icon mapping
const STATUS_ICON_MAP: Record<
  number,
  { icon: string; fill?: string; size?: string; extraClass?: string; textDes?: string }
> = {
  12: { icon: 'minus-circle-solid', fill: '#9ca3af', size: '25', textDes: '' }, // gray-400
  15: { icon: 'check-circle-solid', fill: '#38bdf8', size: '25', textDes: '' }, // sky-400
  16: { icon: 'check-circle-solid', fill: '#2563eb', size: '25', textDes: '' }, // blue-600
  20: { icon: 'minus-circle-solid', fill: '#f97316', size: '25', textDes: '' }, // orange-500
  21: { icon: 'check-circle-solid', fill: '#16a34a', size: '25', textDes: '' }, // green-600
  22: { icon: 'xmark-circle-solid', fill: '#dc2626', size: '25', textDes: '' }, // red-600
  23: { icon: 'xmark-circle-solid', fill: '#9333ea', size: '25', textDes: '' }, // purple-600
  25: { icon: 'xmark-circle-solid', fill: '#ec4899', size: '25', textDes: '' }, // pink-500
  40: { icon: 'check-circle-solid', fill: '#0d9488', size: '25', textDes: '' }, // teal-600
  41: { icon: 'check-circle-solid', fill: '#047857', size: '25', textDes: '' }, // emerald-700
  42: { icon: 'xmark-circle-solid', fill: '#d97706', size: '25', textDes: '' }, // amber-600
  43: { icon: 'minus-circle-solid', fill: '#eab308', size: '25', textDes: '' }, // yellow-500
  44: { icon: 'xmark-circle-solid', fill: '#be123c', size: '25', textDes: '' }, // rose-700
};

@Component({
  selector: 'app-tracking',
  templateUrl: './tracking.component.html',
  styleUrl: './tracking.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackingComponent
  extends BaseApplicationComponent
  implements AfterViewInit, OnDestroy {
  // Additional ViewChild for tracking-specific functionality
  @ViewChild('filter', { static: false }) filterRef!: ElementRef;
  @ViewChild('tableContainer') tableContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  @ViewChild('hscroll') hscrollRef!: ElementRef<HTMLDivElement>;
  hasOverflowY = false;
  private ro?: ResizeObserver;

  // state ใหม่สำหรับแนวนอน
  hasXScroll = false;
  private roX?: ResizeObserver;

  filterButtons = [
    { label: 'Export Excel', key: 'export', color: '#005500' },
  ];

  // Tracking-specific state
  private readonly trackingFilterRequest =
    signal<ICandidateTrackingFilterRequest>({
      page: 1,
      pageSize: 20,
    });
  private readonly filterHeight = signal<number>(0);
  private resizeObserver!: ResizeObserver;
  rowsDataExport: any;

  // Computed properties for tracking
  readonly currentTrackingFilter = computed(() => this.trackingFilterRequest());

  private readonly groupCounts = signal<{
    pending?: number;
    accept?: number;
    decline?: number;
    hold?: number;
    hold1?: number;
    hold2?: number;
    received?: number;
    pending1?: number;
    inprocess1?: number;
    scheduled1?: number;
    noshow1?: number;
    declineInterview1?: number;
    accept1?: number;
    decline1?: number;
    pending2?: number;
    inprocess2?: number;
    scheduled2?: number;
    noshow2?: number;
    declineInterview2?: number;
    accept2?: number;
    decline2?: number;
    pendingOffer?: number;
    offer_accept?: number;
    offer_decline?: number;
    offer_onhold?: number;
    onboarded?: number;
    hired_decline?: number;
    hired_noshow?: number;
  }>({});

  // Table Configuration
  readonly columns: Columns = [
    {
      header: 'Submit Date',
      field: 'submitDate',
      type: 'date',
      align: 'center',
      sortable: true,
    },
    {
      header: 'Applicant ID',
      field: 'userID',
      type: 'text',
      align: 'center',
      sortable: true,
    },
    {
      header: 'Applicant Name',
      field: 'fullName',
      type: 'text',
      sortable: true,
    },
    {
      header: 'Job Position',
      field: 'position',
      type: 'list',
      // maxWidth: '400px',
      minWidth: '264px',
      width: '16%',
      wrapText: true,
    },
    {
      header: 'University',
      field: 'university',
      type: 'text',
      // maxWidth: '400px',
      minWidth: '264px',
      width: '16%',
      wrapText: true,
      sortable: true,
    },
    {
      header: 'GPA',
      field: 'gpa',
      type: 'text',
      align: 'center',
      sortable: true,
    },
    {
      header: 'Grade',
      field: 'gradeCandidate',
      type: 'text',
      align: 'center',
      maxWidth: '20px',
      sortable: true,
    },
    {
      header: 'Applied',
      field: 'applied',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Screen',
      field: 'statusCSD',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Interview1',
      field: 'interview1',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Interview2',
      field: 'interview2',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Offered',
      field: 'offer',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Hired',
      field: 'hired',
      type: 'icon',
      align: 'center',
    },
    {
      header: 'Total',
      field: 'totalDays',
      type: 'text',
      align: 'center',
      sortable: true,
      minWidth: '120px',
    },
    // {
    //   header: 'Last Update',
    //   field: 'lastUpdate',
    //   type: 'date',
    //   align: 'center',
    //   sortable: true,
    // },
  ] as const;

  // Filter configuration for tracking
  readonly filterItems = computed<GroupedCheckboxOption[]>(() => {
    const counts = this.groupCounts();

    return [
      {
        groupKey: 'applied',
        groupLabel: 'Applied',
        options: [
          {
            key: 'received',
            label: `Received${counts.received !== undefined ? ` (${counts.received.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP['received']
          }
        ],
      },
      {
        groupKey: 'screened',
        groupLabel: 'Screened',
        options: [
          {
            key: 'pending',
            label: `Pending${counts.pending !== undefined ? ` (${counts.pending.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP['pending']
          },
          {
            key: 'accept',
            label: `Accept${counts.accept !== undefined ? ` (${counts.accept.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP['accept']
          },
          {
            key: 'decline',
            label: `Decline${counts.decline !== undefined ? ` (${counts.decline.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP['decline']
          },
          {
            key: 'hold',
            label: `On Hold${counts.hold !== undefined ? ` (${counts.hold.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP['hold']
          },
        ],
      },
      {
        groupKey: 'interview1',
        groupLabel: 'Interview 1',
        options: [
          {
            key: '12',
            label: `Pending${counts.pending1 !== undefined ? ` (${counts.pending1.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[12]
          },
          {
            key: '15',
            label: `Inprocess${counts.inprocess1 !== undefined ? ` (${counts.inprocess1.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[15]
          },
          {
            key: '16',
            label: `Scheduled${counts.scheduled1 !== undefined ? ` (${counts.scheduled1.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[16]
          },
          {
            key: '23',
            label: `No-Show${counts.noshow1 !== undefined ? ` (${counts.noshow1.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[23]
          },
          {
            key: '25',
            label: `Applicants Decline${counts.declineInterview1 !== undefined ? ` (${counts.declineInterview1.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[25]
          },
          {
            key: '21',
            label: `Accept${counts.accept1 !== undefined ? ` (${counts.accept1.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[21]
          },
          {
            key: '22',
            label: `Company Decline${counts.decline1 !== undefined ? ` (${counts.decline1.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[22]
          },
          {
            key: '20',
            label: `On Hold${counts.hold1 !== undefined ? ` (${counts.hold1.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP['hold']
          },
        ],
      },
      {
        groupKey: 'interview2',
        groupLabel: 'Interview 2',
        options: [
          {
            key: '12',
            label: `Pending${counts.pending2 !== undefined ? ` (${counts.pending2.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[12]
          },
          {
            key: '15',
            label: `Inprocess${counts.inprocess2 !== undefined ? ` (${counts.inprocess2.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[15]
          },
          {
            key: '16',
            label: `Scheduled${counts.scheduled2 !== undefined ? ` (${counts.scheduled2.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[16]
          },
          {
            key: '23',
            label: `No-Show${counts.noshow2 !== undefined ? ` (${counts.noshow2.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[23]
          },
          {
            key: '25',
            label: `Applicants Decline${counts.declineInterview2 !== undefined ? ` (${counts.declineInterview2.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[25]
          },
          {
            key: '21',
            label: `Accept${counts.accept2 !== undefined ? ` (${counts.accept2.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[21]
          },
          {
            key: '22',
            label: `Company Decline${counts.decline2 !== undefined ? ` (${counts.decline2.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[22]
          },
          {
            key: '20',
            label: `On Hold${counts.hold2 !== undefined ? ` (${counts.hold2.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP['hold']
          },
        ],
      },
      {
        groupKey: 'offered',
        groupLabel: 'Offered',
        options: [
          {
            key: '12',
            label: `Pending${counts.pendingOffer !== undefined ? ` (${counts.pendingOffer.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[12]
          },
          {
            key: '40',
            label: `Offer${counts.offer_accept !== undefined ? ` (${counts.offer_accept.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[40]
          },
          {
            key: '42',
            label: `Not Offer${counts.offer_decline !== undefined ? ` (${counts.offer_decline.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[42]
          },
          {
            key: '43',
            label: `On Hold${counts.offer_onhold !== undefined ? ` (${counts.offer_onhold.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[43]
          },
        ],
      },
      {
        groupKey: 'hired',
        groupLabel: 'Hired',
        options: [
          {
            key: '41',
            label: `Onboarded${counts.onboarded !== undefined ? ` (${counts.onboarded.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[41]
          },
          {
            key: '45',
            label: `No-Show${counts.hired_noshow !== undefined ? ` (${counts.hired_noshow.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[45]
          },
          {
            key: '44',
            label: `Decline${counts.hired_decline !== undefined ? ` (${counts.hired_decline.toLocaleString()})` : ''}`,
            color: STATUS_COLOR_MAP[44]
          },
        ],
      },
    ];
  });


  readonly filterConfig: FilterConfig = {
    expandAllByDefault: true,
    animationDuration: 300,
  };

  // Abstract method implementations
  // protected getStorageKeys() {
  //   return TRACKING_CONFIG.STORAGE_KEYS;
  // }

  // protected createInitialFilter(): ICandidateFilterRequest {
  //   return {
  //     page: 1,
  //     pageSize: 30,
  //   };
  // }

  protected createInitialFilter(): ICandidateFilterRequest {
    const d = new Date();
    d.setMonth(d.getMonth());

    return {
      page: 1,
      pageSize: 30,
      // month: String(d.getMonth() + 1),
      year: String(d.getFullYear()),
    };
  }

  protected createInitialTabs(): TabMenu[] {
    return [
      { key: '', label: 'All Applications', count: 0 },
      { key: 'pending', label: 'Pending', count: 0 },
      { key: 'accept', label: 'Accepted', count: 0 },
      { key: 'decline', label: 'Declined', count: 0 },
      { key: 'hold', label: 'On Hold', count: 0 },
    ];
  }

  override onSearch(form: SearchForm): void {
    // clone เพื่อกัน reference เดิม
    const payload: SearchForm = {
      searchBy: form.searchBy,
      searchValue: form.searchValue,
    };

    // persist UI
    // const { HEADER_SEARCH_FORM } = this.getStorageKeys();
    // this.saveToStorage(HEADER_SEARCH_FORM, payload);

    // ส่งต่อให้ Base (ซึ่งจะเติม __nonce ให้เองและรีเฟรชทุกครั้ง)
    super.onSearch(payload);
  }

  override onClearSearch(): void {
    this.searchForm = { searchBy: '', searchValue: '' };

    // const { HEADER_SEARCH_FORM } = this.getStorageKeys();
    // this.saveToStorage(HEADER_SEARCH_FORM, { searchBy: '', searchValue: '' });

    super.onClearSearch();
  }

  protected transformApiDataToRows(
    items: readonly ICandidateWithPositionsDto[]
  ): TrackingRow[] {
    return items.map((item) => this.transformSingleItem(item));
  }
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

  // แก้ไข scrollToTop method
  protected override scrollToTop(): void {
    requestAnimationFrame(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop = 0;
      }
    });
  }
  // Override for tracking-specific data fetching
  protected override fetchData(
    filter: ICandidateFilterRequest,
    append: boolean
  ): Observable<void> {
    if (this.isLoading()) return EMPTY;

    this.loadingState.set(true);
    this.filterRequest.set(filter);

    // Convert to tracking filter request
    const trackingFilter: ICandidateTrackingFilterRequest = {
      ...filter,
      ...this.trackingFilterRequest(),
      page: filter.page++,
      year: filter.year === '2001' ? undefined : filter.year ,
    };

    return this.applicationService.getTrackingApplications(trackingFilter).pipe(
      tap((response: any) => {
        this.handleApiResponse(response, append);
        if (response?.groupCounts) {
          this.groupCounts.set({
            pending: response.groupCounts.pending,
            accept: response.groupCounts.accept,
            decline: response.groupCounts.decline,
            hold: response.groupCounts.hold,
            hold1: response.groupCounts.hold1,
            hold2: response.groupCounts.hold2,
            received: response.groupCounts.received,
            pending1: response.groupCounts.pending1,
            inprocess1: response.groupCounts.inprocess1,
            scheduled1: response.groupCounts.scheduled1,
            noshow1: response.groupCounts.noshow1,
            declineInterview1: response.groupCounts.declineInterview1,
            accept1: response.groupCounts.accept1,
            decline1: response.groupCounts.decline1,
            pending2: response.groupCounts.pending2,
            inprocess2: response.groupCounts.inprocess2,
            scheduled2: response.groupCounts.scheduled2,
            noshow2: response.groupCounts.noshow2,
            declineInterview2: response.groupCounts.declineInterview2,
            accept2: response.groupCounts.accept2,
            decline2: response.groupCounts.decline2,
            pendingOffer: response.groupCounts.pendingOffer,
            offer_accept: response.groupCounts.offer_accept,
            offer_decline: response.groupCounts.offer_decline,
            offer_onhold: response.groupCounts.offer_onhold,
            onboarded: response.groupCounts.onboarded,
            hired_decline: response.groupCounts.hired_decline,
            hired_noshow: response.groupCounts.hired_noshow
          });
        }
        setTimeout(() => this.updateHasXScroll(), 0);
      }),
      // tap(() => this.persistFilterState()),
      catchError((error: any) => this.handleApiError(error)),
      tap(() => this.loadingState.set(false)),
      map(() => void 0)
    );
  }

  protected fetchDataExport(
    filter: ICandidateFilterRequest,
    append: boolean
  ): Observable<void> {
    // this.filterRequest.set(filter);

    // Convert to tracking filter request
    const trackingFilter: ICandidateTrackingFilterRequest = {
      ...filter,
      ...this.trackingFilterRequest(),
      page: 1,
      pageSize: 5000,
      month: this.filterRequest().month ? this.filterRequest().month : undefined,
      year: this.filterRequest().year ? this.filterRequest().year : undefined,
    };

    return this.applicationService.getTrackingApplications(trackingFilter).pipe(
      tap((response: any) => {

        this.rowsDataExport = this.transformApiDataToRows(response.items)

        const data = this.rowsDataExport ?? [];
        if (!data.length) return;

        // ลำดับหัวคอลัมน์ “ตามตารางบนหน้า”
        const headers = this.columns.map(c => c.header);
        const aoa: (string | number)[][] = [headers];

        // map แถวให้ตรงคอลัมน์ (ปรับใช้ formatIconCellFull)
        for (const r of data) {
          aoa.push([
            r.submitDate ? this.formatDate(r.submitDate) : '',
            r.userID ?? '',
            r.fullName ?? '',
            this.formatPositions(r.position),
            r.university ?? '',
            (r.gpa ?? '') as any,
            r.gradeCandidate ?? '',
            this.formatIconCellFull(r.applied),     // Applied
            this.formatIconCellFull(r.statusCSD),   // Screen
            this.formatIconCellFull(r.interview1),  // Interview1
            this.formatIconCellFull(r.interview2),  // Interview2
            this.formatIconCellFull(r.offer),       // Offered
            this.formatIconCellFull(r.hired),       // Hired
            r.totalDays ?? '',                      // Total
          ]);
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // ความกว้างคอลัมน์ใกล้เคียง UI
        ws['!cols'] = [
          { wch: 12 }, // Submit Date
          { wch: 12 }, // Applicant ID
          { wch: 24 }, // Applicant Name
          { wch: 32 }, // Job Position
          { wch: 28 }, // University
          { wch: 6 },  // GPA
          { wch: 8 },  // Grade
          { wch: 16 }, // Applied
          { wch: 16 }, // Screen
          { wch: 16 }, // Interview1
          { wch: 16 }, // Interview2
          { wch: 16 }, // Offered
          { wch: 16 }, // Hired
          { wch: 12 }, // Total
        ];

        // freeze แถวหัวตาราง
        (ws as any)['!freeze'] = { xSplit: 0, ySplit: 1 };

        const range = XLSX.utils.decode_range(ws['!ref']!);

        // ==== 1) สไตล์หัวตาราง (ขอบมีสี, พื้นหลังเทา, ตัวหนา) ====
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r: 0, c });
          const cell = ws[addr] || (ws[addr] = {});
          cell.s = {
            font: { bold: true, color: { rgb: '111827' } }, // gray-900
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            fill: { fgColor: { rgb: 'E5E7EB' } }, // gray-200
            border: {
              top:    { style: 'thin', color: { rgb: this.BORDER_RGB } },
              left:   { style: 'thin', color: { rgb: this.BORDER_RGB } },
              bottom: { style: 'thin', color: { rgb: this.BORDER_RGB } },
              right:  { style: 'thin', color: { rgb: this.BORDER_RGB } },
            },
          };
        }

        // index คอลัมน์สถานะ (อิงจาก aoa ด้านบน)
        const STATUS_COLS = {
          applied: 7,
          screen: 8,
          interview1: 9,
          interview2: 10,
          offered: 11,
          hired: 12,
        };

        // ==== 2) สไตล์ข้อมูล (ขอบมีสี + wrapText) + เติมสีพื้นหลังให้คอลัมน์สถานะ ====
        for (let r = 1; r <= range.e.r; r++) {
          const rowData = data[r - 1]; // mapping แถว aoa -> rows()

          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = ws[addr] || (ws[addr] = {});
            const baseStyle: any = {
              alignment: {
                vertical: 'center',
                horizontal: [0,1,5,6,7,8,9,10,11,12,13].includes(c) ? 'center' : 'left',
                wrapText: true,
              },
              border: {
                top:    { style: 'thin', color: { rgb: this.BORDER_RGB } },
                left:   { style: 'thin', color: { rgb: this.BORDER_RGB } },
                bottom: { style: 'thin', color: { rgb: this.BORDER_RGB } },
                right:  { style: 'thin', color: { rgb: this.BORDER_RGB } },
              },
              font: { color: { rgb: '111827' } }, // default เทาเข้ม
            };

            // ถ้าเป็นคอลัมน์สถานะ -> ลงสีพื้นหลังตามสถานะ + ให้ font เป็นสีขาวอ่านง่าย
            let bg: string | null = null;
            if (c === STATUS_COLS.applied)     bg = this.getStatusBg(rowData?.applied);
            else if (c === STATUS_COLS.screen) bg = this.getStatusBg(rowData?.statusCSD);
            else if (c === STATUS_COLS.interview1) bg = this.getStatusBg(rowData?.interview1);
            else if (c === STATUS_COLS.interview2) bg = this.getStatusBg(rowData?.interview2);
            else if (c === STATUS_COLS.offered)    bg = this.getStatusBg(rowData?.offer);
            else if (c === STATUS_COLS.hired)      bg = this.getStatusBg(rowData?.hired);

            if (bg) {
              baseStyle.fill = { fgColor: { rgb: bg } };
              baseStyle.font = { color: { rgb: '111827' } }; // เทาเข้มอ่านง่ายบนพื้นหลังอ่อน
              baseStyle.alignment.horizontal = 'center';
            }

            cell.s = baseStyle;
          }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tracking');
        const fileName = `applications-tracking_${(this.filterRequest().month !== undefined ? this.filterRequest().month+'_' : '')+this.filterRequest().year}.xlsx`;
        XLSX.writeFile(wb, fileName);
      }),
    );
  }

  // protected override persistFilterState(): void {
  //   const storageKeys = this.getStorageKeys();
  //   const normalized = this.normalizeTrackingFilter(this.filterRequest());
  //   this.saveToStorage(storageKeys.FILTER_SETTINGS, normalized);
  // }

  // Lifecycle hooks
  ngAfterViewInit(): void {
    super.ngOnInit();
    // this.updateTableHeight();
    // this.setupResizeObserver();
    // console.log('TrackingComponent initialized');
    // วัดครั้งแรกหลัง DOM พร้อม
    setTimeout(() => this.updateHasXScroll(), 0);

    // สังเกตการเปลี่ยนแปลงขนาดคอนเทนเนอร์แนวนอน
    if (this.hscrollRef?.nativeElement) {
      this.roX = new ResizeObserver(() => this.updateHasXScroll());
      this.roX.observe(this.hscrollRef.nativeElement);
    }
  }

  override ngOnDestroy(): void {
    this.ro?.disconnect?.();
    this.roX?.disconnect?.();
    super.ngOnDestroy();
    this.disconnectResizeObserver();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.updateHasXScroll();
  }

  // ฟังก์ชันเช็คว่ามีสกรอลล์แนวนอนหรือไม่
  private updateHasXScroll() {
    const el = this.hscrollRef?.nativeElement;
    if (!el) return;
    this.hasXScroll = el.scrollWidth > el.clientWidth;
    // ถ้าต้องการให้ Angular อัปเดตทันที สามารถ markForCheck ได้ถ้าใช้ OnPush + ChangeDetectorRef
    // this.cdr.markForCheck();
  }

  // Tracking-specific methods
  onFiltersSelected(filters: Record<string, string[]>): void {
    const currentTrackingFilter = this.trackingFilterRequest();

    // Update tracking filter
    const updatedTrackingFilter: ICandidateTrackingFilterRequest = {
      ...currentTrackingFilter,
      page: 1,
      month: this.filterRequest().month ? this.filterRequest().month : undefined,
      year: this.filterRequest().year ? this.filterRequest().year : undefined,
      hasNextPage:  this.filterRequest().hasNextPage ? this.filterRequest().hasNextPage : undefined
    };
    // Handle status (screened)
    const screenedValues = filters['screened'];
    if (screenedValues?.length) {
      const validStatuses = screenedValues.filter(status =>
        ['pending', 'accept', 'decline', 'hold'].includes(status)
      );
      if (validStatuses.length > 0) {
        updatedTrackingFilter.status = validStatuses.join(',');
      } else {
        delete updatedTrackingFilter.status;
      }
    } else {
      delete updatedTrackingFilter.status;
    }

    // Helper function for parsing arrays
    const parseToIntArray = (values?: string[]) =>
      values?.map((v) => parseInt(v)).filter((v) => !isNaN(v)) ?? [];

    // Update tracking-specific filters
    updatedTrackingFilter.interview1 = filters['interview1']?.length
      ? parseToIntArray(filters['interview1'])
      : undefined;

    updatedTrackingFilter.interview2 = filters['interview2']?.length
      ? parseToIntArray(filters['interview2'])
      : undefined;

    updatedTrackingFilter.offer = filters['offered']?.length
      ? parseToIntArray(filters['offered'])
      : undefined;

    updatedTrackingFilter.hired = filters['hired']?.length
      ? parseToIntArray(filters['hired'])
      : undefined;

    this.trackingFilterRequest.set(updatedTrackingFilter);
    this.resetPagination();
    // this.fetchData(this.filterRequest(), false).subscribe();
    this.fetchData(this.trackingFilterRequest(), false).subscribe();
  }

  // Private methods
  private transformSingleItem(item: any): TrackingRow {
    const toDaysLabel = (n?: number) =>
    (typeof n === 'number' && !isNaN(n)) ? `${n} day${n === 1 ? '' : 's'}` : undefined;

    return {
      id: item.userID.toString(),
      submitDate: item.submitDate || '',
      userID: item.userID.toString(),
      fullName: item.fullName,
      fullNameTH: item.fullNameTH,
      position: item.positions?.map((pos: any) => pos.namePosition) || [],
      university: item.university,
      gpa: item.gpa?.toString() || '',
      gradeCandidate: item.gradeCandidate,
      applied: this.mapStatusIdToIcon(21, item.applied?.date) || STATUS_ICON_MAP[12],
      // statusCSD → submitAppyToScreening
      statusCSD: {
        ...(this.mapStatusIdToIcon(item.statusCSD, item.screened?.date) || STATUS_ICON_MAP[12]),
        subDes: toDaysLabel(item.submitAppyToScreening),
      },

      // interview1 → screeningToInterview1Days
      interview1: {
        ...(this.mapStatusIdToIcon(item.interview1?.id, item.interview1?.date) || STATUS_ICON_MAP[12]),
        subDes: toDaysLabel(item.screeningToInterview1Days),
      },

      // interview2 → interview1ToInterview2Days
      interview2: {
        ...(this.mapStatusIdToIcon(item.interview2?.id, item.interview2?.date) || STATUS_ICON_MAP[12]),
        subDes: toDaysLabel(item.interview1ToInterview2Days),
      },

      // offer → interview2ToOfferDays
      offer: {
        ...(this.mapStatusIdToIcon(item.offer?.id, item.offer?.date) || STATUS_ICON_MAP[12]),
        subDes: toDaysLabel(item.interview2ToOfferDays),
      },

      // hired → offerToHiredDays
      hired: {
        ...(this.mapStatusIdToIcon(item.hired?.id, item.hired?.date) || STATUS_ICON_MAP[12]),
        subDes: toDaysLabel(item.offerToHiredDays),
      },
      totalDays: toDaysLabel(item.totalDays) ?? '',
      lastUpdate: item.lastUpdate,
      roundID: item.roundID,
    };
  }

  private mapStatusIdToIcon(
    id: number,
    date?: string
  ): {
    icon: string;
    fill?: string;
    size?: string;
    extraClass?: string;
    textDes?: string;
  } | null {
    const base = STATUS_ICON_MAP[id] || STATUS_ICON_MAP[12];

    let formattedDate = '';
    if (date) {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      formattedDate = `${day}/${month}/${year}`;
    }

    return {
      ...base,
      textDes: formattedDate,
    };
  }


  // private setupResizeObserver(): void {
  //   if (this.filterRef?.nativeElement) {
  //     this.resizeObserver = new ResizeObserver(() => {
  //       this.updateTableHeight();
  //     });
  //     this.resizeObserver.observe(this.filterRef.nativeElement);
  //   }
  // }

  // เพิ่ม HostListener สำหรับรีไซส์หน้าต่าง
  // @HostListener('window:resize')
  // onWindowResize() {
  //   this.updateTableHeight();
  // }

  private disconnectResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  // private updateTableHeight(): void {
  //   requestAnimationFrame(() => {
  //     const container = this.tableContainerRef?.nativeElement;
  //     if (!container) return;

  //     // วัดระยะจากขอบบนของ container ถึงขอบล่างของ viewport
  //     const top = container.getBoundingClientRect().top;
  //     const viewportH = window.innerHeight;
  //     const bottomGap = 16; // กันไว้เล็กน้อยไม่ให้ชนขอบ

  //     const newHeight = Math.max(240, viewportH - top - bottomGap) + 500;
  //     container.style.height = `${newHeight}px`;

  //     // อัปเดตสถานะมีสกรอลล์แนวตั้งหรือไม่ (ส่งต่อไปที่ <app-tables [hasOverflowY]>)
  //     const hasOverflow = container.scrollHeight > container.clientHeight;
  //     if (this.hasOverflowY !== hasOverflow) {
  //       this.hasOverflowY = hasOverflow;
  //     }
  //   });
  // }

  // Override persistence methods to handle tracking-specific data
  // protected override loadPersistedState(): void {
  //   super.loadPersistedState();

  //   // 1) normalize filterRequest ที่ Base เพิ่งเซ็ตขึ้นมา
  //   const normalized = this.normalizeTrackingFilter(this.filterRequest());
  //   this.filterRequest.set({ ...this.createInitialFilter(), ...normalized });
  //   this.filterDateRange = {
  //     month: normalized.month || '',
  //     year: normalized.year || '',
  //   };

  //   // 2) restore Header search UI
  //   const { HEADER_SEARCH_FORM } = this.getStorageKeys();
  //   const headerForm = this.loadFromStorage<{ searchBy: string; searchValue: string }>(HEADER_SEARCH_FORM);
  //   if (headerForm) {
  //     this.searchForm = { ...headerForm };
  //   } else if (normalized.search) {
  //     // fallback: ถ้ามี search แต่ยังไม่เคยเก็บ UI
  //     this.searchForm = {
  //       searchBy: this.searchByOptions?.[0] || 'Application ID',
  //       searchValue: normalized.search,
  //     };
  //   }

  //   // 3) set default month '7' ถ้ายังไม่มี (พฤติกรรมเดิม)
  //   const currentFilter = this.filterRequest();
  //   if (!currentFilter.month) {
  //     this.filterDateRange.month = '7';
  //     this.trackingFilterRequest.update((filter) => ({
  //       ...filter,
  //       month: '7',
  //     }));
  //   }
  // }

  // Helper method for creating pipe operators (extracted for reusability)
  // private createDataPipeOperators(append: boolean): Observable<void> {
  //   const trackingFilter: ICandidateTrackingFilterRequest = {
  //     ...this.filterRequest(),
  //     ...this.trackingFilterRequest(),
  //   };

  //   return this.applicationService.getTrackingApplications(trackingFilter).pipe(
  //     tap((response: any) => this.handleApiResponse(response, append)),
  //     // tap(() => this.persistFilterState()),
  //     catchError((error: any) => this.handleApiError(error)),
  //     tap(() => this.loadingState.set(false)),
  //     map(() => void 0)
  //   );
  // }

  override onRowClick(row: any): void {
    const id = (row as any)?.id;
    if (!id) return;
    console.log('Row clicked:', row);

    const queryParams = {
      id,
      round: (row as any)?.roundID
    };
    this.router.navigate(['/applications/tracking/application-form'], { queryParams });
  }

  private normalizeTrackingFilter(f: ICandidateFilterRequest | null | undefined): ICandidateFilterRequest {
    const src: any = f || {};
    const status = src.status ?? src.statusGroup ?? undefined;

    const cleaned: any = {
      page: src.page ?? 1,
      pageSize: src.pageSize ?? 30,
      status,
      search: src.search ?? undefined,
      month: src.month ?? undefined,
      year: src.year ?? undefined,
      sortFields: src.sortFields ?? undefined,
      hasNextPage: src.hasNextPage ?? undefined,
    };

    Object.keys(cleaned).forEach((k) => cleaned[k] === undefined && delete cleaned[k]);
    return cleaned as ICandidateFilterRequest;
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'export':
        this.onExportClicked();
        break;
    }
  }

  onExportClicked() {
    console.log('Button clicked: Export Excel');
    try {
      console.log('11111111');
      const currentTrackingFilter = this.trackingFilterRequest();

      // Update tracking filter
      const updatedTrackingFilter: ICandidateTrackingFilterRequest = {
        ...currentTrackingFilter,
        page: 1,
        month: this.filterRequest().month ? this.filterRequest().month : undefined,
        year: this.filterRequest().year ? this.filterRequest().year : undefined,
        hasNextPage:  this.filterRequest().hasNextPage ? this.filterRequest().hasNextPage : undefined
      };

      this.trackingFilterRequest.set(updatedTrackingFilter);
      this.fetchDataExport(this.trackingFilterRequest(), false).subscribe();
    } catch (e) {
      console.error('Export failed:', e);
    }
  }

  private readonly BORDER_RGB = '6B7280';

  // map icon name -> unicode symbol (แทนไอคอนจริง)
  private getIconSymbol(iconName?: string): string {
    switch (iconName) {
      case 'check-circle-solid': return '✔️'; // ผ่าน/Accept
      case 'xmark-circle-solid': return '✖️'; // ไม่ผ่าน/Decline
      case 'minus-circle-solid': return '●';  // Pending/Hold
      default: return '●';
    }
  }

  // สีพื้นหลังสำหรับคอลัมน์สถานะ: ใช้สีจาก icon.fill ถ้ามี ไม่งั้น fallback เป็นเทาอ่อน
  private getStatusBg(icon?: { fill?: string } | null): string {
    const base = icon?.fill?.replace('#', '').toUpperCase();
    if (!base || base.length !== 6) return 'F3F4F6'; // gray-100 fallback
    return this.lightenHex(base, 0.65); // ทำให้อ่อนลง ~65%
  }

  private lightenHex(hex: string, amount = 0.65): string {
    // amount: 0..1 (0 = ไม่เปลี่ยน, 1 = ขาว)
    const norm = hex.replace('#', '');
    if (norm.length !== 6) return 'E5E7EB'; // fallback
    const r = parseInt(norm.slice(0, 2), 16);
    const g = parseInt(norm.slice(2, 4), 16);
    const b = parseInt(norm.slice(4, 6), 16);

    // mix with white: new = 255 - (255 - comp) * (1 - amount)
    const mix = (comp: number) => Math.round(255 - (255 - comp) * (1 - amount));
    const rr = mix(r);
    const gg = mix(g);
    const bb = mix(b);

    const toHex = (v: number) => v.toString(16).padStart(2, '0').toUpperCase();
    return `${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
  }

  // ใช้ทั้งสามบรรทัด: icon (บรรทัด 1) / date (บรรทัด 2) / days (บรรทัด 3) — บังคับมีเสมอ
  private formatIconCellFull(icon?: { icon?: string; textDes?: string; subDes?: string } | null): string {
    const sym  = this.getIconSymbol(icon?.icon);                // บรรทัด 1: ไอคอน (unicode)
    const date = (icon?.textDes ?? '').trim() || '\u00A0';      // บรรทัด 2: วันที่ หรือ NBSP
    const days = (icon?.subDes  ?? '').trim() || '\u00A0';      // บรรทัด 3: days หรือ NBSP
    return `${sym}\n${date}\n${days}`;
  }

  // เดิม (ใช้ฟอร์แมตวันที่ทั่วไป)
  private formatDate(d?: string): string {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(+date)) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  private formatPositions(positions?: string[]): string {
    const list = positions ?? [];
    if (!list.length) return '';
    // 1. xxx \n 2. yyy \n 3. zzz
    return list.map((p, i) => `${i + 1}. ${p}`).join('\n');
  }
}
