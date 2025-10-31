import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApplicationService } from '../../../services/application/application.service';
import { Subject, takeUntil } from 'rxjs';

interface Applicant {
  id: string;
  name: string;
  gpa: number;
  age?: number;
  university: string;
  appliedDate: string | Date;
  email: string;
  positions: string[];
  grade: string;
  views: number;
  avatarUrl: string;
  faculty?: string;
  program?: string;
  phone?: string;
}

@Component({
  selector: 'app-form-apply',
  templateUrl: './form-apply.component.html',
  styleUrl: './form-apply.component.scss'
})
export class FormApplyComponent {

  // ====== Routing ======
  applicantId: number = 0;
  roundID: number = 0;
  
  // ====== Data Model (View) ======
  applicant: Applicant = {
    id: '',
    name: '',
    gpa: 0,
    age: 0,
    university: '',
    appliedDate: '',
    email: '',
    positions: [],
    grade: '',
    views: 0,
    avatarUrl: '',
  };

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private applicationService: ApplicationService
  ) { }

  ngOnInit() {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applicantId = Number(params['UserID'] || 0);
        this.roundID = Number(params['Round'] || 0);
        this.fetchApplicantDetails();
        this.fetchFiles(Number(this.applicantId || 0));
      });
  }

  private fetchApplicantDetails() {
    if (!this.applicantId) return;

    this.applicationService.getApplicantDetailById(this.applicantId, this.roundID).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          console.log(res)
        }
      });
  }

  private fetchFiles(id: number) {
    if (!id) return;
    this.applicationService.getFileByCandidateId(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          const files = Array.isArray(res) ? res : [];
          const profile = files.find(f => String(f?.fileType).toLowerCase() === 'profile');
          this.applicant.avatarUrl = profile?.filePath || '';

          console.log(this.applicant.avatarUrl)
        },
        error: (e) => console.error('[ApplicationForm] getFileByCandidateId error:', e)
      });
  }
}
