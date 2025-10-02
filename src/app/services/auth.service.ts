import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, map, distinctUntilChanged } from 'rxjs/operators';
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

  /** Normalized base URLs */
  private readonly API = environment.apiUrl.replace(/\/+$/, '');         // .../api
  private readonly BASE = environment.strapiBaseUrl.replace(/\/+$/, ''); // no /api

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public userId: number | null = null;

  /** SSR guard helpers */
  private platformId = inject(PLATFORM_ID);
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
  private get storage(): Storage | null {
    return this.isBrowser ? localStorage : null;
  }
  private get win(): Window | null {
    return this.isBrowser ? window : null;
  }

  /** Stream na rýchlu kontrolu prihlásenia v šablónach (voliteľné) */
  public isLoggedIn$ = this.currentUser$.pipe(
    map((u) => !!u || this.isAuthenticatedSync()),
    distinctUntilChanged()
  );

  constructor(private http: HttpClient, private router: Router) {
    if (this.isAuthenticatedSync()) this.loadCurrentUser();
    this.currentUser$.subscribe((u) => (this.userId = u?.id ?? null));
  }

  forgotPassword(email: string) {
    return this.http.post(`${this.API}/auth/forgot-password`, { email });
  }

  resetPassword(code: string, password: string) {
    return this.http.post(`${this.API}/auth/reset-password`, {
      code,
      password,
      passwordConfirmation: password,
    });
  }

  // voliteľné: zmena hesla pre prihláseného
  changePassword(currentPassword: string, password: string, jwt: string) {
    return this.http.post(
      `${this.API}/auth/change-password`,
      {
        currentPassword,
        password,
        passwordConfirmation: password,
      },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
  }

  // ───────── Helpers ─────────
  get token(): string | null {
    return this.storage?.getItem(this.TOKEN_KEY) ?? null;
  }

  private setToken(jwt: string | null): void {
    if (!this.storage) return; // SSR no-op
    if (jwt) this.storage.setItem(this.TOKEN_KEY, jwt);
    else this.storage.removeItem(this.TOKEN_KEY);
  }

  private isTokenValid(token: string): boolean {
    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) return true; // neočakávaný formát -> neblokuj

      // atob na klientovi, Buffer na serveri
      const json =
        this.isBrowser
          ? atob(payloadPart)
          : (globalThis as any).Buffer.from(payloadPart, 'base64').toString('utf-8');

      const payload = JSON.parse(json);
      if (!payload?.exp) return true;
      return payload.exp * 1000 > Date.now();
    } catch {
      return true; // ak decode zlyhá, nerob tvrdý logout
    }
  }

  isAuthenticatedSync(): boolean {
    if (!this.isBrowser) return false; // na serveri nemáme storage
    const t = this.token;
    return !!t && this.isTokenValid(t);
  }

  /** Synchronous snapshot pre guards/handlery */
  isLoggedIn(): boolean {
    return this.isAuthenticatedSync();
  }

  private authHeaders(): HttpHeaders {
    const t = this.token;
    return new HttpHeaders(t ? { Authorization: `Bearer ${t}` } : {});
  }

  // ───────── Google OAuth (ide na API s /api) ─────────
  loginWithGoogle(): void {
    const win = this.win;
    if (!win) return; // SSR guard
    const redirect = `${environment.frontendUrl.replace(/\/+$/, '')}/signin/callback`;
    win.location.href = `${this.API}/connect/google?redirect_url=${encodeURIComponent(redirect)}`;
  }

  async finishGoogleLogin(accessToken: string): Promise<{ jwt: string; user: User }> {
    const res = await fetch(
      `${this.API}/auth/google/callback?access_token=${encodeURIComponent(accessToken)}`,
      { credentials: 'include' }
    );
    if (!res.ok) throw new Error('Google auth failed');
    const data = await res.json();
    this.setToken(data.jwt);
    this.currentUserSubject.next(data.user);
    return data;
  }

  /** Ak používaš One Tap a vlastný endpoint na Strapi: POST /api/auth/google-token */
  handleGoogleCredential(credential: string): void {
    const win = this.win; // kvôli následnému redirectu
    this.http
      .post<{ jwt: string; user: User }>(`${this.API}/auth/google-token`, { token: credential })
      .pipe(
        tap((res) => {
          this.setToken(res.jwt);
          this.currentUserSubject.next(res.user);
        })
      )
      .subscribe({
        next: () => {
          if (win) win.location.href = environment.frontendUrl;
        },
        error: () => {
          if (win) win.location.href = '/login';
        },
      });
  }

  handleThirdPartyLogin(jwt: string, user: User): void {
    this.setToken(jwt);
    this.currentUserSubject.next(user);
  }

  // ───────── Core auth ─────────
  loadCurrentUser(): void {
    if (!this.token) {
      this.currentUserSubject.next(null);
      return;
    }
    this.http
      .get<User>(`${this.API}/users/me`, { headers: this.authHeaders() })
      .subscribe({ next: (u) => this.currentUserSubject.next(u), error: () => this.logout() });
  }

  login(identifier: string, password: string): Observable<{ jwt: string; user: User }> {
    return this.http
      .post<{ jwt: string; user: User }>(`${this.API}/auth/local`, { identifier, password })
      .pipe(
        tap((res) => {
          this.setToken(res.jwt);
          this.currentUserSubject.next(res.user);
        })
      );
  }

  register(username: string, email: string, password: string): Observable<{ jwt: string; user: User }> {
    return this.http
      .post<{ jwt: string; user: User }>(`${this.API}/auth/local/register`, { username, email, password })
      .pipe(
        tap((res) => {
          // Ak je v Strapi zapnuté email confirmation, zváž neukladať token tu.
          this.setToken(res.jwt);
          this.currentUserSubject.next(res.user);
        })
      );
  }

  updateProfile(id: number, data: Partial<User>): Observable<User> {
    return this.http
      .put<User>(`${this.API}/users/${id}`, data, { headers: this.authHeaders() })
      .pipe(tap((u) => this.currentUserSubject.next(u)));
  }

  logout(): void {
    this.setToken(null);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  // ───────── Email confirmation ─────────
  resendConfirmation(email: string, redirectUrl?: string) {
    const body: any = { email: String(email || '').trim() };
    if (redirectUrl) body.url = redirectUrl;
    return this.http.post(`${this.API}/auth/send-email-confirmation`, body);
  }

  // ───────── (voliteľné) Google popup flow ─────────
  loginWithGooglePopup(): Promise<User> {
    const win = this.win;
    if (!win) return Promise.reject(new Error('not_browser')); // SSR guard

    const ORIGIN = new URL(environment.frontendUrl || win.location.origin).origin;
    const w = 520, h = 640;
    const left = win.screenX + (win.outerWidth - w) / 2;
    const top  = win.screenY + (win.outerHeight - h) / 2;

    const popup = win.open(
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
        win.removeEventListener('message', onMessage);
        clearInterval(timer);
        try { popup?.close(); } catch {}
      };
      win.addEventListener('message', onMessage);
    });
  }
}
