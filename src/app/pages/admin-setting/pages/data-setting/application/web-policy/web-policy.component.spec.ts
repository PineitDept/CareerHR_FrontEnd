import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebPolicyComponent } from './web-policy.component';

describe('WebPolicyComponent', () => {
  let component: WebPolicyComponent;
  let fixture: ComponentFixture<WebPolicyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [WebPolicyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WebPolicyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
