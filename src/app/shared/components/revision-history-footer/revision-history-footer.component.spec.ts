import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RevisionHistoryFooterComponent } from './revision-history-footer.component';

describe('RevisionHistoryFooterComponent', () => {
  let component: RevisionHistoryFooterComponent;
  let fixture: ComponentFixture<RevisionHistoryFooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RevisionHistoryFooterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RevisionHistoryFooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
