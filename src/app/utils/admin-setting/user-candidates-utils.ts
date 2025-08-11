import * as XLSX from 'xlsx-js-style';
import dayjs from 'dayjs';

export class UserCandidatesUtils {
  /** ----------------- Search Functions ----------------- **/
  static onSearch(
    form: { searchBy: string; searchValue: string },
    fetchFn: (append: boolean, queryParams?: any) => void,
    scrollFn: () => void,
    clearSortFn: () => void,
    setQueryParams: (qp: any) => void
  ) {
    const key = form.searchBy;
    const queryParams = { [key]: form.searchValue };
    setQueryParams(queryParams);
    clearSortFn();
    fetchFn(false, queryParams);
    scrollFn();
  }

  static onClearSearch(
    fetchFn: (append: boolean, queryParams?: any) => void,
    scrollFn: () => void,
    clearSortFn: () => void,
    setQueryParams: (qp: any) => void,
    clearSearchForm: () => void
  ) {
    clearSearchForm();
    const queryParams = {};
    setQueryParams(queryParams);
    clearSortFn()
    fetchFn(false, queryParams);
    scrollFn();
  }

  /** ----------------- Date ----------------- **/
  static onDateRangeSelected(
    setDateRange: (start: string, end: string) => void,
    fetchFn: () => void,
    clearSearchForm: () => void,
    scrollTop: () => void,
    clearSortFn: () => void
  ) {
    clearSearchForm();
    setDateRange;
    clearSortFn();
    fetchFn();
    scrollTop();
  }

  /** ----------------- Sorting ----------------- **/
  static onColumnClicked(
    sortState: { [field: string]: 'asc' | 'desc' | null },
    sortOrder: string[],                                // <<— รับลำดับคอลัมน์
    setSortFields: (sf: string[]) => void,
    fetchFn: () => void,
    scrollTop: () => void
  ) {
    const pairs: string[] = [];
    for (const field of sortOrder) {
      const dir = sortState[field];
      if (dir === 'asc' || dir === 'desc') {
        const mapped = field === 'userName' ? 'engFirstname' : field;
        pairs.push(`${mapped}:${dir}`);
      }
    }
    setSortFields(pairs); // เช่น ["userID:desc","email:asc","phoneNumber:desc"]
    fetchFn();
    scrollTop();
  }

  /** ----------------- Infinite Scroll ----------------- **/
  static onScroll(event: any, callback: () => void) {
    const target = event.target;
    const threshold = 100;
    const isAtBottom =
      target.scrollTop + target.offsetHeight + threshold >= target.scrollHeight;
    if (isAtBottom) callback();
  }

  static scrollTableToTop(className = 'tw-h-[calc(100vh-300px)]') {
    const el = document.getElementsByClassName(className)[0];
    if (el) el.scrollTop = 0;
  }

  /** ----------------- Export to Excel ----------------- **/
  static onExportClicked(
    columns: any[],
    rows: any[],
    filename: string
  ) {
    const exportableColumns = columns.filter(col => col.field);
    const headers = exportableColumns.map(col => col.header);
    const binaryIconFields = new Set(['informationCompleted', 'quizCompleted', 'sendFormCompleted']);
    const leftAlignedFields = new Set(['userName', 'email']);
    const worksheetData = rows.map(row =>
      exportableColumns.map(col => {
        const field = col.field!;
        let value = row[field];
        if (binaryIconFields.has(field)) {
          const iconName = value?.icon as string | undefined;
          if (iconName === 'check-circle') value = 1;
          else if (iconName === 'xmark-circle') value = 0;
          else value = '';
        } else if (col.type === 'dateWithTime' && value) {
          value = dayjs.utc(value).format('DD-MM-YYYY HH:mm');
        }
        return value ?? '';
      })
    );

    const worksheet = XLSX.utils.aoa_to_sheet([
      headers,
      ...worksheetData
    ]);

    // Header styles
    headers.forEach((_, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
      worksheet[cellRef].s = {
        font: { bold: true },
        alignment: { horizontal: 'center', wrapText: true },
        fill: { fgColor: { rgb: 'D9E1F2' } },
        border: UserCandidatesUtils.defaultBorder()
      };
    });

    // Body cell styles
    worksheetData.forEach((row, rIdx) =>
      row.forEach((_, cIdx) => {
        const ref = XLSX.utils.encode_cell({ r: rIdx + 1, c: cIdx });
        const field = exportableColumns[cIdx]?.field as string;
        const horizontal = leftAlignedFields.has(field) ? 'left' : 'center';

        worksheet[ref].s = {
          alignment: { horizontal, wrapText: true },
          border: UserCandidatesUtils.defaultBorder()
        };
      })
    );

    worksheet['!cols'] = worksheetData[0]?.map((_, i) => {
      const maxLen = Math.max(
        headers[i]?.toString().length,
        ...worksheetData.map(row => row[i]?.toString().length || 0)
      );
      return { wch: maxLen + 2 };
    }) || [];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User Candidates');
    XLSX.writeFile(workbook, filename);
  }

  static defaultBorder() {
    return {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    };
  }
}
