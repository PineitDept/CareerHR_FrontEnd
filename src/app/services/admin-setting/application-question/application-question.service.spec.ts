import { TestBed } from '@angular/core/testing';

import { ApplicationQuestionService } from './application-question.service';

describe('ApplicationQuestionService', () => {
  let service: ApplicationQuestionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ApplicationQuestionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
