import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpecialBenefitsComponent } from './special-benefits.component';

describe('SpecialBenefitsComponent', () => {
  let component: SpecialBenefitsComponent;
  let fixture: ComponentFixture<SpecialBenefitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SpecialBenefitsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SpecialBenefitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
