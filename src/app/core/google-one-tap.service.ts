import { Injectable, inject } from '@angular/core';
import { AuthService } from 'app/services/auth.service';
import { environment } from 'environments/environment';

declare global {
  interface Window { google: { accounts?: { id?: any } } }
}

@Injectable({ providedIn: 'root' })
export class GoogleOneTapService {
  private auth = inject(AuthService);
  private initialized = false;



  initOnce() {
    if (this.initialized) return;
    if (this.auth.isAuthenticatedSync()) return;
    // nechcem One Tap na vlastnej redirect stránke
    if (location.pathname.startsWith('/connect/')) return;

    const boot = (): void => {
        const g = window.google?.accounts?.id;
        if (!g) { 
        setTimeout(boot, 200); // NEVRACAJ túto hodnotu
        return;
    }

      g.initialize({
        client_id: environment.googleClientId,
        callback: (resp: any) => {
          const credential = resp?.credential;
          if (credential) this.auth.handleGoogleCredential(credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        // use_fedcm_for_prompt je defaultne on, nechaj tak
      });

      // Toto zobrazí malý One Tap prompt vpravo hore
      g.prompt();

      this.initialized = true;
    };
    boot();
  }
}
