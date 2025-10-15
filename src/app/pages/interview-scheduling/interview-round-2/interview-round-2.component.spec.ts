import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewRound2Component } from './interview-round-2.component';

describe('InterviewRound2Component', () => {
  let component: InterviewRound2Component;
  let fixture: ComponentFixture<InterviewRound2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InterviewRound2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterviewRound2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
