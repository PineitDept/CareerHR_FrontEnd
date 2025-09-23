import { Component } from '@angular/core';

@Component({
  selector: 'app-application-form',
  templateUrl: './application-form.component.html',
  styleUrl: './application-form.component.scss'
})
export class ApplicationFormComponent {

  filterButtons: { label: string; key: string; color: string }[] = [];
  disabledKeys: string[] = [];

  constructor(

  ) { }

  ngOnInit() {
    this.filterButtons = [
      { label: 'Print', key: 'print', color: '#0055FF' },
    ];
  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'print': this.onPrintClicked(); break;
    }
  }

  onPrintClicked() {
    console.log('Print clicked');
  }
}
