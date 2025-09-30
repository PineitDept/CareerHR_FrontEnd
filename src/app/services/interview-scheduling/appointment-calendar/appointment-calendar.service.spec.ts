import { TestBed } from '@angular/core/testing';

import { AppointmentCalendarService } from './appointment-calendar.service';

describe('AppointmentCalendarService', () => {
  let service: AppointmentCalendarService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppointmentCalendarService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
