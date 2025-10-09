import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InterviewRound1Component } from './interview-round-1.component';

describe('InterviewRound1Component', () => {
  let component: InterviewRound1Component;
  let fixture: ComponentFixture<InterviewRound1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InterviewRound1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InterviewRound1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
