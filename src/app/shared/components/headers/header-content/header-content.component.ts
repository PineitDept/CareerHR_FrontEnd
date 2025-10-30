import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  OnDestroy,
  AfterViewInit
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { SidebarService } from '../../../services/sidebar/sidebar.service';
import { JobPositionService } from '../../../../services/admin-setting/job-position/job-position.service';
import { CdkDropdownComponent } from '../../cdk-dropdown/cdk-dropdown.component';

@Component({
  selector: 'app-header-content',
  templateUrl: './header-content.component.html',
  styleUrls: ['./header-content.component.scss']
})
export class HeaderContentComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) headerName: string = '';
  @Input({ required: true }) headerType: string = '';
  @Input() SearchJob = false;
  @Input() selectedJobId: number | null = null;
  @Input() searchByOptions: string[] = [];
  @Input() searchForm = { searchBy: '', searchValue: '' };
  @Output() search = new EventEmitter<{ searchBy: string; searchValue: string }>();
  @Output() clearSearch = new EventEmitter<void>();
  @Output() jobSearch = new EventEmitter<number>();

  @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLDivElement>;
  isNarrow = false;
  isDropdownOpenBy = false;
  private destroy$ = new Subject<void>();

  @ViewChild(CdkDropdownComponent) jobDropdown!: CdkDropdownComponent;
  jobpositionList: any;

  constructor(
    private sidebarService: SidebarService,
    private jobPositionService: JobPositionService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    if (this.SearchJob) {
      this.fetchJobPosition();
    }
  }

  ngAfterViewInit(): void {
    this.sidebarService.sidebarWidth$
      .pipe(takeUntil(this.destroy$))
      .subscribe((sidebarWidth) => {
        this.calculateHeaderContentWidth(sidebarWidth);
      });

    this.calculateHeaderContentWidth(this.sidebarService.getSidebarWidth());
  }

  @HostListener('window:resize')
  onResize() {
    this.calculateHeaderContentWidth(this.sidebarService.getSidebarWidth());
  }

  private calculateHeaderContentWidth(sidebarWidth: number) {
    const screenWidth = window.innerWidth;
    const remainingWidth = screenWidth - sidebarWidth;
    const shouldBeNarrow = remainingWidth < 1030;

    if (this.isNarrow !== shouldBeNarrow) {
      this.isNarrow = shouldBeNarrow;
      this.cdr.detectChanges();
    }
  }

  toggleDropdown(type: 'by') {
    if (type === 'by') {
      this.isDropdownOpenBy = !this.isDropdownOpenBy;
      // this.isDropdownOpenValue = false;
    }
  }

  selectOption(type: 'by', value: string) {
    if (type === 'by') {
      this.searchForm.searchBy = value;
      // this.selectedSearchBy = value;
      this.isDropdownOpenBy = false;
      this.searchForm.searchValue = '';
    }
  }

  onSearchClick() {
    this.search.emit(this.searchForm);
  }

  onClearClick() {
    this.selectedJobId = null;
    this.searchForm = { searchBy: '', searchValue: '' };
    this.clearSearch.emit();

    this.jobDropdown.clear(true);
  }

  @HostListener('document:click', ['$event'])
  onOutsideClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container-by')) this.isDropdownOpenBy = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchJobPosition() {
    this.jobPositionService.setEMailType('job-position');
    this.jobPositionService.getAllJobTemplates().subscribe({
      next: (res) => {
        const list = res.items ?? [];

        const filteredPositions = (list as any[])
        // .filter(x =>
        //   x?.isActive !== false && x?.status === 31
        // );

        this.jobpositionList = filteredPositions.map(loc => ({
          label: loc.namePosition,
          value: loc.idjobPst
        }));
      },
      error: (error) => {
        console.error('Error fetching category types:', error);
      }
    });
  }

  onJobChange(selectedValue: number) {
    this.selectedJobId = selectedValue;
    this.jobSearch.emit(selectedValue)
  }
}
