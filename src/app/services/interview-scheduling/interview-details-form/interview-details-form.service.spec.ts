import { TestBed } from '@angular/core/testing';

import { InterviewDetailsFormService } from './interview-details-form.service';

describe('InterviewDetailsFormService', () => {
  let service: InterviewDetailsFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InterviewDetailsFormService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
