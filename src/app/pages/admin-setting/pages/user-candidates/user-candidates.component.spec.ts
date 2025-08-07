import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserCandidatesComponent } from './user-candidates.component';

describe('UserCandidatesComponent', () => {
  let component: UserCandidatesComponent;
  let fixture: ComponentFixture<UserCandidatesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserCandidatesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserCandidatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
