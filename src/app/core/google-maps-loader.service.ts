import { Injectable } from '@angular/core';

/**
 * Načíta Google Maps JS len na požiadanie (lazy), nie v index.html na každej
 * stránke. Mapa je len na stránke „informacie", takže homepage ani ostatné
 * stránky zbytočne neťahajú ~256 kB Maps JS do kritickej cesty (lepší LCP).
 */
@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private promise?: Promise<void>;
  private readonly url =
    'https://maps.googleapis.com/maps/api/js?key=AIzaSyC57XSUvZIf3w9MJvA5pjfPxGlMY_jHZ70&libraries=marker&v=weekly';

  load(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve(); // SSR guard
    if ((window as any).google?.maps) return Promise.resolve();
    if (this.promise) return this.promise;

    this.promise = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('google-maps-js') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Google Maps load error')));
        return;
      }
      const s = document.createElement('script');
      s.id = 'google-maps-js';
      s.src = this.url;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Google Maps load error'));
      document.head.appendChild(s);
    });
    return this.promise;
  }
}
