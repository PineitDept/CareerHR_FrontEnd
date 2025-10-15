import { TestBed } from '@angular/core/testing';

import { GeneralBenefitsService } from '../general-benefits.service';

describe('GeneralBenefitsService', () => {
  let service: GeneralBenefitsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeneralBenefitsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
