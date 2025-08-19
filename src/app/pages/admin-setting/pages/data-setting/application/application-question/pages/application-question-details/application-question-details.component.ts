import { Component } from '@angular/core';
import { defaultDetailsFilterButtons } from '../../../../../../../../constants/admin-setting/application-question.constants';
import { ActivatedRoute } from '@angular/router';
import { ApplicationQuestionService } from '../../../../../../../../services/admin-setting/application-question/application-question.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Columns } from '../../../../../../../../shared/interfaces/tables/column.interface';

@Component({
  selector: 'app-application-question-details',
  templateUrl: './application-question-details.component.html',
  styleUrl: './application-question-details.component.scss'
})
export class ApplicationQuestionDetailsComponent {
  filterButtons = defaultDetailsFilterButtons();
  disabledKeys: string[] = [];

  categoryType: string = '';
  questionSet: any[] = [];

  formDetails!: FormGroup;

  categoryColumns: Columns = [
    {
      header: 'No.',
      field: 'no',
      type: 'text',
      align: 'center',
    },
    {
      header: 'Category Name',
      field: 'categoryName',
      type: 'text',
    },
    {
      header: 'Status',
      field: 'activeStatus',
      type: 'toggle',
      align: 'center',
    },
    {
      header: 'Action',
      field: 'textlink',
      type: 'textlink',
      align: 'center',
      width: '15%',
      textlinkActions: ['view'],
    }
  ];

  categoryRows: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private applicationQuestionService: ApplicationQuestionService,
    private fb: FormBuilder,
  ) { }

  ngOnInit() {
    this.initializeForm();

    this.route.queryParams.subscribe(params => {
      this.categoryType = params['categoryType'] || '';
      this.formDetails.patchValue({
        CategoryTypeName: this.categoryType
      });
      this.fetchCategoryTypesDetails();
    });
  }

  initializeForm() {
    // ต้องมี this.formDetails = ...
    this.formDetails = this.fb.group({
      CategoryTypeName: [''],
      activeStatus: [true],
    });
  }

  toggleActive(): void {
    const ctrl = this.formDetails.get('activeStatus');
    const current = !!ctrl?.value;
    ctrl?.setValue(!current);
    ctrl?.markAsDirty();
    ctrl?.markAsTouched();
  }

  onAddClicked() {
    // TODO: เปิด modal / นำทางไปหน้าเพิ่ม Category / เพิ่มแถวใหม่ ฯลฯ
    console.log('Add Category clicked');
  }

  fetchCategoryTypesDetails() {
    this.applicationQuestionService.getCategoryTypesInfoQuestionDetails(this.categoryType).subscribe({
      next: (response) => {
        console.log('Category types details fetched successfully:', response);
        this.questionSet = response ?? []
      },
      error: (error) => {
        console.error('Error fetching category types details:', error);
      },
    });
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'edit':
        this.onEditClicked();
        break;
      case 'save':
        this.onSaveClicked();
        break;
    }
  }

  onEditClicked() {
    console.log('Edit button clicked');
  }

  onSaveClicked() {
    console.log('Save button clicked');
  }

  onToggleChange(event: Event): void {
    console.log('Toggle change event:', event);
  }

  onViewRowClicked(row: any) {
    console.log('View row clicked:', row);
  }
}
