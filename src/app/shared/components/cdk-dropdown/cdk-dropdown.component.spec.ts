import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CdkDropdownComponent } from './cdk-dropdown.component';

describe('CdkDropdownComponent', () => {
  let component: CdkDropdownComponent;
  let fixture: ComponentFixture<CdkDropdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CdkDropdownComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CdkDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
