import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  HostListener,
  ChangeDetectorRef,
  Signal,
  effect,
  DestroyRef,
  inject
} from '@angular/core';
import { SidebarService } from '../../services/sidebar/sidebar.service';
import { Subject, takeUntil } from 'rxjs';
import { TabMenu } from '../../../interfaces/Application/application.interface';

@Component({
  selector: 'app-tab-menus',
  templateUrl: './tab-menus.component.html',
  styleUrl: './tab-menus.component.scss'
})
export class TabMenusComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) tabs!: Signal<TabMenu[]>;
  @Input() activeTab!: Signal<string>;
  @Output() tabChanged = new EventEmitter<string>();

  @ViewChild('wrapperRef') wrapperRef!: ElementRef<HTMLDivElement>; 

  selectedTab: string = '';
  isCompact = false;

  private destroy$ = new Subject<void>();
  private destroyRef = inject(DestroyRef);

  constructor(
    private sidebarService: SidebarService,
    private cdr: ChangeDetectorRef,
  ) {
    // ใช้ effect เพื่อ watch การเปลี่ยนแปลงของ signals
    effect(() => {
      const currentTabs = this.tabs();
      const currentActiveTab = this.activeTab();
      
      if (currentTabs && currentTabs.length > 0) {
        // ถ้า activeTab เปลี่ยน หรือ selectedTab ยังไม่ได้ set
        if (this.selectedTab !== currentActiveTab || !this.selectedTab) {
          const tabExists = currentTabs.some(tab => tab.key === currentActiveTab);
          
          if (tabExists) {
            this.selectedTab = currentActiveTab;
          } else {
            // ถ้าไม่มี activeTab หรือไม่ตรงกับ tabs ที่มี ให้เลือก tab แรก
            this.selectedTab = currentTabs[0]?.key || '';
          }
        }
      }
    });
  }

  ngOnInit() {
    // เรียก effect แล้ว ไม่จำเป็นต้องมี logic เพิ่ม
    // effect จะจัดการ initialization ให้
  }

  ngAfterViewInit() {
    this.sidebarService.sidebarWidth$
      .pipe(takeUntil(this.destroy$))
      .subscribe((sidebarWidth) => {
        this.evaluateWidth(sidebarWidth);
      });

    // Initial evaluation
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
    const currentTabs = this.tabs();
    
    // Validate that the tab exists
    if (currentTabs && currentTabs.length > 0) {
      const tabExists = currentTabs.some(t => t.key === tab);
      if (!tabExists) {
        console.warn(`Tab '${tab}' not found. Selecting first available tab.`);
        tab = currentTabs[0].key;
      }
    }

    this.selectedTab = tab;
    this.tabChanged.emit(tab);
  }

  // Helper method สำหรับใช้ใน template
  get tabsValue(): TabMenu[] {
    return this.tabs();
  }

  get activeTabValue(): string {
    return this.activeTab();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}