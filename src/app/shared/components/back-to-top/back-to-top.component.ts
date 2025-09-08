import { Component, EventEmitter, Input, NgZone, Output } from '@angular/core';

@Component({
  selector: 'app-back-to-top',
  templateUrl: './back-to-top.component.html',
  styleUrl: './back-to-top.component.scss'
})
export class BackToTopComponent {
  @Input() threshold = 120;
  @Input() sentinelSelector?: string;
  @Input() containerSelector?: string;

  @Input() buttonClass =
    'tw-fixed tw-bottom-6 tw-right-6 tw-rounded-full tw-h-14 tw-w-14 ' +
    'tw-flex tw-items-center tw-justify-center tw-shadow-xl ' +
    'bg-red-blood hover:bg-maroon-1 tw-text-white tw-z-[60]';

  @Input() iconName = 'arrow-upward';
  @Input() iconSize = 26;
  @Input() ariaLabel = 'Back to top';

  @Output() clicked = new EventEmitter<void>();

  show = false;

  private io?: IntersectionObserver;
  private scrollTarget: Window | Element = window;
  private scrollHandler = () => {};
  private sentinelEl: Element | null = null; // <-- เพิ่ม

  constructor(private zone: NgZone) {}

  ngOnInit(): void {
    // เลือก container ที่จะฟัง scroll
    if (this.containerSelector) {
      const el = document.querySelector(this.containerSelector);
      if (el) this.scrollTarget = el;
    }

    // หา sentinel แล้วเก็บอ้างอิงไว้
    this.sentinelEl = this.sentinelSelector
      ? document.querySelector(this.sentinelSelector)
      : null;

    if (this.sentinelEl && 'IntersectionObserver' in window) {
      this.io = new IntersectionObserver(
        ([entry]) => this.zone.run(() => (this.show = !entry.isIntersecting)),
        {
          root: this.scrollTarget instanceof Window ? null : (this.scrollTarget as Element),
          threshold: 0.01,
        }
      );
      this.io.observe(this.sentinelEl);
    } else {
      // fallback: scroll listener
      this.zone.runOutsideAngular(() => {
        this.scrollHandler = () => {
          const scrolled =
            this.scrollTarget instanceof Window
              ? window.pageYOffset ||
                document.documentElement.scrollTop ||
                document.body.scrollTop ||
                0
              : (this.scrollTarget as Element).scrollTop;
          const visible = scrolled > this.threshold;
          if (visible !== this.show) {
            this.zone.run(() => (this.show = visible));
          }
        };
        (this.scrollTarget as any).addEventListener('scroll', this.scrollHandler, { passive: true });
      });
      this.scrollHandler(); // sync ครั้งแรก
    }
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
    if (this.scrollHandler) {
      (this.scrollTarget as any).removeEventListener('scroll', this.scrollHandler);
    }
  }

  onClick() {
    // ถ้ามี sentinel ให้เลื่อนไปหา sentinel (ทำงานกับ container ใดๆ ได้อัตโนมัติ)
    if (this.sentinelEl) {
      (this.sentinelEl as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // ไม่มีก็ fallback ไป scrollToTop เดิม
      this.scrollToTop();
    }
    this.clicked.emit();
  }

  private scrollToTop() {
    if (this.scrollTarget instanceof Window) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }, 350);
    } else {
      (this.scrollTarget as Element).scrollTo({ top: 0, behavior: 'smooth' as ScrollBehavior });
      setTimeout(() => ((this.scrollTarget as Element).scrollTop = 0), 350);
    }
  }
}
