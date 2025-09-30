import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewFormDetailsComponent } from './interview-form-details.component';

describe('InterviewFormDetailsComponent', () => {
  let component: InterviewFormDetailsComponent;
  let fixture: ComponentFixture<InterviewFormDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InterviewFormDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterviewFormDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
