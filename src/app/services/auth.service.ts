import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'environments/environment';
import { Product } from './products.service';

export interface User {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
}

export interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  price: number;
  product?: Product;
}
export interface Order {
  id: number;
  userId: number;
  total: number;
  createdAt: string;
  status: 'pending' | 'paid' | 'cancelled';
  items: OrderItem[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'jwt';

  /** presne podľa tvojho environmentu */
  private readonly API = environment.apiUrl.replace(/\/+$/, '');            // .../api
  private readonly BASE = environment.strapiBaseUrl.replace(/\/+$/, '');    // bez /api

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public userId: number | null = null;

  constructor(private http: HttpClient, private router: Router) {
    if (this.isAuthenticatedSync()) this.loadCurrentUser();
    this.currentUser$.subscribe(u => (this.userId = u?.id ?? null));
  }

  // Helpers
  isAuthenticatedSync(): boolean { return !!localStorage.getItem(this.TOKEN_KEY); }
  get token(): string | null { return localStorage.getItem(this.TOKEN_KEY); }
  private authHeaders(): HttpHeaders {
    const t = this.token;
    return new HttpHeaders(t ? { Authorization: `Bearer ${t}` } : {});
  }

  // ───────── Google OAuth (všetko ide na API s /api) ─────────
  loginWithGoogle(): void {
    const redirect = `${environment.frontendUrl.replace(/\/+$/, '')}/signin/callback`;
    window.location.href = `${this.API}/connect/google?redirect_url=${encodeURIComponent(redirect)}`;
  }

  async finishGoogleLogin(accessToken: string): Promise<{ jwt: string; user: User }> {
    const res = await fetch(
      `${this.API}/auth/google/callback?access_token=${encodeURIComponent(accessToken)}`,
      { credentials: 'include' }
    );
    if (!res.ok) throw new Error('Google auth failed');
    const data = await res.json();
    localStorage.setItem(this.TOKEN_KEY, data.jwt);
    this.currentUserSubject.next(data.user);
    return data;
  }

  /** Ak používaš One Tap a vlastný endpoint na Strapi: POST /api/auth/google-token */
  handleGoogleCredential(credential: string): void {
    this.http.post<{ jwt: string; user: User }>(
      `${this.API}/auth/google-token`,
      { token: credential }
    ).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.jwt);
        this.currentUserSubject.next(res.user);
      })
    ).subscribe({
      next: () => window.location.href = environment.frontendUrl,
      error: () => window.location.href = '/login',
    });
  }

  handleThirdPartyLogin(jwt: string, user: User): void {
    localStorage.setItem(this.TOKEN_KEY, jwt);
    this.currentUserSubject.next(user);
  }

  // ───────── Core auth ─────────
  loadCurrentUser(): void {
    if (!this.token) { this.currentUserSubject.next(null); return; }
    this.http.get<User>(`${this.API}/users/me`, { headers: this.authHeaders() })
      .subscribe({ next: u => this.currentUserSubject.next(u), error: () => this.logout() });
  }

  login(identifier: string, password: string): Observable<{ jwt: string; user: User }> {
    return this.http.post<{ jwt: string; user: User }>(
      `${this.API}/auth/local`,
      { identifier, password }
    ).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.jwt);
        this.currentUserSubject.next(res.user);
      })
    );
  }

  register(username: string, email: string, password: string): Observable<{ jwt: string; user: User }> {
    return this.http.post<{ jwt: string; user: User }>(
      `${this.API}/auth/local/register`,
      { username, email, password }
    ).pipe(
      tap(res => {
        // Pozn.: ak máš v Strapi zapnuté email confirmation, zváž neukladať token tu.
        localStorage.setItem(this.TOKEN_KEY, res.jwt);
        this.currentUserSubject.next(res.user);
      })
    );
  }

  updateProfile(id: number, data: Partial<User>): Observable<User> {
    return this.http.put<User>(
      `${this.API}/users/${id}`,
      data,
      { headers: this.authHeaders() }
    ).pipe(tap(u => this.currentUserSubject.next(u)));
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  // ───────── Email confirmation ─────────
  resendConfirmation(email: string, redirectUrl?: string) {
  const body: any = { email: String(email || '').trim() };
  if (redirectUrl) body.url = redirectUrl;
  return this.http.post(`${environment.apiUrl}/auth/send-email-confirmation`, body);
}

  // ───────── (voliteľné) Google popup flow ─────────
  loginWithGooglePopup(): Promise<User> {
    const ORIGIN = new URL(environment.frontendUrl || location.origin).origin;
    const w = 520, h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top  = window.screenY + (window.outerHeight - h) / 2;

    const popup = window.open(
      `${this.API}/connect/google`,
      'google_oauth',
      `width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`
    );
    if (!popup) return Promise.reject(new Error('popup_blocked'));

    return new Promise<User>((resolve, reject) => {
      const onMessage = (ev: MessageEvent) => {
        if (ev.origin !== ORIGIN) return;
        if (!ev.data || ev.data.type !== 'oauth-result') return;
        const { jwt, user } = ev.data.payload || {};
        if (!jwt || !user) { cleanup(); reject(new Error('invalid_payload')); return; }
        this.handleThirdPartyLogin(jwt, user);
        cleanup(); resolve(user);
      };
      const timer = setInterval(() => {
        if (!popup || popup.closed) { cleanup(); reject(new Error('popup_closed')); }
      }, 500);
      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        clearInterval(timer);
        try { popup?.close(); } catch {}
      };
      window.addEventListener('message', onMessage);
    });
  }
}
