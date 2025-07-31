import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterCheckBoxComponent } from './filter-check-box.component';

describe('FilterCheckBoxComponent', () => {
  let component: FilterCheckBoxComponent;
  let fixture: ComponentFixture<FilterCheckBoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FilterCheckBoxComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FilterCheckBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
