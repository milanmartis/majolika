// src/app/components/footer-newsletter/footer-newsletter.component.ts
import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from 'environments/environment';

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
    onTurnstileExpired?: () => void;
    turnstile?: any;
  }
}

const NEWSLETTER_ENDPOINT = `${environment.apiUrl}/newsletter/subscribe`;
const SIG_SECRET_FE = 'NLv1-const-secret'; // len slabá obfuskácia; BE musí robiť skutočnú kontrolu

@Component({
  selector: 'app-footer-newsletter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  styles: [`
    .nl-wrap {  gap:.5rem; align-items:center; }
    .nl-wrap input[type="email"]{
      flex:1; padding:.6rem .8rem; border:1px solid #ddd; border-radius:6px; font-size:14px;
    }
    .nl-wrap button{
      padding:.65rem 1rem; border:0; border-radius:6px; background:var(--base-blue,#1f3796);
      color:#fff; font-weight:600; cursor:pointer;
    }
    .nl-wrap button[disabled]{ opacity:.6; cursor:not-allowed; }
    .hp { position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; }
    .msg { margin-top:.5rem; font-size:.9rem; }
    .msg.ok { color:#2e7d32; }
    .msg.err{ color:#c62828; }
    .captcha { margin-top:.5rem; }
  `],
  template: `
    <form (ngSubmit)="submit()" [formGroup]="form" novalidate>
      <div class="nl-wrap">
        <input
          type="email"
          formControlName="email"
          [placeholder]="'FOOTER.NEWSLETTER.EMAIL_PLACEHOLDER' | translate"
          autocomplete="email"
          required
          [attr.aria-invalid]="form.controls.email.invalid ? 'true' : 'false'"
          />
        <div>
        <button type="submit" [disabled]="loading || form.invalid">
          {{ 'FOOTER.NEWSLETTER.SUBMIT' | translate }}
        </button>
      </div>
      </div>

      <!-- honeypot -->
      <div class="hp">
        <label>Do not fill</label>
        <input type="text" formControlName="hp" tabindex="-1" autocomplete="off">
      </div>

      <!-- Turnstile (len ak máme sitekey) -->
      <div *ngIf="siteKey" class="captcha">
        <div id="cf-turnstile"
             class="cf-turnstile"
             [attr.data-sitekey]="siteKey"
             data-theme="auto"
             data-callback="onTurnstileCallback">
        </div>
      </div>

      <div class="msg ok" *ngIf="okMsg">{{ okMsg }}</div>
      <div class="msg err" *ngIf="errMsg">{{ errMsg }}</div>
    </form>
  `
})
export class FooterNewsletterComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private t = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  loading = false;
  okMsg = '';
  errMsg = '';

  // Turnstile site key (ak prázdne, captcha sa nenačítava)
  siteKey = (environment as any).TURNSTILE_SITE_KEY || '';

  // token z captcha (ak používaš Turnstile)
  private captchaToken: string | null = null;

  // timestamp pre „minimum submit time“
  private ts = Date.now();

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    hp: [''],              // honeypot
  });

  ngOnInit(): void {
    if (typeof window === 'undefined') return;

    // zaregistruj global callback pre Turnstile (ak treba)
    if (this.siteKey) {
      (window as any).onTurnstileCallback = (token: string) => {
        this.captchaToken = token;
      };
      this.injectTurnstileScript();
    }
  }

  // Načíta Turnstile skript len raz
  private injectTurnstileScript() {
    if (document.getElementById('turnstile-script')) return;
    const s = document.createElement('script');
    s.id = 'turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  // jednoduchá obfuskácia – skutočná verifikácia je na BE
  private sig(email: string): string {
    try {
      return btoa(`${this.ts}:${email}:${SIG_SECRET_FE}`).slice(0, 24);
    } catch {
      return `${this.ts}_${email.length}_x`;
    }
  }

  private tr(key: string, fallback: string) {
    const v = this.t.instant(key);
    return v && v !== key ? v : fallback;
  }

  async submit() {
    this.okMsg = ''; this.errMsg = '';

    if (this.form.invalid) {
      this.errMsg = this.tr('NEWSLETTER.INVALID_EMAIL', 'Zadajte platný e-mail.');
      return;
    }

    const hp = this.form.value.hp?.trim();
    if (hp) {
      // honeypot vyplnený → bot
      this.errMsg = this.tr('NEWSLETTER.BOT_DETECTED', 'Odoslanie zablokované.');
      return;
    }

    const email = (this.form.value.email || '').trim().toLowerCase();
    const locale = (this.t.currentLang || navigator.language || 'sk').slice(0,2);

    const body: any = {
      email,
      source: 'footer',
      consent_text_version: 'v1',
      double_opt_in: false,
      locale,
      ts: this.ts,
      sig: this.sig(email),
    };

    if (this.captchaToken) body.captchaToken = this.captchaToken;

    this.loading = true;
    try {
      // preferuj sendBeacon pri unloadoch; tu normálne POST
      await this.http.post(NEWSLETTER_ENDPOINT, body, { responseType: 'json' }).toPromise();

      this.okMsg = this.tr('NEWSLETTER.OK', 'Ďakujeme, prihlásenie prebehlo.');
      this.form.reset({ email: '', hp: '' });
      this.ts = Date.now(); // reset časovača pre ďalší submit
      this.captchaToken = null;

      // ak je Turnstile, resetni widget (ak je k dispozícii)
      try { window.turnstile?.reset?.(); } catch {}
    } catch (e: any) {
      const msg = (e?.error?.error || e?.error?.message || '').toString().toLowerCase();
      if (msg.includes('rate') || e?.status === 429) {
        this.errMsg = this.tr('NEWSLETTER.RATE_LIMIT', 'Skúste prosím o chvíľu znova.');
      } else if (msg.includes('captcha')) {
        this.errMsg = this.tr('NEWSLETTER.CAPTCHA_FAIL', 'Overenie zlyhalo. Skúste znova.');
        try { window.turnstile?.reset?.(); } catch {}
      } else if (msg.includes('too_fast')) {
        this.errMsg = this.tr('NEWSLETTER.TOO_FAST', 'Skúste odoslať o sekundu neskôr.');
      } else if (msg.includes('bot')) {
        this.errMsg = this.tr('NEWSLETTER.BOT_DETECTED', 'Odoslanie zablokované.');
      } else {
        this.errMsg = this.tr('NEWSLETTER.ERROR', 'Niečo sa pokazilo. Skúste neskôr.');
      }
    } finally {
      this.loading = false;
    }
  }
}
