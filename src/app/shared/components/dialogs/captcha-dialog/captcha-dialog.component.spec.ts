import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CaptchaDialogComponent } from './captcha-dialog.component';

describe('CaptchaDialogComponent', () => {
  let component: CaptchaDialogComponent;
  let fixture: ComponentFixture<CaptchaDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CaptchaDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CaptchaDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
