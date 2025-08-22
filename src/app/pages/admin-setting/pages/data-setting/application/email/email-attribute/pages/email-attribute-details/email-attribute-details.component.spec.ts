import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailAttributeDetailsComponent } from './email-attribute-details.component';

describe('EmailAttributeDetailsComponent', () => {
  let component: EmailAttributeDetailsComponent;
  let fixture: ComponentFixture<EmailAttributeDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EmailAttributeDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailAttributeDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
