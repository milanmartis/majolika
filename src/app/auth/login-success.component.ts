import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService, User } from '../services/auth.service';

@Component({
  selector: 'app-login-success',
  template: `
    <div class="login-success-container">
      <h2>Prihlasovanie prebieha...</h2>
      <p>Čakajte, overujeme prístup.</p>
    </div>
  `,
  styles: [`
    .login-success-container {
      text-align: center;
      margin-top: 5rem;
    }
  `],
  standalone: true
})
export class LoginSuccessComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private auth: AuthService
  ) {}

  ngOnInit() {
    // 1) Čítame "code" z query parametrov
    this.route.queryParamMap.subscribe(params => {
      const code = params.get('code');
      if (!code) {
        // Chýba code → presmerujeme na login
        this.router.navigate(['/login']);
        return;
      }

      // 2) Zavoláme Strapi callback: 
      //    - použijeme presný path vrátane /api
      const callbackUrl = `${environment.apiUrl}/api/connect/google/callback`;

      const httpParams = new HttpParams()
        .set('code', code)
        // ak používate aj state alebo redirect_url, pridajte tu:
        // .set('redirect_url', `${environment.frontendUrl}/login-success`);
      
      this.http.get<{ jwt: string; user: User }>(callbackUrl, { params: httpParams })
        .subscribe({
          next: res => {
            // 3) Uložíme token a usera
            this.auth.handleThirdPartyLogin(res.jwt, res.user);
            // 4) Presmerujeme na hlavnú stránku alebo inam
            this.router.navigate(['/']);
          },
          error: err => {
            console.error('OAuth callback error', err);
            this.router.navigate(['/login']);
          }
        });
    });
  }
}
