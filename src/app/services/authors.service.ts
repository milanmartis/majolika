// src/app/services/authors.service.ts
import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';

export interface Autor {
  id: number;
  documentId?: string | null;
  meno: string;
  pozicia: string | null;
  bio?: string | null;
  fotoUrl?: string | null;
  fotoAlt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthorsService {
  private readonly base: string;
  private readonly api: string;

  constructor(private http: HttpClient, @Inject('API_URL') apiUrl: string) {
    this.api = apiUrl.replace(/\/+$/, '');
    this.base = `${this.api}/autors`;
  }

  /** Pomocník na absolútnu URL */
  private absUrl = (u?: string | null) =>
    u ? (u.startsWith('http') ? u : `${this.api}${u}`) : null;

  /** Normalizácia položky (z listu aj detailu) */
  private mapAutor = (row: any): Autor => {
    const at = row?.attributes ?? row ?? {};
    const media = at?.fotografia?.data?.attributes ?? at?.fotografia ?? null;
    const rawUrl: string | null =
      media?.formats?.medium?.url ?? media?.url ?? null;

    return {
      id: row?.id ?? at?.id ?? 0,
      documentId: at?.documentId ?? null,
      meno: at?.meno ?? '',
      pozicia: at?.pozicia ?? null,
      bio: at?.bio ?? null,
      fotoUrl: this.absUrl(rawUrl),
      fotoAlt: media?.alternativeText ?? null,
    };
  };

  /** Zoznam s locale */
  list(opts: {
    page?: number;
    pageSize?: number;
    sort?: string;          // napr. "meno:asc"
    qMeno?: string;
    locale?: string;        // "sk" | "en" | ...
  }): Observable<{ items: Autor[]; meta: any }> {
    let p = new HttpParams()
      .set('populate[fotografia][fields][0]', 'url')
      .set('populate[fotografia][fields][1]', 'alternativeText')
      .set('fields[0]', 'documentId')
      .set('fields[1]', 'meno')
      .set('fields[2]', 'pozicia')
      .set('fields[3]', 'bio')
      .set('pagination[page]', String(opts.page ?? 1))
      .set('pagination[pageSize]', String(opts.pageSize ?? 19));

    if (opts.sort)  p = p.set('sort', opts.sort);
    if (opts.qMeno) p = p.set('filters[meno][$containsi]', opts.qMeno);
    if (opts.locale) p = p.set('locale', opts.locale); // ⬅️ i18n

    return this.http.get<{ data: any[]; meta?: any }>(this.base, { params: p }).pipe(
      map(res => ({
        items: Array.isArray(res?.data) ? res.data.map(this.mapAutor) : [],
        meta: res?.meta ?? {}
      })),
      catchError(err => {
        console.error('Strapi error:', err?.error);
        return throwError(() => err);
      })
    );
  }

  /** Detail podľa ID v konkrétnom locale.
   * Pozor: ID je lokálne pre danú lokalizáciu; pri prepnutí jazyka uprednostni getByDocumentId.
   */
  getById(id: number, locale?: string): Observable<Autor | null> {
    let params = new HttpParams()
      .set('populate[fotografia][fields][0]', 'url')
      .set('populate[fotografia][fields][1]', 'alternativeText')
      .set('fields[0]', 'documentId')
      .set('fields[1]', 'meno')
      .set('fields[2]', 'pozicia')
      .set('fields[3]', 'bio')
      .set('filters[id][$eq]', String(id))
      .set('pagination[pageSize]', '1');

    if (locale) params = params.set('locale', locale); // ⬅️ i18n

    return this.http.get<{ data: any[] }>(this.base, { params }).pipe(
      map(res => (res?.data?.length ? this.mapAutor(res.data[0]) : null))
    );
  }

  /** Detail podľa documentId – stabilné naprieč jazykmi (odporúčané pri prepínaní) */
  getByDocumentId(docId: string, locale?: string): Observable<Autor | null> {
    let params = new HttpParams()
      .set('populate[fotografia][fields][0]', 'url')
      .set('populate[fotografia][fields][1]', 'alternativeText')
      .set('fields[0]', 'documentId')
      .set('fields[1]', 'meno')
      .set('fields[2]', 'pozicia')
      .set('fields[3]', 'bio')
      .set('filters[documentId][$eq]', docId)
      .set('pagination[pageSize]', '1');

    if (locale) params = params.set('locale', locale); // ⬅️ i18n

    return this.http.get<{ data: any[] }>(this.base, { params }).pipe(
      map(res => (res?.data?.length ? this.mapAutor(res.data[0]) : null))
    );
  }
}
