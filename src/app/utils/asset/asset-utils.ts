import * as XLSX from 'xlsx-js-style';
import dayjs from 'dayjs';
import { AlertDialogComponent } from '../../shared/components/dialogs/alert-dialog/alert-dialog.component';

export class AssetUtils {
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

  /** ----------------- Reset Selection ----------------- **/
  static resetSelection(setSelected: (rows: any[]) => void, incrementResetKey: () => void) {
    setSelected([]);
    incrementResetKey();
  }
}
