import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthLayoutComponent } from './auth-layout.component';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';

@Component({
  selector: 'app-header-main',
  template: '<div>Mock Header</div>'
})
class MockHeaderMainComponent {}

@Component({
  selector: 'router-outlet',
  template: '<div>Mock Router Outlet</div>'
})
class MockRouterOutletComponent {}

describe('AuthLayoutComponent', () => {
  let component: AuthLayoutComponent;
  let fixture: ComponentFixture<AuthLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        AuthLayoutComponent,
        MockHeaderMainComponent,
        MockRouterOutletComponent
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create AuthLayoutComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should render header and router outlet', () => {
    const header = fixture.debugElement.query(By.css('app-header-main'));
    const outlet = fixture.debugElement.query(By.css('router-outlet'));

    expect(header).toBeTruthy();
    expect(outlet).toBeTruthy();
  });

  it('should center content and limit max width', () => {
    // Find the div with a class that wraps around the router-outlet
    const wrapper = fixture.debugElement.query(By.css('.tw-px-4'));

    expect(wrapper).toBeTruthy();
    const classList = wrapper.nativeElement.className;

    expect(classList).toContain('tw-max-w-[500px]');
    expect(classList).toContain('tw-min-w-[320px]');
    expect(classList).toContain('tw-w-full');
  });

  it('should use full height layout', () => {
    const rootDiv = fixture.debugElement.query(By.css('div'));

    expect(rootDiv.nativeElement.className).toContain('tw-min-h-screen');
    expect(rootDiv.nativeElement.className).toContain('bg-gray-dark-1');
  });
});
