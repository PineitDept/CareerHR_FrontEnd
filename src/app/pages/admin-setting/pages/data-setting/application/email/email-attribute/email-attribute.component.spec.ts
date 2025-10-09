import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailAttributeComponent } from './email-attribute.component';

describe('EmailAttributeComponent', () => {
  let component: EmailAttributeComponent;
  let fixture: ComponentFixture<EmailAttributeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EmailAttributeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailAttributeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
