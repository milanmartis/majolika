import { Directive, ElementRef, Renderer2, HostListener } from '@angular/core';

@Directive({
  selector: '[appZoomPan]',
  standalone: true
})
export class ZoomPanDirective {
  /** How much to zoom */
  private readonly zoom = 2.1;

  constructor(
    private el: ElementRef<HTMLImageElement>,
    private renderer: Renderer2
  ) {
    const img = this.el.nativeElement;
    // Make sure parent clips the enlarged image
    const parent = img.parentElement;
    if (parent) {
      this.renderer.setStyle(parent, 'overflow', 'hidden');
    }

    // Base styles for the image
    this.renderer.setStyle(img, 'width', '100%');
    this.renderer.setStyle(img, 'height', '100%');
    this.renderer.setStyle(img, 'object-fit', 'cover');
    this.renderer.setStyle(
      img,
      'transition',
      'transform .25s ease, transform-origin .25s ease'
    );
    this.renderer.setStyle(img, 'display', 'block');
    // Start with centered origin
    this.renderer.setStyle(img, 'transform-origin', '50% 50%');
  }

  @HostListener('mouseenter')
  onMouseEnter() {
    // Kick off the zoom
    this.renderer.setStyle(
      this.el.nativeElement,
      'transform',
      `scale(${this.zoom})`
    );
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    const rect = this.el.nativeElement.getBoundingClientRect();
    // relative cursor coords 0…1
    let relX = (e.clientX - rect.left) / rect.width;
    let relY = (e.clientY - rect.top) / rect.height;
    // clamp just in case
    relX = Math.min(Math.max(relX, 0), 1);
    relY = Math.min(Math.max(relY, 0), 1);

    // move the transform-origin so that scaling shows the proper edge
    this.renderer.setStyle(
      this.el.nativeElement,
      'transform-origin',
      `${relX * 100}% ${relY * 100}%`
    );
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    // reset origin & scale
    this.renderer.setStyle(
      this.el.nativeElement,
      'transform-origin',
      '50% 50%'
    );
    this.renderer.setStyle(
      this.el.nativeElement,
      'transform',
      'scale(1)'
    );
  }
}
