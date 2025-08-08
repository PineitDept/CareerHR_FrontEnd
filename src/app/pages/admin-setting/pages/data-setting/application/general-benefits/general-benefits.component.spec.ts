import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeneralBenefitsComponent } from './general-benefits.component';

describe('GeneralBenefitsComponent', () => {
  let component: GeneralBenefitsComponent;
  let fixture: ComponentFixture<GeneralBenefitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GeneralBenefitsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeneralBenefitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
