import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingComponent } from './loading.component';
import { LoadingService } from '../../services/loading/loading.service';
import { Subject } from 'rxjs';
import { By } from '@angular/platform-browser';

describe('LoadingComponent', () => {
  let component: LoadingComponent;
  let fixture: ComponentFixture<LoadingComponent>;
  let loadingService: jasmine.SpyObj<LoadingService>;
  let loadingSubject: Subject<boolean>;

  beforeEach(async () => {
    loadingSubject = new Subject<boolean>();
    const loadingSpy = jasmine.createSpyObj('LoadingService', ['isLoading$']);
    loadingSpy.isLoading$.and.returnValue(loadingSubject.asObservable());

    await TestBed.configureTestingModule({
      declarations: [LoadingComponent],
      providers: [
        { provide: LoadingService, useValue: loadingSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingComponent);
    component = fixture.componentInstance;
    loadingService = TestBed.inject(LoadingService) as jasmine.SpyObj<LoadingService>;
    fixture.detectChanges();
  });

  it('should create LoadingComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should subscribe to isLoading$ on init', () => {
    expect(loadingService.isLoading$).toHaveBeenCalled();
  });

  it('should show loading spinner when isLoading$ emits true', () => {
    loadingSubject.next(true);
    fixture.detectChanges();

    const overlay = fixture.debugElement.query(By.css('div.tw-fixed'));
    expect(overlay).toBeTruthy();

    const spinner = fixture.debugElement.query(By.css('.tw-spinner'));
    expect(spinner).toBeTruthy();
  });

  it('should hide loading spinner when isLoading$ emits false', () => {
    loadingSubject.next(false);
    fixture.detectChanges();

    const overlay = fixture.debugElement.query(By.css('div.tw-fixed'));
    expect(overlay).toBeNull();
  });
});
