import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LanguageSkillsComponent } from './language-skills.component';

describe('LanguageSkillsComponent', () => {
  let component: LanguageSkillsComponent;
  let fixture: ComponentFixture<LanguageSkillsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LanguageSkillsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LanguageSkillsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
