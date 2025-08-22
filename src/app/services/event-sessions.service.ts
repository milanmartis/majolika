// services/event-sessions.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Product } from './products.service';
import { Subject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid'; // npm install uuid

export interface SessionCapacity { booked: number; available: number; max: number; }

export type Freq = 'DAILY'|'WEEKLY'|'MONTHLY';

export interface SeriesLite {
  id: number;
  title?: string;
  seriesVersion?: number;
  frequency?: Freq;
  interval?: number;
  byWeekday?: string[];
  timeOfDay?: string; // "15:00:00"
}

export interface EventSessionWithCapacity {
  id: number;
  title?: string;
  type: 'workshop' | 'tour';
  startDateTime: string;
  durationMinutes?: number;
  maxCapacity: number;
  product?: Product;
  capacity?: SessionCapacity;
  series?: SeriesLite;   
  isDetachedFromSeries?: boolean;
}

export interface BookingPayload {
  session: number;
  peopleCount: number;
  customerName: string;
  customerEmail: string;
  status: 'pending' | 'paid' | 'confirmed' | 'cancelled';
  temporaryId?: string; // Pridané temporaryId!
}

export interface BookingResponse {
  id: number;
  status?: string;
  session?: number;
  customerName?: string;
  customerEmail?: string;
  peopleCount?: number;
  temporaryId?: string;
}

@Injectable({ providedIn: 'root' })
export class EventSessionsService {
  private readonly apiUrl = environment.apiUrl;
  private base = environment.apiUrl.replace(/\/+$/, '');
  private token = environment.strapiToken;
  private cache: Record<string, EventSessionWithCapacity[]> = {};
  private bookingChangedSource = new Subject<void>();
  public bookingChanged$ = this.bookingChangedSource.asObservable();

  constructor(private http: HttpClient) {}

  notifyBookingChanged() {
    this.bookingChangedSource.next();
  }

  private headers(): HttpHeaders {
    let headers = new HttpHeaders({ Accept: 'application/json' });
    if (this.token) { headers = headers.set('Authorization', `Bearer ${this.token}`); }
    return headers;
  }

  toUTCDateString(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().slice(0, 10);
  }

  listForMonth(month: Date | string): Observable<EventSessionWithCapacity[]> {
    const m = typeof month === 'string' ? new Date(month) : month;
    const start = new Date(m.getFullYear(), m.getMonth(), 1);
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    const url = `${this.base}/event-sessions/by-range?start=${this.toUTCDateString(start)}&end=${this.toUTCDateString(end)}`;
    return this.http.get<any>(url, { headers: this.headers() }).pipe(
      map(resp => resp.data as EventSessionWithCapacity[]),
      catchError(() => of([]))
    );
  }

  listForDay(date: Date | string, forceReload = false): Observable<EventSessionWithCapacity[]> {
    const isoDay = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
    if (!forceReload && this.cache[isoDay]) {
      return of(this.cache[isoDay]);
    }
    const url = `${this.base}/event-sessions/for-day?date=${encodeURIComponent(isoDay)}`;
    return this.http.get<{ data: EventSessionWithCapacity[] }>(url, { headers: this.headers() }).pipe(
      map(resp => resp.data ?? []),
      tap(sessions => { this.cache[isoDay] = sessions; }),
      catchError(err => {
        console.error('listForDay error', err);
        return throwError(() => err);
      })
    );
  }

  listForRange(start: string, end: string): Observable<EventSessionWithCapacity[]> {
    const url = `${this.base}/event-sessions/by-range?start=${start}&end=${end}`;
    return this.http.get<{ data: EventSessionWithCapacity[] }>(url, { headers: this.headers() })
      .pipe(
        map(resp => resp.data),
        catchError(err => {
          console.error('listForRange error', err);
          return throwError(() => err);
        })
      );
  }

  getSessionsForProduct(slug: string): Observable<EventSessionWithCapacity[]> {
    const url = `${this.base}/event-sessions/by-product?slug=${encodeURIComponent(slug)}`;
    return this.http.get<any>(url, { headers: this.headers() }).pipe(
      map(resp => resp.data as EventSessionWithCapacity[]),
      catchError(err => {
        console.error('getSessionsForProduct error', err);
        return of([]);
      })
    );
  }

  invalidateDay(date: Date | string) {
    const isoDay = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
    delete this.cache[isoDay];
  }

  // >>> Tu je hlavná zmena: generuj temporaryId a ulož do localStorage
  createBooking(payload: BookingPayload): Observable<BookingResponse> {
    let tmpId = localStorage.getItem('lastBookingTmpId');
    if (!tmpId) {
      tmpId = uuidv4();
      localStorage.setItem('lastBookingTmpId', tmpId);
    }
    payload.temporaryId = tmpId;
  
    const url = `${this.base.replace(/\/api$/, '')}/api/event-bookings`;
    return this.http.post<BookingResponse>(url, { data: payload }, { headers: this.headers() }).pipe(
      catchError(err => {
        console.error('createBooking error', err);
        return throwError(() => err);
      })
    );
  }

  patchBooking(id: number, data: { status?: string; peopleCount?: number }) {
    const url = `${this.base}/event-bookings/${id}`;
    return this.http.put(url, { data }, { headers: this.headers() }).pipe(
      catchError(err => {
        console.error('patchBooking error', err);
        return throwError(() => err);
      })
    );
  }
}
