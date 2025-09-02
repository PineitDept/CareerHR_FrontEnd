import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { defaultColumns, defaultFilterButtons } from '../../../../app/constants/admin-setting/interviewer.constants';
import { InterviewerService } from '../../../../app/services/admin-setting/interviewer/interviewer.service';
import { Router } from '@angular/router';
import { SearchForm } from '../../../interfaces/interview-scheduling/interview.interface';

const SEARCH_OPTIONS: string[] = [
  'University',
  'University ID'
] as const;

@Component({
  selector: 'app-appointment-list',
  templateUrl: './appointment-list.component.html',
  styleUrl: './appointment-list.component.scss'
})
export class AppointmentListComponent {
  searchByOptions = SEARCH_OPTIONS;
  searchForm: SearchForm = { searchBy: '', searchValue: '' };

  constructor(
    private interviewerService: InterviewerService,
    private router: Router,
  ) { }

  ngOnInit() {
    // this.fetchTeamID();
  }

  // fetchTeamID() {
  //   this.interviewerService.getAllTeams().subscribe({
  //     next: (response) => {
  //       this.rows = (response.items ?? []).map((item: any, idx: number) => ({
  //         ...item,
  //         activeStatus: item.isActive,
  //         no: idx + 1
  //       }));
  //       queueMicrotask(() => this.measureOverflow());
  //     },
  //     error: (error) => {
  //       console.error('Error fetching category types:', error);
  //     }
  //   });
  // }

  // onSearch(form: SearchForm): void {
  //   // this.searchSubject.next(form);
  //   this.searchForm = form;
  //   this.persistSearchForm(this.searchForm);
  //   this.searchSubject.next({
  //     ...form,
  //     __marker: Date.now()
  //   } as any);
  // }
}
