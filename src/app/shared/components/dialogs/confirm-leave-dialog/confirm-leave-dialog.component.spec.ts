import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmLeaveDialogComponent } from './confirm-leave-dialog.component';

describe('ConfirmLeaveDialogComponent', () => {
  let component: ConfirmLeaveDialogComponent;
  let fixture: ComponentFixture<ConfirmLeaveDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConfirmLeaveDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfirmLeaveDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
