import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OfferEmploymentListComponent } from './offer-employment-list.component';

describe('OfferEmploymentListComponent', () => {
  let component: OfferEmploymentListComponent;
  let fixture: ComponentFixture<OfferEmploymentListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OfferEmploymentListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OfferEmploymentListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
