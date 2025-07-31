import { PurchasingUtils } from './purchasing-utils';
import * as XLSX from 'xlsx-js-style';

describe('PurchasingUtils', () => {
  afterEach(() => {
    jasmine.getEnv().allowRespy(true);
  });

  it('should map POType correctly', () => {
    expect(PurchasingUtils.mapPOType('A')).toBe('Asset');
    expect(PurchasingUtils.mapPOType('EXPENSE')).toBe('Expense');
    expect(PurchasingUtils.mapPOType('')).toBe('Select PO Type');
    expect(PurchasingUtils.mapPOType('X')).toBe('X');
  });

  it('should reset selection', () => {
    const setSelected = jasmine.createSpy();
    const incrementResetKey = jasmine.createSpy();
    PurchasingUtils.resetSelection(setSelected, incrementResetKey);
    expect(setSelected).toHaveBeenCalledWith([]);
    expect(incrementResetKey).toHaveBeenCalled();
  });

  it('should scroll table to top if element exists', () => {
    const mockElement = {
      scrollTop: 100
    } as HTMLElement;

    spyOn(document, 'getElementsByClassName').and.returnValue({
      0: mockElement,
      length: 1,
      item: () => mockElement
    } as unknown as HTMLCollectionOf<Element>);

    PurchasingUtils.scrollTableToTop();
    expect(mockElement.scrollTop).toBe(0);
  });

  it('should handle scroll event at bottom', () => {
    const callback = jasmine.createSpy();
    const event = {
      target: {
        scrollTop: 400,
        offsetHeight: 300,
        scrollHeight: 700
      }
    };
    PurchasingUtils.onScroll(event, callback);
    expect(callback).toHaveBeenCalled();
  });

  it('should not call callback if not at bottom', () => {
    const callback = jasmine.createSpy();
    const event = {
      target: {
        scrollTop: 100,
        offsetHeight: 100,
        scrollHeight: 1000
      }
    };
    PurchasingUtils.onScroll(event, callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should perform search and set query params', () => {
    const fetch = jasmine.createSpy();
    const scroll = jasmine.createSpy();
    const reset = jasmine.createSpy();
    const setParams = jasmine.createSpy();

    PurchasingUtils.onSearch(
      { searchBy: 'POID', searchValue: '123' },
      fetch,
      scroll,
      reset,
      setParams
    );

    expect(setParams).toHaveBeenCalledWith({ POID: '123' });
    expect(fetch).toHaveBeenCalledWith(false, { POID: '123' });
    expect(scroll).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });

  it('should clear search', () => {
    const fetch = jasmine.createSpy();
    const scroll = jasmine.createSpy();
    const reset = jasmine.createSpy();
    const setParams = jasmine.createSpy();
    const clearForm = jasmine.createSpy();

    PurchasingUtils.onClearSearch(fetch, scroll, reset, setParams, clearForm);

    expect(clearForm).toHaveBeenCalled();
    expect(setParams).toHaveBeenCalledWith({});
    expect(fetch).toHaveBeenCalledWith(false, {});
  });

  it('should switch tab and fetch data if tab changes', () => {
    const setTab = jasmine.createSpy();
    const clear = jasmine.createSpy();
    const setParams = jasmine.createSpy();
    const fetch = jasmine.createSpy();
    const fetchCounts = jasmine.createSpy();
    const scroll = jasmine.createSpy();
    const reset = jasmine.createSpy();

    PurchasingUtils.onTabChanged(
      'A',
      'B',
      setTab,
      clear,
      setParams,
      fetch,
      fetchCounts,
      scroll,
      reset
    );

    expect(setTab).toHaveBeenCalledWith('A');
    expect(clear).toHaveBeenCalled();
    expect(setParams).toHaveBeenCalledWith({});
    expect(fetch).toHaveBeenCalled();
    expect(fetchCounts).toHaveBeenCalled();
    expect(scroll).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });

  it('should not switch tab if same tab selected', () => {
    const setTab = jasmine.createSpy();

    PurchasingUtils.onTabChanged(
      'A',
      'A',
      setTab,
      () => {},
      () => {},
      () => {},
      () => {},
      () => {},
      () => {}
    );

    expect(setTab).not.toHaveBeenCalled();
  });

  it('should generate and export Excel file', () => {
    const columns = [
      { field: 'POID', header: 'POID' },
      { field: 'POType', header: 'Type', type: 'select' }
    ];
    const rows = [
      { POID: '123', POType: 'A' },
      { POID: '456', POType: 'T' }
    ];

    const spyWrite = spyOn(XLSX, 'writeFile').and.stub();

    PurchasingUtils.onExportClicked(columns, rows, 'test.xlsx');

    expect(spyWrite).toHaveBeenCalledWith(jasmine.anything(), 'test.xlsx');
  });

  it('should open alert dialog (submit)', () => {
    const dialogMock = {
      open: jasmine.createSpy().and.returnValue({
        afterClosed: () => ({
          subscribe: (fn: any) => fn(true)
        })
      })
    };

    const afterClose = jasmine.createSpy();

    PurchasingUtils.openSubmitDialog(dialogMock as any, [{ POID: '1' }], [{ field: 'POID' }], afterClose);

    expect(dialogMock.open).toHaveBeenCalled();
    expect(afterClose).toHaveBeenCalledWith(true);
  });

  it('should open alert dialog (register)', () => {
    const dialogMock = {
      open: jasmine.createSpy().and.returnValue({
        afterClosed: () => ({
          subscribe: (fn: any) => fn(true)
        })
      })
    };

    const afterClose = jasmine.createSpy();

    PurchasingUtils.openRegisterDialog(dialogMock as any, [{ POID: '1' }], [{ field: 'POID' }], afterClose);

    expect(dialogMock.open).toHaveBeenCalled();
    expect(afterClose).toHaveBeenCalledWith(true);
  });

  it('should call confirmLocalPurchaseOrderType', () => {
    const notify = jasmine.createSpy();
    const onSuccess = jasmine.createSpy();
    const onError = jasmine.createSpy();

    const mockService = {
      confirmLocalPurchaseOrderType: () => ({
        subscribe: (observer: any) => observer.next()
      })
    };

    const rows = [{ POID: 'P1', RevisionID: 'R1', No: 1 }];

    PurchasingUtils.submitPOTypeConfirmation(
      'Local Purchase',
      mockService as any,
      rows,
      'A',
      notify,
      onSuccess,
      onError
    );

    expect(notify).toHaveBeenCalledWith(jasmine.stringMatching('Confirmed Asset'));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('should call confirmOverseaPurchaseOrderType', () => {
    const notify = jasmine.createSpy();
    const onSuccess = jasmine.createSpy();
    const onError = jasmine.createSpy();

    const mockService = {
      confirmOverseaPurchaseOrderType: () => ({
        subscribe: (observer: any) => observer.next()
      })
    };

    const rows = [{ POID: 'P2', ProductID: 'PID', ProductNo: 2 }];

    PurchasingUtils.submitPOTypeConfirmation(
      'Oversea Purchase',
      mockService as any,
      rows,
      'A',
      notify,
      onSuccess,
      onError
    );

    expect(notify).toHaveBeenCalledWith(jasmine.stringMatching('Confirmed Asset'));
    expect(onSuccess).toHaveBeenCalled();
  });
});
