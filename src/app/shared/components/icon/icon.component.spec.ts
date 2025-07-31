import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';

describe('IconComponent', () => {
  let component: IconComponent;
  let fixture: ComponentFixture<IconComponent>;
  let httpMock: HttpTestingController;

  const mockSvg = `
    <?xml version="1.0"?>
    <!DOCTYPE svg>
    <svg fill="red" stroke="blue" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>
  `;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [IconComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create IconComponent', () => {
    component.name = 'user';
    component.size = 32;
    fixture.detectChanges();

    const req = httpMock.expectOne('assets/icons/icon-user.svg');
    expect(req.request.method).toBe('GET');
    req.flush(mockSvg);

    expect(component).toBeTruthy();
  });

  it('should sanitize and replace fill attributes for general icon', () => {
    component.name = 'user';
    component.fill = 'blue';
    component.size = 48;
    fixture.detectChanges();

    const req = httpMock.expectOne('assets/icons/icon-user.svg');
    req.flush(mockSvg);

    expect(component.svgHtml).toBeTruthy();
    fixture.detectChanges();

    const spanEl: DebugElement = fixture.debugElement.query(By.css('span'));
    expect(spanEl.nativeElement.innerHTML).toContain(`fill="var(--icon-color, blue)"`);
    expect(spanEl.nativeElement.innerHTML).toContain(`width="48"`);
    expect(spanEl.nativeElement.innerHTML).not.toContain(`<?xml`);
    expect(spanEl.nativeElement.innerHTML).not.toContain(`<!DOCTYPE`);
  });

  it('should replace stroke and remove fill for eye-off icon', () => {
    component.name = 'eye-off';
    component.fill = 'red';
    component.size = 16;
    fixture.detectChanges();

    const req = httpMock.expectOne('assets/icons/icon-eye-off.svg');
    req.flush(mockSvg);

    fixture.detectChanges();
    const innerHTML = fixture.nativeElement.querySelector('span').innerHTML;
    expect(innerHTML).toContain(`stroke="var(--icon-color, red)"`);
    expect(innerHTML).toContain(`fill="none"`);
    expect(innerHTML).toContain(`width="16"`);
  });

  it('should apply extraClass to span', () => {
    component.name = 'check';
    component.extraClass = 'icon-large';
    fixture.detectChanges();

    const req = httpMock.expectOne('assets/icons/icon-check.svg');
    req.flush(mockSvg);

    fixture.detectChanges();
    const spanEl = fixture.debugElement.query(By.css('span.app-icon'));
    expect(spanEl.nativeElement.classList).toContain('icon-large');
  });
});
