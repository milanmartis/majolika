import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
 // address?: {
    street?: string;
    city?: string;
    zip?: string;
    country?: string;
 // };
}

export interface Order {
  id: number;
  userId: number;
  total: number; 
  createdAt: string;  
  status: 'pending' | 'paid' | 'cancelled';
  items: OrderItem[];
  
}

export interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  price: number;
  product?: Product; // optional, pre načítanie detailu produktu
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser2$ = new BehaviorSubject<User | null>(null);
  userId: number | null = null;

  private readonly TOKEN_KEY = 'jwt';
  private apiUrl = environment.apiUrl;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    if (this.isAuthenticatedSync()) {
      this.loadCurrentUser();
    }
    this.currentUser2$.subscribe((user) => {
      this.userId = user?.id ?? null;
    });
  }

  /** Synchronne overí, či máme token */
  isAuthenticatedSync(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  /** Začne OAuth Google flow */
  // loginWithGoogle() {
  //   const target = encodeURIComponent(
  //     `${environment.frontendUrl}/login-success`
  //   );
  //   window.location.href = 
  //     `${environment.apiUrl}/connect/google?redirect_url=${target}`;
  // }

  // handleThirdPartyLogin(jwt: string, user: User) {
  //   localStorage.setItem(this.TOKEN_KEY, jwt);
  //   this.currentUserSubject.next(user);
  // }
  // /** Spracuje callback: vymení code za JWT + user */
  // handleGoogleCallback(code: string): Observable<{ jwt: string; user: User }> {
  //   return this.http
  //     .get<{ jwt: string; user: User }>(
  //       `${this.apiUrl}/connect/google/callback`,
  //       { params: { code }, withCredentials: true }
  //     )
  //     .pipe(
  //       tap(res => {
  //         localStorage.setItem(this.TOKEN_KEY, res.jwt);
  //         this.currentUserSubject.next(res.user);
  //       })
  //     );
  // }


  /** pre JS‑SDK flow */
  handleGoogleCredential(credential: string): void {
    this.http.post<{ jwt: string; user: User }>(
      `${environment.apiUrl}/auth/google-token`,
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

  /** NOVÁ metóda na priame prijatie jwt + user */
  handleThirdPartyLogin(jwt: string, user: User): void {
    localStorage.setItem(this.TOKEN_KEY, jwt);
    this.currentUserSubject.next(user);
  }



  /** Načíta profil /users/me */
  loadCurrentUser(): void {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) {
      this.currentUserSubject.next(null);
      return;
    }
    this.http.get<User>(`${this.apiUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).subscribe({
      next: user => this.currentUserSubject.next(user),
      error: () => this.logout(),
    });
  }

  /** Klasické login /auth/local */
  login(identifier: string, password: string): Observable<{ jwt: string; user: User }> {
    return this.http.post<{ jwt: string; user: User }>(
      `${this.apiUrl}/auth/local`,
      { identifier, password }
    ).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.jwt);
        this.currentUserSubject.next(res.user);
      })
    );
  }

  /** Registrácia /auth/local/register */
  register(username: string, email: string, password: string): Observable<{ jwt: string; user: User }> {
    return this.http.post<{ jwt: string; user: User }>(
      `${this.apiUrl}/auth/local/register`,
      { username, email, password }
    ).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.jwt);
        this.currentUserSubject.next(res.user);
      })
    );
  }

  /** Aktualizácia profilu */
  updateProfile(id: number, data: Partial<User>): Observable<User> {
    const token = localStorage.getItem(this.TOKEN_KEY) || '';
    return this.http.put<User>(
      `${this.apiUrl}/users/${id}`,
      data,
      { headers: { Authorization: `Bearer ${token}` } }
    ).pipe(
      tap(user => this.currentUserSubject.next(user))
    );
  }

  /** Odhlásenie */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }
}
