import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReasonDetailsComponent } from './reason-details.component';

describe('ReasonDetailsComponent', () => {
  let component: ReasonDetailsComponent;
  let fixture: ComponentFixture<ReasonDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ReasonDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReasonDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
