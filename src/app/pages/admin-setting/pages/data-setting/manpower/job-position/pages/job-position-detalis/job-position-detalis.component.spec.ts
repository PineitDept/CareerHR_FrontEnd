import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobPositionDetalisComponent } from './job-position-detalis.component';

describe('JobPositionDetalisComponent', () => {
  let component: JobPositionDetalisComponent;
  let fixture: ComponentFixture<JobPositionDetalisComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [JobPositionDetalisComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JobPositionDetalisComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
