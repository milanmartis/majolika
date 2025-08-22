// app/auth/google-redirect.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, User } from 'app/services/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `<p>Prihlasujem…</p>`
})
export class GoogleRedirectComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  async ngOnInit(): Promise<void> {
    // 1) hash (#access_token=...) – relay varianta
    let accessToken: string | null = null;
    let error: string | null = null;

    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      accessToken = hashParams.get('access_token');
      error = hashParams.get('error');
    }

    // 2) fallback: query (?access_token=...)
    const qp = this.route.snapshot.queryParamMap;
    accessToken ??= qp.get('access_token');
    error ??= qp.get('error');

    if (error) {
      this.cleanUrl();
      await this.router.navigate(['/login'], { queryParams: { error } });
      return;
    }

    if (!accessToken) {
      this.cleanUrl();
      await this.router.navigate(['/login'], { queryParams: { error: 'missing_token' } });
      return;
    }

    // skry hash/query z URL
    this.cleanUrl();

    try {
      const { jwt, user } = await this.auth.finishGoogleLogin(accessToken);

      // Ak sme v popupe: pošli výsledok a zavri sa
      if (window.opener && window.opener !== window) {
        const origin = new URL(location.origin).origin; // FE origin
        window.opener.postMessage(
          { type: 'oauth-result', payload: { jwt, user } },
          origin
        );
        window.close();
        return; // už nič nerob
      }

      // Inak klasický redirect v tom istom okne
      this.auth.handleThirdPartyLogin(jwt, user as User);
      await this.router.navigateByUrl('/');
    } catch {
      await this.router.navigate(['/login'], { queryParams: { error: 'callback_failed' } });
    }
  }

  private cleanUrl(): void {
    const clean = this.router.createUrlTree(['/connect/google/redirect']).toString();
    history.replaceState({}, '', clean);
  }
}
