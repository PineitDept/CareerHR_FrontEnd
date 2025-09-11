import { Component } from '@angular/core';
import { FormBuilder,FormGroup } from '@angular/forms';
import { Columns } from '../../../../../../../../shared/interfaces/tables/column.interface';

@Component({
  selector: 'app-score-details',
  templateUrl: './score-details.component.html',
  styleUrl: './score-details.component.scss'
})
export class ScoreDetailsComponent {

  filterButtons: { label: string; key: string; color: string }[] = [];
  disabledKeys: string[] = [];

  scoreType: number = 0;
  scoreName: string = '';
  formDetails!: FormGroup;

  scoreColumns: Columns = [
    { header: 'No.', field: 'index', type: 'text', align: 'center', width: '6%' },
    { header: 'Detail', field: 'detail', type: 'text', width: '69%' },
    { header: 'Status', field: 'activeStatus', type: 'toggle', align: 'center', width: '7%' },
    { header: 'Action', field: 'textlink', type: 'textlink', align: 'center', width: '18%', textlinkActions: ['view'] }
  ];

  scoreRows: any[] = [];
  scoreDetailsRows: any[] = [];

  constructor(

  ) { }

  ngOnInit() { }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'save': this.onSaveClicked(); break;
    }
  }

  onSaveClicked() {
    console.log('Save button clicked');
  }

  onAddScoreTypeClicked() {
    console.log('Add button clicked');
  }

  onRowClicked(row: any, action: 'view' | 'edit') {
    console.log('Row clicked:', row, action);
  }

  onToggleChangeCategory(e: { row: any; checked: boolean; checkbox: HTMLInputElement }) {
    console.log('Toggle change:', e);
  }
}
