import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebPolicyDetailsComponent } from './web-policy-details.component';

describe('WebPolicyDetailsComponent', () => {
  let component: WebPolicyDetailsComponent;
  let fixture: ComponentFixture<WebPolicyDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WebPolicyDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WebPolicyDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
