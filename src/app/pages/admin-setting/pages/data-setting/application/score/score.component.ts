import { Component, ElementRef, ViewChild } from '@angular/core';
import { Columns } from '../../../../../../shared/interfaces/tables/column.interface';
import { ScoreService } from '../../../../../../services/score/score.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-score',
  templateUrl: './score.component.html',
  styleUrl: './score.component.scss'
})
export class ScoreComponent {

  scoreTypeRows: any[] = [];
  scoreTypeColumns: Columns = [
    {
      header: 'No.',
      field: '__index',
      type: 'text',
      align: 'center',
      width: '10%',
    },
    {
      header: 'Score Name',
      field: 'description',
      type: 'text',
      width: '60%',
    },
    {
      header: 'Status',
      field: 'activeStatus',
      type: 'toggle',
      align: 'center',
      width: '15%',
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

  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLDivElement>;
  hasOverflowY = false;
  private ro?: ResizeObserver;

  constructor(
    private scoreService: ScoreService,
    private router: Router,
  ) { }

  ngOnInit() {
    // Initialization logic can go here
    this.fetchScoreSettingTypes();
  }

  ngAfterViewInit(): void {
    this.measureOverflow();

    this.ro = new ResizeObserver(() => this.measureOverflow());
    this.ro.observe(this.scrollArea.nativeElement);
  }

  measureOverflow(): void {
    const el = this.scrollArea.nativeElement;
    this.hasOverflowY = el.scrollHeight > el.clientHeight;
  }

  fetchScoreSettingTypes() {
    this.scoreService.getScoreSettingTypes().subscribe({
      next: (response) => {
        console.log('Recruitment Stages fetched successfully:', response);
        this.scoreTypeRows = (response ?? []).map((item: any, idx: number) => ({
          ...item,
          activeStatus: true,
          no: idx + 1
        }));
        console.log('Processed scoreTypeRows:', this.scoreTypeRows);
        queueMicrotask(() => this.measureOverflow());
      },
      error: (error) => {
        console.error('Error fetching Score Setting Types:', error);
      }
    });
  }

  onViewRowClicked(row: any) {
    console.log('View row clicked:', row);
    const queryParams = {
      scoreName: row.description.split(' ').join('-'),
      scoreType: row.type
    }
    console.log('Navigating to details with params:', queryParams);
    this.router.navigate(['/admin-setting/data-setting/application/score/details'], { queryParams });
  }

  ngOnDestroy() {
    this.ro?.disconnect?.();
  }
}
