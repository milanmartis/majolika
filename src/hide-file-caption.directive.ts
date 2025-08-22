import { AfterViewInit, Directive, ElementRef } from '@angular/core';

@Directive({
  selector: '[appHideFileNameFigcaptions]',
})
export class HideFileNameFigcaptionsDirective implements AfterViewInit {
  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const root = this.host.nativeElement;
    const caps = root.querySelectorAll('figcaption');
    const fileLike = /\.[a-z0-9]{2,5}$/i; // koncovky typu .jpg, .png, .webp, ...

    caps.forEach(c => {
      const text = (c.textContent || '').trim();
      if (fileLike.test(text)) {
        c.style.display = 'none'; // alebo: c.remove();
      }
    });
  }
}
