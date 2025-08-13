import { TestBed } from '@angular/core/testing';

import { UserCandidatesService } from './user-candidates.service';

describe('UserCandidatesService', () => {
  let service: UserCandidatesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserCandidatesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
