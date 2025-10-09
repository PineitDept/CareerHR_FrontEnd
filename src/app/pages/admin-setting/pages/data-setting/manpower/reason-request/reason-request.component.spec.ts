import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReasonRequestComponent } from './reason-request.component';

describe('ReasonRequestComponent', () => {
  let component: ReasonRequestComponent;
  let fixture: ComponentFixture<ReasonRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ReasonRequestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReasonRequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
