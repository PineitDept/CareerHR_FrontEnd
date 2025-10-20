import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainLayoutComponent } from './main-layout.component';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';

// Mock Components
@Component({
  selector: 'app-header-main',
  template: '<div>Mock Header</div>'
})
class MockHeaderMainComponent {}

@Component({
  selector: 'app-sidebar',
  template: '<div>Mock Sidebar</div>'
})
class MockSidebarComponent {
  sidebarWidth: string = '200px';
}

@Component({
  selector: 'router-outlet',
  template: '<div>Mock Router</div>'
})
class MockRouterOutlet {}

describe('MainLayoutComponent', () => {
  let component: MainLayoutComponent;
  let fixture: ComponentFixture<MainLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        MainLayoutComponent,
        MockHeaderMainComponent,
        MockSidebarComponent,
        MockRouterOutlet
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create MainLayoutComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should render header in fixed top div', () => {
    const headerDiv = fixture.debugElement.query(By.css('.tw-fixed.tw-top-0.tw-left-0.tw-right-0.tw-h-20'));
    expect(headerDiv).toBeTruthy();
    expect(headerDiv.query(By.css('app-header-main'))).toBeTruthy();
  });

  it('should render sidebar with correct width and classes', () => {
    const sidebarEl = fixture.debugElement.query(By.css('app-sidebar'));
    const sidebarWrapper = sidebarEl.parent!;
    expect(sidebarWrapper.styles['width']).toBe('200px');
    expect(sidebarWrapper.nativeElement.className).toContain('tw-fixed');
    expect(sidebarWrapper.nativeElement.className).toContain('tw-top-20');
  });

  it('should apply correct marginLeft and classes to content', () => {
    const outlet = fixture.debugElement.query(By.css('router-outlet'));
    const contentDiv = outlet.parent!;
    expect(contentDiv.styles['marginLeft']).toBe('200px');
    expect(contentDiv.nativeElement.className).toContain('tw-overflow-y-auto');
    expect(contentDiv.nativeElement.className).toContain('tw-h-[calc(100dvh-5rem)]');
  });

  it('should render router-outlet', () => {
    const outlet = fixture.debugElement.query(By.css('router-outlet'));
    expect(outlet).toBeTruthy();
  });
});
