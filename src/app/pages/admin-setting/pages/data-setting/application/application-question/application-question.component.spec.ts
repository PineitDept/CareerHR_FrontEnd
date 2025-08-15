import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApplicationQuestionComponent } from './application-question.component';

describe('ApplicationQuestionComponent', () => {
  let component: ApplicationQuestionComponent;
  let fixture: ComponentFixture<ApplicationQuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ApplicationQuestionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApplicationQuestionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
