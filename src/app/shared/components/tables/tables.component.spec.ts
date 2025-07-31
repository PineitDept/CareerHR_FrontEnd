// import { ComponentFixture, TestBed } from '@angular/core/testing';
// import { TablesComponent } from './tables.component';
// import { Component, Input } from '@angular/core';
// import { By } from '@angular/platform-browser';
// import { defaultColumns } from '../../../constants/purchasing/purchasing.constants';

// @Component({
//   selector: 'app-icon',
//   template: '',
// })
// class MockIconComponent {
//   @Input() name: string = '';
//   @Input() size: number = 24;
//   @Input() fill: string = '';
//   @Input() extraClass: string = '';
// }

// describe('TablesComponent', () => {
//   let component: TablesComponent;
//   let fixture: ComponentFixture<TablesComponent>;

//   const mockRows = [
//     {
//       Company: 'XYZ',
//       ReceiveDate: new Date('2024-01-01'),
//       PODate: new Date('2024-01-02'),
//       POID: 1234,
//       ProductName: 'Printer',
//       SupplierName: 'ABC Ltd.',
//       Purpose: 'Office Use',
//       Amount: 10000,
//       RequestBy: 'Alice',
//       PurchaseBy: 'Bob',
//       Category: 'IT',
//       POType: 'A',
//     },
//     {
//       Company: 'XYZ2',
//       ReceiveDate: new Date('2024-02-01'),
//       PODate: new Date('2024-02-02'),
//       POID: 5678,
//       ProductName: 'Monitor',
//       SupplierName: 'DEF Ltd.',
//       Purpose: 'Upgrade',
//       Amount: 20000,
//       RequestBy: 'Carol',
//       PurchaseBy: 'Dave',
//       Category: 'Office',
//       POType: '',
//     },
//   ];

//   beforeEach(async () => {
//     await TestBed.configureTestingModule({
//       declarations: [TablesComponent, MockIconComponent],
//     }).compileComponents();

//     fixture = TestBed.createComponent(TablesComponent);
//     component = fixture.componentInstance;

//     component.columns = defaultColumns(() => {});
//     component.rows = JSON.parse(JSON.stringify(mockRows));
//     component.showCheckbox = true;
//     fixture.detectChanges();
//   });

//   it('should create TablesComponent', () => {
//     expect(component).toBeTruthy();
//   });

//   it('should render correct headers', () => {
//     const headers = fixture.debugElement.queryAll(By.css('thead th'));
//     expect(headers.length).toBe(component.columns.length + 1); // +1 for checkbox
//   });

//   it('should toggle row selection on checkbox', () => {
//     component.toggleSelectRow(0);
//     expect(component.selectedRows.has(0)).toBeTrue();
//     component.toggleSelectRow(0);
//     expect(component.selectedRows.has(0)).toBeFalse();
//   });

//   it('should emit selected rows when selecting one', () => {
//     spyOn(component.selectionChanged, 'emit');
//     component.toggleSelectRow(0);
//     expect(component.selectionChanged.emit).toHaveBeenCalledWith([component.rows[0]]);
//   });

//   it('should emit selected rows when selecting all', () => {
//     spyOn(component.selectionChanged, 'emit');
//     component.onHeaderCheckboxClick(new MouseEvent('mousedown'));
//     expect(component.selectionChanged.emit).toHaveBeenCalledWith(component.rows);
//   });

//   it('should clear selection when header checkbox clicked twice', () => {
//     component.onHeaderCheckboxClick(new MouseEvent('mousedown')); // select all
//     component.onHeaderCheckboxClick(new MouseEvent('mousedown')); // clear
//     expect(component.selectedRows.size).toBe(0);
//   });

//   it('should update indeterminate state correctly', () => {
//     component.toggleSelectRow(0);
//     fixture.detectChanges();
//     const checkbox = component.selectAllCheckbox.nativeElement;
//     expect(checkbox.indeterminate).toBeTrue();
//   });

//   it('should call rowClicked when clicking a row', () => {
//     spyOn(component.rowClicked, 'emit');
//     const rowEl = fixture.debugElement.query(By.css('tbody tr'));
//     rowEl.triggerEventHandler('click', { target: rowEl.nativeElement });
//     expect(component.rowClicked.emit).toHaveBeenCalled();
//   });

//   it('should not call rowClicked when clicking checkbox', () => {
//     spyOn(component.rowClicked, 'emit');
//     const checkbox = fixture.debugElement.query(By.css('input[type=checkbox]'));
//     checkbox.triggerEventHandler('click', {
//       target: checkbox.nativeElement,
//     });
//     expect(component.rowClicked.emit).not.toHaveBeenCalled();
//   });

//   it('should toggle dropdown', () => {
//     const key = '0_POType';
//     expect(component.isDropdownOpen(0, 'POType')).toBeFalse();
//     component.toggleDropdown(0, 'POType');
//     expect(component.isDropdownOpen(0, 'POType')).toBeTrue();
//   });

//   it('should select dropdown option', () => {
//     component.selectDropdownOption(0, 'POType', 'Asset');
//     expect(component.rows[0]['POType']).toBe('Asset');
//     expect(component.isDropdownOpen(0, 'POType')).toBeFalse();
//   });

//   it('should reset selection when resetKey changes', () => {
//     spyOn(component.selectionChanged, 'emit');
//     component.selectedRows.add(0);
//     component.resetKey = 1;
//     component.ngOnChanges({
//       resetKey: {
//         currentValue: 1,
//         previousValue: 0,
//         firstChange: false,
//         isFirstChange: () => false,
//       },
//     });
//     expect(component.selectedRows.size).toBe(0);
//     expect(component.selectionChanged.emit).toHaveBeenCalledWith([]);
//   });

//   it('should close dropdowns when clicking outside', () => {
//     component.toggleDropdown(0, 'POType');
//     expect(component.isDropdownOpen(0, 'POType')).toBeTrue();

//     const event = new MouseEvent('click');
//     Object.defineProperty(event, 'target', {
//       value: document.createElement('div'),
//       writable: false,
//     });

//     component.onOutsideClick(event);
//     expect(component.isDropdownOpen(0, 'POType')).toBeFalse();
//   });

//   it('should not close dropdown when clicking inside .tw-relative', () => {
//     component.toggleDropdown(0, 'POType');
//     expect(component.isDropdownOpen(0, 'POType')).toBeTrue();

//     const div = document.createElement('div');
//     div.classList.add('tw-relative');

//     const event = new MouseEvent('click');
//     Object.defineProperty(event, 'target', {
//       value: div,
//       writable: false,
//     });

//     component.onOutsideClick(event);
//     expect(component.isDropdownOpen(0, 'POType')).toBeTrue();
//   });

//   it('should run ngAfterViewInit and update indeterminate state', () => {
//     spyOn(component, 'updateIndeterminateState');
//     component.ngAfterViewInit();
//     expect(component.updateIndeterminateState).toHaveBeenCalled();
//   });

//   it('should run ngAfterViewChecked and update indeterminate state', () => {
//     spyOn(component, 'updateIndeterminateState');
//     component.ngAfterViewChecked();
//     expect(component.updateIndeterminateState).toHaveBeenCalled();
//   });
// });
