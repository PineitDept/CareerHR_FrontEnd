import * as XLSX from 'xlsx-js-style';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { AlertDialogComponent } from '../../shared/components/dialogs/alert-dialog/alert-dialog.component';

dayjs.extend(utc);

export class PurchasingUtils {
  /** ----------------- Search Functions ----------------- **/
  static onSearch(
    form: { searchBy: string; searchValue: string },
    fetchFn: (append: boolean, queryParams?: any) => void,
    scrollFn: () => void,
    resetFn: () => void,
    setQueryParams: (qp: any) => void
  ) {
    const key = form.searchBy;
    const queryParams = { [key]: form.searchValue };
    setQueryParams(queryParams);
    fetchFn(false, queryParams);
    scrollFn();
    resetFn();
  }

  static onClearSearch(
    fetchFn: (append: boolean, queryParams?: any) => void,
    scrollFn: () => void,
    resetFn: () => void,
    setQueryParams: (qp: any) => void,
    clearSearchForm: () => void
  ) {
    clearSearchForm();
    const queryParams = {};
    setQueryParams(queryParams);
    fetchFn(false, queryParams);
    scrollFn();
    resetFn();
  }

  /** ----------------- Date & Tab ----------------- **/
  static onDateRangeSelected(
    setDateRange: (start: string, end: string) => void,
    fetchCurrentTab: () => void,
    fetchOtherTabCounts: () => void,
    clearSearchForm: () => void,
    resetSelection: () => void,
    scrollTop: () => void
  ) {
    clearSearchForm();
    setDateRange;
    fetchCurrentTab();
    fetchOtherTabCounts();
    scrollTop();
    resetSelection();
  }

  static onTabChanged(
    newTab: string,
    currentTab: string,
    setTab: (tab: string) => void,
    clearSearchForm: () => void,
    setQueryParams: (qp: any) => void,
    fetchCurrentTab: () => void,
    fetchOtherTabCounts: () => void,
    scrollTop: () => void,
    resetSelection: () => void
  ) {
    if (newTab === currentTab) return;
    setTab(newTab);
    clearSearchForm();
    setQueryParams({});
    fetchCurrentTab();
    fetchOtherTabCounts();
    scrollTop();
    resetSelection();
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
    const worksheetData = rows.map(row =>
      exportableColumns.map(col => {
        const field = col.field!;
        let value = row[field];
        if (col.type === 'date' && value) {
          value = dayjs.utc(value).format('DD-MM-YYYY');
        }
        if (col.type === 'select' && field === 'POType' && value) {
          value = PurchasingUtils.mapPOType(value);
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
        border: PurchasingUtils.defaultBorder()
      };
    });

    // Body cell styles
    worksheetData.forEach((row, rIdx) =>
      row.forEach((_, cIdx) => {
        const ref = XLSX.utils.encode_cell({ r: rIdx + 1, c: cIdx });
        worksheet[ref].s = {
          alignment: { wrapText: true },
          border: PurchasingUtils.defaultBorder()
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Orders');
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

  /** ----------------- Submit Dialog ----------------- **/
  static openSubmitDialog(
    dialog: any,
    selectedRows: any[],
    columns: any[],
    tabMenu: string,
    afterClose: (result: any) => void
  ) {
    const poTypeOptions = tabMenu === 'Local Purchase'
      ? ['Asset', 'Tools', 'Expense', 'Spare', 'Consumable']
      : ['Asset', 'Tools', 'Product', 'Service'];

    const ref = dialog.open(AlertDialogComponent, {
      width: '1000px',
      panelClass: 'custom-dialog-container',
      autoFocus: false,
      disableClose: true,
      data: {
        title: 'Confirm Purchase Order Type Selection',
        selectedRows,
        columns: columns.filter(c => c.type !== 'button' && c.type !== 'select'),
        poType: poTypeOptions,
        message: 'Please confirm the item you selected is a Purchase Order Asset.',
        confirm: true
      }
    });

    ref.afterClosed().subscribe(afterClose);
  }

  static submitPOTypeConfirmation(
    tabMenu: string,
    purchasingService: any,
    rows: any[],
    poType: string,
    notify: (message: string) => void,
    onSuccess: () => void,
    onError: () => void
  ) {
    if (!rows.length || !poType) return;

    const isOversea = tabMenu === 'Oversea Purchase';

    const POObject = rows.map(row => {
      return isOversea
        ? { POID: row.POID, ProductID: row.ProductID, No: row.ProductNo }
        : { POID: row.POID, RevisionID: row.RevisionID, No: row.No };
    });

    const request = {
      POObject,
      POType: PurchasingUtils.mapPOType(poType)
    };

    const submitFn = isOversea
      ? purchasingService.confirmOverseaPurchaseOrderType(request)
      : purchasingService.confirmLocalPurchaseOrderType(request);

    submitFn.subscribe({
      next: () => {
        notify(`Confirmed ${request.POType} for ${rows.length === 1 ? `POID ${rows[0].POID}` : `${rows.length} items`}`);
        onSuccess();
      },
      error: () => {
        onError();
      }
    });
  }

  /** ----------------- Register Dialog ----------------- **/
  static openRegisterDialog(
    dialog: any,
    selectedRows: any[],
    columns: any[],
    poType: string,
    afterClose: (result: any) => void
  ) {
    const ref = dialog.open(AlertDialogComponent, {
      width: '1000px',
      panelClass: 'custom-dialog-container',
      autoFocus: false,
      disableClose: true,
      data: {
        title: `Confirm ${poType} Registration`,
        selectedRows,
        columns: columns.filter(c => c.type !== 'button' && c.type !== 'select'),
        message: `You've reviewed the data. Proceed with registering all selected assets?`,
        confirm: true
      }
    });

    ref.afterClosed().subscribe(afterClose);
  }

  static RegisterConfirmation(
    tabMenu: string,
    purchasingService: any,
    rows: any[],
    notify: (message: string) => void,
    onSuccess: () => void,
    onError: () => void
  ) {
    if (!rows.length) return;

    const isOversea = tabMenu === 'Oversea Purchase';

    const POObject = rows.map(row => {
      return isOversea
        ? { POID: row.POID, ProductID: row.ProductID, No: row.ProductNo }
        : { POID: row.POID, RevisionID: row.RevisionID, No: row.No };
    });

    const request = {
      POObject
    };

    const submitFn = isOversea
      ? purchasingService.confirmOverseaPurchaseOrderRegister(request)
      : purchasingService.confirmLocalPurchaseOrderRegister(request);

    submitFn.subscribe({
      next: () => {
        notify(`Confirmed Asset Register for ${rows.length === 1 ? `POID ${rows[0].POID}` : `${rows.length} items`}`);
        onSuccess();
      },
      error: () => {
        onError();
      }
    });
  }

  /** ----------------- Mapper ----------------- **/
  static mapPOType(code: string): string {
    const map: Record<string, string> = {
      A: 'Asset',
      ASSET: 'Asset',
      E: 'Expense',
      EXPENSE: 'Expense',
      T: 'Tools',
      TOOLS: 'Tools',
      S: 'Spare',
      SPARE: 'Spare',
      C: 'Consumable',
      CONSUMABLE: 'Consumable'
    };
    return map[code] || code || 'Select PO Type';
  }

  /** ----------------- Reset Selection ----------------- **/
  static resetSelection(setSelected: (rows: any[]) => void, incrementResetKey: () => void) {
    setSelected([]);
    incrementResetKey();
  }
}
