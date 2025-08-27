import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QualityDialogComponent } from './quality-dialog.component';

describe('QualityDialogComponent', () => {
  let component: QualityDialogComponent;
  let fixture: ComponentFixture<QualityDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [QualityDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QualityDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
