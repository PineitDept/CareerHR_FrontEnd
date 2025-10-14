import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplicationFormDetailsComponent } from './application-form-details.component';

describe('ApplicationFormDetailsComponent', () => {
  let component: ApplicationFormDetailsComponent;
  let fixture: ComponentFixture<ApplicationFormDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ApplicationFormDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplicationFormDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
