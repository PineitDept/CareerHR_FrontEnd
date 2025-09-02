import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ReasonService } from '../../../../../../../../services/admin-setting/reason/reason.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-reason-details',
  templateUrl: './reason-details.component.html',
  styleUrl: './reason-details.component.scss'
})
export class ReasonDetailsComponent {
  filterButtons = [
    { label: 'Edit', key: 'edit', color: '#000000' },
    { label: 'Save', key: 'save', color: '#000055' },
  ];
  disabledKeys: string[] = [];

  formDetails!: FormGroup;

  processName: string = '';
  processId: number = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private reasonService: ReasonService,
    private fb: FormBuilder,
  ) { }

  ngOnInit() {

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.processName = params['processName'] || '';
        this.processId = params['processId'] || 0;

        this.fetchRecruitmentStagesWithReasons();
      });
  }

  fetchRecruitmentStagesWithReasons() {
    this.reasonService.getRecruitmentStagesWithReasons(this.processId).subscribe({
      next: (response) => {
        console.log('Recruitment Stages with reasons fetched successfully:', response);
      },
      error: (error) => {
        console.error('Error fetching Recruitment Stages with reasons:', error);
      },
    });
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit': this.onEditClicked(); break;
      case 'save': this.onSaveClicked(); break;
    }
  }

  onEditClicked() {
    console.log('Edit button clicked');
  }

  onSaveClicked() {
    console.log('Save button clicked');
  }
}
