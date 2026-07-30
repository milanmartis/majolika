import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  OnInit,
} from '@angular/core';

/**
 * Jemný fade-in obrázka po načítaní (moderný „reveal“ efekt).
 * - obrázok začína priehľadný, po `load` sa plynulo zobrazí,
 * - ak je už v cache (load event nepríde), nastaví sa hneď cez `complete`,
 * - pri chybe sa tiež „odomkne“, aby nezostal neviditeľný.
 *
 * Použitie: <img appImageFade ... />
 */
@Directive({
  selector: 'img[appImageFade]',
  standalone: true,
})
export class ImageFadeDirective implements OnInit {
  @HostBinding('class.img-fade') readonly base = true;
  @HostBinding('class.img-loaded') loaded = false;

  constructor(private el: ElementRef<HTMLImageElement>) {}

  ngOnInit(): void {
    const img = this.el.nativeElement;
    // Obrázok už načítaný z cache -> load event by nemusel prísť.
    if (img.complete && img.naturalWidth > 0) {
      this.loaded = true;
    }
  }

  @HostListener('load')
  onLoad(): void {
    this.loaded = true;
  }

  @HostListener('error')
  onError(): void {
    // Nenechaj obrázok zaseknutý ako neviditeľný, keď sa nepodarí načítať.
    this.loaded = true;
  }
}
