import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should emit true when show() is called once', (done) => {
    const emitted: boolean[] = [];

    service.isLoading$().subscribe(value => emitted.push(value));

    service.show();

    setTimeout(() => {
      expect(emitted).toEqual([false, true]);
      done();
    }, 0);
  });

  it('should emit false when hide() is called after one show()', (done) => {
    const emitted: boolean[] = [];

    service.isLoading$().subscribe(value => emitted.push(value));

    service.show();  // true
    service.hide();  // false

    setTimeout(() => {
      expect(emitted).toEqual([false, true, false]);
      done();
    }, 0);
  });

  it('should not emit false until all show() calls are hidden', (done) => {
    const emitted: boolean[] = [];

    service.isLoading$().subscribe(value => emitted.push(value));

    service.show(); // count = 1 → emit true
    service.show(); // count = 2 → no emit
    service.hide(); // count = 1 → no emit
    service.hide(); // count = 0 → emit false

    setTimeout(() => {
      expect(emitted).toEqual([false, true, false]);
      done();
    }, 0);
  });

  it('should not emit multiple true for repeated show()', (done) => {
    const emitted: boolean[] = [];

    service.isLoading$().subscribe(value => emitted.push(value));

    service.show(); // emit true
    service.show(); // no emit
    service.show(); // no emit

    setTimeout(() => {
      expect(emitted).toEqual([false, true]);
      done();
    }, 0);
  });

  it('should not emit multiple false for repeated hide() after zero', (done) => {
    const emitted: boolean[] = [];

    service.isLoading$().subscribe(value => emitted.push(value));

    service.show();  // true
    service.hide();  // false
    service.hide();  // no emit
    service.hide();  // no emit

    setTimeout(() => {
      expect(emitted).toEqual([false, true, false]);
      done();
    }, 0);
  });

  it('should not allow loadingCount to go below zero', (done) => {
    /** ------- @ts-expect-error: access private for testing purpose ------- **/
    const getCount = () => service['loadingCount'];

    service.hide(); // count = 0
    service.hide();
    service.hide();

    setTimeout(() => {
      expect(getCount()).toBe(0);
      done();
    }, 0);
  });
});
