import { TestBed } from '@angular/core/testing';

import { UserWebService } from './user-web.service';

describe('UserWebService', () => {
  let service: UserWebService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserWebService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
