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

@Component({
  selector: 'app-header-content',
  templateUrl: './header-content.component.html',
  styleUrls: ['./header-content.component.scss']
})
export class HeaderContentComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) headerName: string = '';
  @Input({ required: true }) headerType: string = '';

  @Input() searchByOptions: string[] = [];
  @Input() searchForm = { searchBy: '', searchValue: '' };
  @Output() search = new EventEmitter<{ searchBy: string; searchValue: string }>();
  @Output() clearSearch = new EventEmitter<void>();

  @ViewChild('wrapper') wrapperRef!: ElementRef<HTMLDivElement>;
  isNarrow = false;
  isDropdownOpenBy = false;
  private destroy$ = new Subject<void>();

  constructor(
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {

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
    this.searchForm = { searchBy: '', searchValue: '' };
    this.clearSearch.emit();
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
}
