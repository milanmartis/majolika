// cookie-consent.component.ts
import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CookieConsentService } from 'app/services/cookie-consent.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  styles: [`
  .cm{position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding:16px;z-index:9999; pointer-events:auto;}
  .cm--bar{background:rgba(0,0,0,0.6);
  .cm__body{pointer-events:auto;max-width:720px;width:100%;border-radius:var(--corners);background:#fff;padding:20px;font:14px/1.4 system-ui,Segoe UI,Roboto,Arial}
  .cm__title{margin:0 0 2px;font-size:18px}
  .cm__desc{margin:0 0 6px;color:#444}
  .cm__btns{display:flex;gap:2px;flex-wrap:wrap;justify-content:space-between;align-items:center}
  .cm__btn-group{display:flex;gap:8px;flex-wrap:wrap}
  .cm__btn{border:1px solid #ddd;border-radius:var(--corners);background:#f6f6f6;padding:8px 12px;cursor:pointer}
  .cm__btn:hover{background:#eee;color:var(--base-blue);}
  .cm__btn--primary{background:var(--base-blue);color:#fff;border-color:var(--base-blue);}

  .cm__btn--secondary{background:#fff}
  .cm__panel{margin-top:12px;border-top:1px solid #eee;padding-top:12px}
  .cm__row{display:flex;align-items:flex-start;gap:8px;margin:8px 0}
  .cm__row label{font-weight:600}
  .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
  `],
  template: `
  <div
    *ngIf="visible()"
    class="cm cm--bar cm--top"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cm__title"
    aria-describedby="cm__desc">
    <div class="cm__body">
        <img src="/assets/img/logo-SLM-modre.gif" alt="" style="width:108px; height:108px; float:left; margin-right:12px; margin-top:4px;"/>
      <div class="cm__texts">
        <h2 id="cm__title" class="cm__title">{{ 'cookie.title' | translate }}</h2>
        <p id="cm__desc" class="cm__desc" [innerHTML]="'cookie.desc' | translate"></p>
      </div>

      <div class="cm__btns">
        <div class="cm__btn-group">
          <button type="button" class="cm__btn cm__btn--primary" (click)="acceptAll()">
            {{ 'cookie.acceptAll' | translate }}
          </button>
          <button type="button" class="cm__btn" (click)="rejectAll()">
            {{ 'cookie.rejectAll' | translate }}
          </button>
        </div>
        <div class="cm__btn-group">
          <button type="button" class="cm__btn cm__btn--secondary" (click)="toggleSettings()">
            {{ 'cookie.openSettings' | translate }}
          </button>
        </div>
      </div>

      <div class="cm__panel" *ngIf="showSettings()">
        <div class="cm__row">
          <input id="cc-necessary" type="checkbox" [checked]="true" disabled aria-describedby="cc-necessary-desc"/>
          <label for="cc-necessary">{{ 'cookie.categories.necessary.title' | translate }}</label>
        </div>
        <p id="cc-necessary-desc" class="cm__desc">{{ 'cookie.categories.necessary.desc' | translate }}</p>

        <div class="cm__row">
          <input id="cc-analytics" type="checkbox" [(ngModel)]="analytics"/>
          <label for="cc-analytics">{{ 'cookie.categories.analytics.title' | translate }}</label>
        </div>
        <p class="cm__desc">{{ 'cookie.categories.analytics.desc' | translate }}</p>

        <div class="cm__btns" style="margin-top:8px">
          <div class="cm__btn-group">
            <button type="button" class="cm__btn cm__btn--primary" (click)="saveCustom()">
              {{ 'cookie.save' | translate }}
            </button>
            <button type="button" class="cm__btn" (click)="acceptAll()">
              {{ 'cookie.acceptAll' | translate }}
            </button>
            <button type="button" class="cm__btn" (click)="rejectAll()">
              {{ 'cookie.rejectAll' | translate }}
            </button>
          </div>
        </div>
      </div>

      <span class="sr-only" aria-live="polite">{{ live() }}</span>
    </div>
  </div>
  `
})
export class CookieConsentComponent {
  private svc = inject(CookieConsentService);
  private i18n = inject(TranslateService);

  visible = signal<boolean>(this.svc.shouldShowPrompt());
  showSettings = signal(false);
  analytics = true;
  live = signal(''); // pre screen readery

  ngOnInit() {
    // ak chceš automaticky skryť po tom, čo už consent existuje
    this.svc.consentChanges.subscribe(c => {
      if (c) {
        this.visible.set(false);
        this.live.set(this.i18n.instant('cookie.live.saved'));
      }
    });
  }

  toggleSettings() { this.showSettings.update(v => !v); }

  acceptAll() {
    this.svc.acceptAll();
  }

  rejectAll() {
    this.analytics = false;
    this.svc.rejectAll();
  }

  saveCustom() {
    this.svc.saveCustom({ analytics: !!this.analytics });
  }

  // ESC zatvorí panel nastavení (nie banner)
  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.showSettings()) this.showSettings.set(false);
  }
}
