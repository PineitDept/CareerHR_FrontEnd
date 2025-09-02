import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewerTeamsComponent } from './interviewer-teams.component';

describe('InterviewerTeamsComponent', () => {
  let component: InterviewerTeamsComponent;
  let fixture: ComponentFixture<InterviewerTeamsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InterviewerTeamsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterviewerTeamsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
