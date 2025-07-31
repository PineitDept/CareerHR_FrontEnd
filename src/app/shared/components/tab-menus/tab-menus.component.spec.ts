import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabMenusComponent } from './tab-menus.component';
import { SidebarService } from '../../services/sidebar/sidebar.service';
import { Component, Input } from '@angular/core';
import { of, Subject } from 'rxjs';

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

describe('TabMenusComponent', () => {
  let component: TabMenusComponent;
  let fixture: ComponentFixture<TabMenusComponent>;
  let sidebarServiceMock: any;

  beforeEach(async () => {
    sidebarServiceMock = {
      sidebarWidth$: of(300),
      getSidebarWidth: () => 300
    };

    await TestBed.configureTestingModule({
      declarations: [
        TabMenusComponent,
        MockIconComponent
      ],
      providers: [
        { provide: SidebarService, useValue: sidebarServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TabMenusComponent);
    component = fixture.componentInstance;

    component.tabs = [
      { label: 'Tab1', count: 1 },
      { label: 'Tab2', count: 2 }
    ];
    component.activeTab = 'Tab1';

    fixture.autoDetectChanges(true);
    await fixture.whenStable();
  });

  it('should create TabMenusComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should select default tab on init', () => {
    expect(component.selectedTab).toBe('Tab1');
  });

  it('should emit tabChanged on selectTab', () => {
    spyOn(component.tabChanged, 'emit');
    component.selectTab('Tab2');
    expect(component.selectedTab).toBe('Tab2');
    expect(component.tabChanged.emit).toHaveBeenCalledWith('Tab2');
  });

  it('should set isCompact = true when remainingWidth < 1100', () => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);
    component.isCompact = false;
    const detectChangesSpy = spyOn(component['cdr'], 'detectChanges').and.callThrough();

    component.evaluateWidth(300); // remaining = 700
    expect(component.isCompact).toBeTrue();
    expect(detectChangesSpy).toHaveBeenCalled();
  });

  it('should set isCompact = false when remainingWidth >= 1100', () => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1400);
    component.isCompact = true;
    const detectChangesSpy = spyOn(component['cdr'], 'detectChanges').and.callThrough();

    component.evaluateWidth(200); // remaining = 1200
    expect(component.isCompact).toBeFalse();
    expect(detectChangesSpy).toHaveBeenCalled();
  });

  it('should NOT call detectChanges when isCompact does not change', () => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1400);
    component.isCompact = false;
    const detectChangesSpy = spyOn(component['cdr'], 'detectChanges').and.callThrough();

    component.evaluateWidth(200); // remaining = 1200
    expect(component.isCompact).toBeFalse();
    expect(detectChangesSpy).not.toHaveBeenCalled();
  });

  it('should clean up on ngOnDestroy', () => {
    const destroy$ = (component as any).destroy$ as Subject<void>;
    spyOn(destroy$, 'next');
    spyOn(destroy$, 'complete');

    component.ngOnDestroy();

    expect(destroy$.next).toHaveBeenCalled();
    expect(destroy$.complete).toHaveBeenCalled();
  });
});
