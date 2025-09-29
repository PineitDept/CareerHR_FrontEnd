import { TestBed } from '@angular/core/testing';

import { InterviewFormService } from './interview-form.service';

describe('InterviewFormService', () => {
  let service: InterviewFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InterviewFormService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
