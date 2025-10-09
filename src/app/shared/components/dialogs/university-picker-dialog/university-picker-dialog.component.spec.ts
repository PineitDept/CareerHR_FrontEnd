import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UniversityPickerDialogComponent } from './university-picker-dialog.component';

describe('UniversityPickerDialogComponent', () => {
  let component: UniversityPickerDialogComponent;
  let fixture: ComponentFixture<UniversityPickerDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UniversityPickerDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UniversityPickerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
