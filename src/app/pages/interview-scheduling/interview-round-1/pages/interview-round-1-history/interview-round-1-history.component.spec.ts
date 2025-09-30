import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewRound1HistoryComponent } from './interview-round-1-history.component';

describe('InterviewRound1HistoryComponent', () => {
  let component: InterviewRound1HistoryComponent;
  let fixture: ComponentFixture<InterviewRound1HistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InterviewRound1HistoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterviewRound1HistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
