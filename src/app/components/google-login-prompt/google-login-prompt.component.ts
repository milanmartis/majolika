import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from 'app/services/auth.service';
import { environment } from 'environments/environment';
import { AuthRoutingModule } from "app/auth/auth-routing.module";
import { TranslateModule, TranslateService } from '@ngx-translate/core';


@Component({
  standalone: true,
  selector: 'app-google-login-prompt',
  imports: [CommonModule, AuthRoutingModule, TranslateModule],
  styles: [`
    .google-login-prompt {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 10000;
      max-width: 320px;
      background: #fff;
      border: 1px solid rgba(0,0,0,.12);
      border-radius: 12px;
      box-shadow: 0 6px 24px rgba(0,0,0,.18);
      padding: .9rem 1rem 1rem;
      font-family: inherit;
    }
    .google-login-prompt h3 {
      margin: 0 0 .25rem 0;
      font-size: 1.05rem;
    }
    .google-login-prompt p {
      margin: 0 0 .75rem 0;
      color: #555;
      line-height: 1.35;
      font-size: .95rem;
    }
    .glp-actions {
      display: flex;
      gap: .5rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .btn-primary {
      appearance: none;
      border: 1px solid #000;
      background: var(--base-blue);
      padding: .45rem .75rem;
      border-radius: 8px;
      cursor: pointer;
      margin:1px;
    }
    .btn-link {
      appearance: none;
      background: transparent;
      border: none;
      color: #0b57d0;
      text-decoration: underline;
      cursor: pointer;
      padding: 0 .25rem;
    }
    .close-x {
      position: absolute;
      top: .25rem;
      right: .35rem;
      border: none;
      background: transparent;
      font-size: 1.2rem;
      cursor: pointer;
      line-height: 1;
      padding: .25rem;
      color: #444;
    }
  `],
  template: `
    <div *ngIf="visible()" class="google-login-prompt" role="dialog" aria-live="polite">
      <button class="close-x" (click)="dismiss()" aria-label="Zavrieť">×</button>
      <h3>Prihlásenie</h3>
     <div class="row">
     <div class="col">
         
         <p>Prihláste sa cez Google a urýchlite nákup aj správu objednávok.</p>
         <div class="glp-actions">
             <button class="btn-primary" type="button" (click)="startGoogle();hideOnce()">Google</button>
             <button class="btn-primary" type="button" [routerLink]="['/login']" (click)="hideOnce()">Môj E-mail</button>
             <button class="btn-link" type="button" (click)="hideOnce()">Neskôr</button>
            </div>
        </div>
        <div class="col" style="width:100%; text-align:center;">
            <img src="https://d1hbdvlfav95nt.cloudfront.net/products/kvet_7cf47cab6b.jpg">
        </div>
        </div>
        `
})
export class GoogleLoginPromptComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);

  // jednoduchá per-session „Neskôr“
  private suppressed = signal<boolean>(false);

  // Ak máš v AuthService currentUser$, použi ho:
  private loggedIn = signal<boolean>(false);

  visible = computed(() => !this.loggedIn() && !this.suppressed());

  private onMessage = (ev: MessageEvent) => {
    try {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data || {};
      if (data.type !== 'oauth-result') return;

      const { jwt, user } = data.payload || {};
      if (jwt && user) {
        this.auth.handleThirdPartyLogin(jwt, user as User);
        this.loggedIn.set(true);
        this.suppressed.set(true);
      }
    } catch {
      /* ignore */
    }
  };

  ngOnInit(): void {
    // z AuthService si zober stav prihlásenia
    this.auth.currentUser$.subscribe(u => this.loggedIn.set(!!u));

    if (typeof window === 'undefined') return;

    // listener na výsledok z popupu (GoogleRedirectComponent -> postMessage)
    window.addEventListener('message', this.onMessage);
  }

  ngOnDestroy(): void {
    if (typeof window === 'undefined') return;

    window.removeEventListener('message', this.onMessage);
  }

  hideOnce() {
    this.suppressed.set(true);
  }

  dismiss() {
    this.suppressed.set(true);
  }

  startGoogle() {
    // URL na BE, ktorý spustí OAuth a pošle naspäť na FE redirect:
    // uprav si endpoint podľa BE; dôležité je redirect na FE /connect/google/redirect
    const redirectUri = `${window.location.origin}/connect/google/redirect`;
    const url = `${environment.apiUrl}/connect/google?redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&prompt=select_account`;

    const w = 520, h = 640;
    const y = window.top ? Math.max(0, (window.top.outerHeight - h) / 2) : 100;
    const x = window.top ? Math.max(0, (window.top.outerWidth - w) / 2) : 100;

    window.open(
      url,
      'google_oauth_popup',
      `width=${w},height=${h},left=${x},top=${y},resizable=yes,scrollbars=yes`
    );
  }
}
