import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeaderContentComponent } from './header-content.component';
import { SidebarService } from '../../../services/sidebar/sidebar.service';
import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';

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

describe('HeaderContentComponent', () => {
  let component: HeaderContentComponent;
  let fixture: ComponentFixture<HeaderContentComponent>;
  let sidebarServiceMock: any;
  let cdrMock: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(async () => {
    sidebarServiceMock = {
      sidebarWidth$: of(200),
      getSidebarWidth: () => 200,
    };

    cdrMock = jasmine.createSpyObj('ChangeDetectorRef', ['detectChanges']);

    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [HeaderContentComponent, MockIconComponent],
      providers: [
        { provide: SidebarService, useValue: sidebarServiceMock },
        { provide: ChangeDetectorRef, useValue: cdrMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderContentComponent);
    component = fixture.componentInstance;
    component.headerName = 'Test Header';
    component.headerType = 'search';
    component.searchByOptions = ['POID', 'SupplierName'];
    component.searchForm = { searchBy: '', searchValue: '' };
  });

  it('should create HeaderContentComponent', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should calculate headerContentWidth and set isNarrow correctly', () => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);
    component.isNarrow = false;

    const detectChangesSpy = spyOn(
      component['cdr'] as ChangeDetectorRef,
      'detectChanges'
    );

    (component as any).calculateHeaderContentWidth(200);

    expect(component.isNarrow).toBeTrue();
    expect(detectChangesSpy).toHaveBeenCalled();
  });

  it('should calculate headerContentWidth and set isNarrow to false when width is wide enough', () => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1400);
    component.isNarrow = true;

    const detectChangesSpy = spyOn(
      component['cdr'] as ChangeDetectorRef,
      'detectChanges'
    );

    (component as any).calculateHeaderContentWidth(200);

    expect(component.isNarrow).toBeFalse();
    expect(detectChangesSpy).toHaveBeenCalled();
  });

  it('should toggle dropdown open/close', () => {
    expect(component.isDropdownOpenBy).toBeFalse();
    component.toggleDropdown('by');
    expect(component.isDropdownOpenBy).toBeTrue();
    component.toggleDropdown('by');
    expect(component.isDropdownOpenBy).toBeFalse();
  });

  it('should select "search by" option and reset value', () => {
    component.searchForm.searchBy = '';
    component.searchForm.searchValue = 'Some value';
    component.selectOption('by', 'POID');
    expect(component.searchForm.searchBy).toBe('POID');
    expect(component.searchForm.searchValue).toBe('');
    expect(component.isDropdownOpenBy).toBeFalse();
  });

  it('should emit search event when clicking Search button', () => {
    spyOn(component.search, 'emit');
    component.searchForm = { searchBy: 'POID', searchValue: '123' };
    component.onSearchClick();
    expect(component.search.emit).toHaveBeenCalledWith({ searchBy: 'POID', searchValue: '123' });
  });

  it('should emit clearSearch and reset form when clicking Clear button', () => {
    spyOn(component.clearSearch, 'emit');
    component.searchForm = { searchBy: 'POID', searchValue: 'Printer' };
    component.onClearClick();
    expect(component.searchForm).toEqual({ searchBy: '', searchValue: '' });
    expect(component.clearSearch.emit).toHaveBeenCalled();
  });

  it('should close dropdown when clicking outside', () => {
    component.isDropdownOpenBy = true;
    const fakeEvent = {
      target: document.createElement('div')
    } as unknown as MouseEvent;
    component.onOutsideClick(fakeEvent);
    expect(component.isDropdownOpenBy).toBeFalse();
  });

  it('should NOT close dropdown when clicking inside .dropdown-container-by', () => {
    component.isDropdownOpenBy = true;
    const insideElement = document.createElement('div');
    insideElement.classList.add('dropdown-container-by');
    const fakeEvent = {
      target: insideElement
    } as unknown as MouseEvent;
    component.onOutsideClick(fakeEvent);
    expect(component.isDropdownOpenBy).toBeTrue();
  });

  it('should call calculateHeaderContentWidth on resize', () => {
    spyOn<any>(component, 'calculateHeaderContentWidth');
    component.onResize();
    expect(component['calculateHeaderContentWidth']).toHaveBeenCalledWith(200);
  });

  it('should unsubscribe on destroy', () => {
    const destroy$ = component['destroy$'];
    spyOn(destroy$, 'next');
    spyOn(destroy$, 'complete');
    component.ngOnDestroy();
    expect(destroy$.next).toHaveBeenCalled();
    expect(destroy$.complete).toHaveBeenCalled();
  });

  it('should render only header when headerType is empty', () => {
    component.headerType = '';
    fixture.detectChanges();
    const searchInput = fixture.debugElement.query(By.css('input[placeholder="Search Value..."]'));
    expect(searchInput).toBeNull();
    const headerEl = fixture.debugElement.query(By.css('h2')).nativeElement;
    expect(headerEl.textContent).toContain('Test Header');
  });
});
