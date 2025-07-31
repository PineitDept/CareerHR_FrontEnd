import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterComponent } from './filter.component';
import { Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { Component, Input } from '@angular/core';
import dayjs from 'dayjs';

@Component({
  selector: 'app-icon',
  template: ''
})
class MockIconComponent {
  @Input() name: string = '';
  @Input() size: number = 16;
}

describe('FilterComponent', () => {
  let component: FilterComponent;
  let fixture: ComponentFixture<FilterComponent>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [FilterComponent, MockIconComponent],
      providers: [{ provide: Router, useValue: routerSpy }]
    }).compileComponents();

    fixture = TestBed.createComponent(FilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create FilterComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should emit buttonClicked when dynamic action button clicked', () => {
    spyOn(component.buttonClicked, 'emit');
    component.actionButtons = [{ label: 'Submit', key: 'submit', color: '#000' }];
    component.selectedRows = [{}];
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const submitButton = buttons.find(
      btn => btn.nativeElement.textContent.trim() === 'Submit'
    );
    expect(submitButton).toBeDefined();

    submitButton!.nativeElement.click();
    expect(component.buttonClicked.emit).toHaveBeenCalledWith('submit');
  });

  it('should navigate back to correct route', () => {
    Object.defineProperty(routerSpy, 'url', { get: () => '/purchasing/asset-po/details' });
    component.onBackClick();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/purchasing/asset-po']);
  });

  it('should toggle year dropdown', () => {
    expect(component.isYearOpen).toBeFalse();
    component.toggleDropdown('year');
    expect(component.isYearOpen).toBeTrue();
    expect(component.isMonthOpen).toBeFalse();
  });

  it('should toggle month dropdown', () => {
    expect(component.isMonthOpen).toBeFalse();
    component.toggleDropdown('month');
    expect(component.isMonthOpen).toBeTrue();
    expect(component.isYearOpen).toBeFalse();
  });

  it('should update selected year and recalculate months', () => {
    const prevYear = String(component.currentYear - 1);
    component.selectOption('year', prevYear);
    expect(component.selectedYear).toBe(prevYear);
    expect(component.selectedMonth).toBe('All');
  });

  it('should update selected month', () => {
    component.selectOption('month', 'March');
    expect(component.selectedMonth).toBe('March');
  });

  it('should update selected department', () => {
    component.selectOption('company', 'PMC');
    expect(component.selectedCompany).toBe('PMC');
  });

  it('should emit correct date range for full past year', () => {
    const spy = spyOn(component.dateRangeSelected, 'emit');
    const year = String(component.currentYear - 2);
    component.selectOption('year', year);
    component.selectOption('month', 'All');

    expect(spy).toHaveBeenCalledWith({
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`
    });
  });

  it('should emit current month range correctly', () => {
    const spy = spyOn(component.dateRangeSelected, 'emit');
    component.selectOption('month', component.allMonths[component.currentMonth]);

    expect(spy).toHaveBeenCalledWith({
      startDate: dayjs(new Date(component.currentYear, component.currentMonth, 1)).format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD')
    });
  });

  it('should emit full current year if All List clicked', () => {
    const spy = spyOn(component.dateRangeSelected, 'emit');
    component.onAllListClick();

    expect(spy).toHaveBeenCalledWith({
      startDate: `${component.currentYear}-01-01`,
      endDate: dayjs().format('YYYY-MM-DD')
    });
  });

  it('should disable submit button if no selectedRows', () => {
    component.actionButtons = [{ label: 'Submit', key: 'submit' }];
    component.selectedRows = []; // ไม่มี row
    component.disabledKeys = [];
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('button'));
    const submitButton = buttons.find(
      btn => btn.nativeElement.textContent.trim() === 'Submit'
    );
    expect(submitButton).toBeDefined();
    expect(submitButton!.nativeElement.disabled).toBeTrue();
  });

  it('should close dropdowns when clicking outside', () => {
    component.isYearOpen = true;
    component.isMonthOpen = true;
    fixture.detectChanges();

    const fakeEvent = {
      target: document.createElement('div')
    } as unknown as MouseEvent;

    component.handleClickOutside(fakeEvent);

    expect(component.isYearOpen).toBeFalse();
    expect(component.isMonthOpen).toBeFalse();
  });
});
