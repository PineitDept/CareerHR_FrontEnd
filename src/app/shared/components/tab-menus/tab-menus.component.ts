import {
  Component,
  EventEmitter,
  Input,
  Output,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  HostListener,
  ChangeDetectorRef
} from '@angular/core';
import { SidebarService } from '../../services/sidebar/sidebar.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-tab-menus',
  templateUrl: './tab-menus.component.html',
  styleUrl: './tab-menus.component.scss'
})
export class TabMenusComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) tabs: { key: string; label: string; count: number }[] = [];
  @Input() activeTab: string = '';
  @Output() tabChanged = new EventEmitter<string>();

  @ViewChild('wrapperRef') wrapperRef!: ElementRef<HTMLDivElement>; 

  selectedTab: string = '';
  isCompact = false;

  private destroy$ = new Subject<void>();

  constructor(
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const defaultTab = this.activeTab || this.tabs[0]?.key || '';
    this.selectTab(defaultTab);
  }

  ngAfterViewInit() {
    this.sidebarService.sidebarWidth$
      .pipe(takeUntil(this.destroy$))
      .subscribe((sidebarWidth) => {
        this.evaluateWidth(sidebarWidth);
      });

    // Initial
    this.evaluateWidth(this.sidebarService.getSidebarWidth());
  }

  @HostListener('window:resize')
  onResize() {
    this.evaluateWidth(this.sidebarService.getSidebarWidth());
  }

  evaluateWidth(sidebarWidth: number) {
    const screenWidth = window.innerWidth;
    const remainingWidth = screenWidth - sidebarWidth;
    const shouldBeCompact = remainingWidth < 1100;

    if (this.isCompact !== shouldBeCompact) {
      this.isCompact = shouldBeCompact;
      this.cdr.detectChanges();
    }
  }

  selectTab(tab: string) {
    this.selectedTab = tab;
    this.tabChanged.emit(tab);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
