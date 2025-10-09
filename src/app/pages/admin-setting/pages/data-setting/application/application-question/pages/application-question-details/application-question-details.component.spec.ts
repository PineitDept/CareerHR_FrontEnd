import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplicationQuestionDetailsComponent } from './application-question-details.component';

describe('ApplicationQuestionDetailsComponent', () => {
  let component: ApplicationQuestionDetailsComponent;
  let fixture: ComponentFixture<ApplicationQuestionDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ApplicationQuestionDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplicationQuestionDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
