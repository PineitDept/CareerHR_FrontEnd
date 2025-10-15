import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmChangesDialogComponent } from './confirm-changes-dialog.component';

describe('ConfirmChangesDialogComponent', () => {
  let component: ConfirmChangesDialogComponent;
  let fixture: ComponentFixture<ConfirmChangesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConfirmChangesDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfirmChangesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
