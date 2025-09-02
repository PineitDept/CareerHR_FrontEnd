import { Component, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ReasonService } from '../../../../../../../../services/admin-setting/reason/reason.service';
import { Subject, takeUntil } from 'rxjs';
import { TablesComponent } from '../../../../../../../../shared/components/tables/tables.component';
import { Columns } from '../../../../../../../../shared/interfaces/tables/column.interface';

@Component({
  selector: 'app-reason-details',
  templateUrl: './reason-details.component.html',
  styleUrl: './reason-details.component.scss'
})
export class ReasonDetailsComponent {
  @ViewChild('categoryAcceptTable') categoryAcceptTable!: TablesComponent;
  @ViewChild('categoryDeclineTable') categoryDeclineTable!: TablesComponent;
  @ViewChild('categoryNoShowTable') categoryNoShowTable!: TablesComponent;
  @ViewChild('categoryOnHoldTable') categoryOnHoldTable!: TablesComponent;
  @ViewChild('categoryOnboardedTable') categoryOnboardedTable!: TablesComponent;

  filterButtons = [
    { label: 'Edit', key: 'edit', color: '#000000' },
    { label: 'Save', key: 'save', color: '#000055' },
  ];
  disabledKeys: string[] = [];

  formDetails!: FormGroup;

  processName: string = '';
  processId: number = 0;

  private destroy$ = new Subject<void>();

  categoryColumns: Columns = [
    { header: 'No.', field: '__index', type: 'number', align: 'center', width: '7%' },
    { header: 'Details', field: 'reasonText', type: 'text', width: '75%', wrapText: true },
    { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '18%', textlinkActions: ['edit-inrow','delete'] },
  ];

  categoryAcceptRows: any[] = [];
  categoryDeclineRows: any[] = [];
  categoryNoShowRows: any[] = [];
  categoryOnHoldRows: any[] = [];
  categoryOnboarededRows: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private reasonService: ReasonService,
    private fb: FormBuilder,
  ) { }

  ngOnInit() {

    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.processName = params['processName'].split('-').join(' ') || '';
        this.processId = params['processId'] || 0;

        this.fetchRecruitmentStagesWithReasons();
      });

    this.initializeForm();
  }

  initializeForm() {
    this.formDetails = this.fb.group({
      processName: [
        { value: this.processName, disabled: true }
      ],
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

  onAddAcceptClicked() {
    console.log('Add Accept button clicked');
  }

  onAddDeclineClicked() {
    console.log('Add Decline button clicked');
  }

  onAddNoShowClicked() {
    console.log('Add Decline button clicked');
  }

  onAddOnHoldClicked() {
    console.log('Add Decline button clicked');
  }

  onAddOnboardedClicked() {
    console.log('Add Decline button clicked');
  }
}
