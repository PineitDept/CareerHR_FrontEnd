import { Component, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IconComponent {
  @Input({ required: true }) name: string = '';
  @Input({ required: true }) size: number = 24;
  @Input() fill: string = 'currentColor';
  @Input() extraClass: string = '';

  svgHtml: SafeHtml | null = null;
  isLoading: boolean = true;
  hasError: boolean = false;

  constructor(
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadIcon();
  }

  ngOnChanges() {
    // Reload icon if name changes
    if (this.name) {
      this.loadIcon();
    }
  }

  private loadIcon() {
    this.isLoading = true;
    this.hasError = false;
    this.svgHtml = null;
    
    const path = `assets/icons/icon-${this.name}.svg`;
    this.http.get(path, { responseType: 'text' }).subscribe({
      next: (svg) => {
        let modifiedSvg = svg
          .replace(/<\?xml.*?\?>/g, '') // remove XML declaration
          .replace(/<!DOCTYPE.*?>/g, '') // remove DOCTYPE
          .replace(/fill=".*?"/g, ''); // remove all fill

        if (this.name === 'eye-off') {
          // Remove all existing strokes and apply a new stroke at the root SVG element
          modifiedSvg = modifiedSvg
            .replace(/stroke=".*?"/g, '')
            .replace('<svg', `<svg stroke="var(--icon-color, ${this.fill})" fill="none" width="${this.size}" height="${this.size}"`);
        } else {
          // For general icons
          modifiedSvg = modifiedSvg.replace('<svg', `<svg fill="var(--icon-color, ${this.fill})" width="${this.size}" height="${this.size}"`);
        }

        this.svgHtml = this.sanitizer.bypassSecurityTrustHtml(modifiedSvg);
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.warn(`Could not load icon: ${this.name}`, error);
        this.svgHtml = null;
        this.isLoading = false;
        this.hasError = true;
        this.cdr.markForCheck();
      }
    });
  }
}