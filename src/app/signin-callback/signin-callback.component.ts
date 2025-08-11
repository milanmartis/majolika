// signin-callback.component.ts
import { Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-signin-callback',
  template: `<p>Prihlasovanie dokončujeme...</p>`,
})
export class SigninCallbackComponent implements OnInit {
  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) {
      window.opener.postMessage({ error: 'NO_CODE' }, environment.frontendUrl);
      window.close();
      return;
    }

    // 1) Zavoláme Strapi callback na vymenu code → jwt+user
    fetch(
      `${environment.apiUrl}/connect/google/callback?code=${encodeURIComponent(code)}`,
      { credentials: 'include' }
    )
    .then(res => res.json())
    .then(payload => {
      // payload = { jwt, user }
      window.opener.postMessage({ jwt: payload.jwt, user: payload.user }, environment.frontendUrl);
      window.close();
    })
    .catch(err => {
      window.opener.postMessage({ error: err.toString() }, environment.frontendUrl);
      window.close();
    });
  }
}
