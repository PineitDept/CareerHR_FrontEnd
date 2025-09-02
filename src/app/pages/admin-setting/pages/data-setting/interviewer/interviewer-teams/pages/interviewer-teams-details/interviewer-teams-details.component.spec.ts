import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewerTeamsDetailsComponent } from './interviewer-teams-details.component';

describe('InterviewerTeamsDetailsComponent', () => {
  let component: InterviewerTeamsDetailsComponent;
  let fixture: ComponentFixture<InterviewerTeamsDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InterviewerTeamsDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterviewerTeamsDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
