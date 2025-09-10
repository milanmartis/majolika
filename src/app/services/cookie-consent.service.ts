// cookie-consent.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CookieConsent } from '../models/cookie-consent.model';
import { TranslateService } from '@ngx-translate/core';

const STORAGE_KEY = 'cookieConsent';

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  private translate = inject(TranslateService);
  private requiredVersion = 1; // ↑ zvýš pri zmene politiky
  private state$ = new BehaviorSubject<CookieConsent | null>(this.load());

  consentChanges = this.state$.asObservable();

  private load(): CookieConsent | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CookieConsent;
      if (!parsed || parsed.version !== this.requiredVersion) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private save(consent: CookieConsent) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    this.state$.next(consent);
    this.applySideEffects(consent);
  }

  /** Zavolaj po štarte aplikácie (napr. v AppComponent) */
  shouldShowPrompt(): boolean {
    return this.state$.value === null;
  }

  acceptAll() {
    this.save({
      version: this.requiredVersion,
      necessary: true,
      analytics: true,
      updatedAt: new Date().toISOString(),
      locale: (this.translate.currentLang as any) ?? 'sk'
    });
  }

  rejectAll() {
    this.save({
      version: this.requiredVersion,
      necessary: true,
      analytics: false,
      updatedAt: new Date().toISOString(),
      locale: (this.translate.currentLang as any) ?? 'sk'
    });
  }

  saveCustom(partial: Pick<CookieConsent, 'analytics'>) {
    this.save({
      version: this.requiredVersion,
      necessary: true,
      analytics: partial.analytics,
      updatedAt: new Date().toISOString(),
      locale: (this.translate.currentLang as any) ?? 'sk'
    });
  }

  get snapshot(): CookieConsent | null {
    return this.state$.value;
  }

  /** Tu daj integráciu (gtag, Matomo, ...). */
  private applySideEffects(consent: CookieConsent) {
    // PRÍKLAD pre Google Consent Mode v2 (ak používaš gtag):
    // // @ts-ignore
    // window.gtag?.('consent', 'update', {
    //   analytics_storage: consent.analytics ? 'granted' : 'denied',
    // });
    //
    // Ak používaš vlastné analytické skripty, načítaj/odstráň ich tu.
  }
}
