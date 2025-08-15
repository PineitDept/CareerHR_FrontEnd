import { Component } from '@angular/core';
import { defaultDetailsFilterButtons } from '../../../../../../../../constants/admin-setting/application-question.constants';
import { ActivatedRoute } from '@angular/router';
import { ApplicationQuestionService } from '../../../../../../../../services/admin-setting/application-question/application-question.service';

@Component({
  selector: 'app-application-question-details',
  templateUrl: './application-question-details.component.html',
  styleUrl: './application-question-details.component.scss'
})
export class ApplicationQuestionDetailsComponent {
  filterButtons = defaultDetailsFilterButtons();
  disabledKeys: string[] = [];

  categoryType: string = '';

  constructor(
    private route: ActivatedRoute,
    private applicationQuestionService: ApplicationQuestionService,
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      console.log('Query Params:', params);
      this.categoryType = params['categoryType'] || '';
      console.log('Category Type:', this.categoryType);
      this.fetchCategoryTypesDetails();
    });
  }

  fetchCategoryTypesDetails() {
    this.applicationQuestionService.getCategoryTypesInfoQuestionDetails(this.categoryType).subscribe({
      next: (response) => {
        console.log('Category types details fetched successfully:', response);
        // Process the response as needed
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
}
