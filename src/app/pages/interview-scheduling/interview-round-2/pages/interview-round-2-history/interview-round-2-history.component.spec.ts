import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewRound2HistoryComponent } from './interview-round-2-history.component';

describe('InterviewRound2HistoryComponent', () => {
  let component: InterviewRound2HistoryComponent;
  let fixture: ComponentFixture<InterviewRound2HistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InterviewRound2HistoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterviewRound2HistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
