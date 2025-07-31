import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { AlertDialogComponent } from './alert-dialog.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Component, ElementRef, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-tables',
  template: '',
})
class MockTablesComponent {
  @Input() columns: any[] = [];
  @Input() rows: any[] = [];
  @Input() showCheckbox: boolean = true;
  @Input() resetKey: number = 0;

  @Output() selectionChanged = new EventEmitter<any[]>();
  @Output() rowClicked = new EventEmitter<any>();
}

@Component({
  selector: 'app-icon',
  template: '',
})
class MockIconComponent {
  @Input() name: string = '';
  @Input() size: number = 24;
  @Input() fill: string = '';
  @Input() extraClass: string = '';
}

describe('AlertDialogComponent', () => {
  let component: AlertDialogComponent;
  let fixture: ComponentFixture<AlertDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<AlertDialogComponent>>;

  const mockData = {
    title: 'Test',
    message: 'Confirm?',
    confirm: true,
    selectedRows: [{ id: 1 }],
    poType: ['A', 'B'],
  };

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      declarations: [
        AlertDialogComponent,
        MockTablesComponent,
        MockIconComponent
      ],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useFactory: () => structuredClone(mockData)
        },
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertDialogComponent);
    component = fixture.componentInstance;

    // mock ElementRef
    component.poDropdownButton = new ElementRef(document.createElement('button'));
    component.poDropdownContainer = new ElementRef(document.createElement('div'));

    fixture.detectChanges();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should call dialogRef.close(false) on cancel', () => {
    component.onCancel();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
  });

  it('should close with selectedRows when confirm and no poType', () => {
    component.data.poType = undefined;
    component.onConfirm();
    expect(dialogRefSpy.close).toHaveBeenCalledWith({
      selectedRows: mockData.selectedRows,
    });
  });

  it('should close with selectedRows and poType when confirm and poType present', () => {
    component.selectedPOType = 'A';
    component.onConfirm();
    expect(dialogRefSpy.close).toHaveBeenCalledWith({
      selectedRows: mockData.selectedRows,
      poType: 'A',
    });
  });

  it('should close with true if not confirm dialog', () => {
    component.data.confirm = false;
    component.onConfirm();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('should toggle dropdown open and calculate position', () => {
    const button = component.poDropdownButton.nativeElement;
    button.getBoundingClientRect = () => ({
      bottom: 100,
      left: 50,
      width: 200,
    });

    component.isDropdownOpenPO = false;
    component.toggleDropdown('po');
    expect(component.isDropdownOpenPO).toBeTrue();
    expect(component.dropdownTop).toBeGreaterThan(0);
    expect(component.dropdownLeft).toBe(50);
    expect(component.dropdownWidth).toBe(200);
  });

  it('should toggle dropdown closed if already open', () => {
    component.isDropdownOpenPO = true;
    component.toggleDropdown('po');
    expect(component.isDropdownOpenPO).toBeFalse();
  });

  it('should select PO option and close dropdown', () => {
    component.selectOption('po', 'B');
    expect(component.selectedPOType).toBe('B');
    expect(component.isDropdownOpenPO).toBeFalse();
  });

  it('should not close dropdown when click inside', () => {
    const event = {
      target: component.poDropdownButton.nativeElement,
    } as MouseEvent;

    component.isDropdownOpenPO = true;
    component.handleClickOutside(event);
    expect(component.isDropdownOpenPO).toBeTrue();
  });

  it('should close dropdown when click outside', () => {
    const event = {
      target: document.createElement('div'),
    } as unknown as MouseEvent;

    component.isDropdownOpenPO = true;
    component.handleClickOutside(event);
    expect(component.isDropdownOpenPO).toBeFalse();
  });
});
