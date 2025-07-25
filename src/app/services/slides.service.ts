// src/app/services/slides.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Slide {
  id: number;
  order: number;
  title: string;
  subtitle: string;
  url: string;
  images: string[];
  videos: string[];
  externalVideo: string;
}

type MediaFlat   = Array<any> | null;           // [{ … }]  alebo null
type MediaNested = { data: MediaFlat } | null;  // {data:[…]} alebo null

interface StrapiResp {
  data: Array<{
    id: number;
    attributes?: {                        // ↙ ak Strapi vráti shape s attributes
      order?: number;
      title?: string;
      subtitle?: string;
      url?: string;
      images?:  MediaNested;
      videos?:  MediaNested;
         /** v Strapi môže byť uložené jedným z týchto názvov */
    externalVideo?: string;        // camelCase
    video_external?: string;       // snakeCase
    external_video?: string;       // ďalší možný variant

    };

    /* ↙ keď Strapi vráti „flattened“ shape (polia rovno v objekte) */
    order?: number;
    title?: string;
    subtitle?: string;
    url?: string;
    images?:  MediaFlat;
    videos?:  MediaFlat;
    externalVideo?: string;

  }>;
  meta: any;

}

@Injectable({ providedIn: 'root' })
export class SlidesService {

  private readonly api  = environment.apiUrl.replace(/\/\/+$/, '');
  private readonly host = this.api.replace(/\/api\/?$/, '');
  private readonly placeholder = '/assets/img/gall/1.jpg';

  constructor(private http: HttpClient) {}

  /** relatívnu URL → absolútna; externé URL ostávajú nedotknuté  */
  private absolutize = (u?: string) =>
    u ? (/^https?:\/\//i.test(u) ? u : `${this.host}${u}`) : this.placeholder;

  /** vyberie najvhodnejšiu URL z formátov (large → medium → small → thumbnail → originál) */
  private pickBestUrl = (o: any): string | undefined => {
    const fm = o.formats ?? {};
    return (
      fm.large?.url ??
      fm.medium?.url ??
      fm.small?.url ??
      fm.thumbnail?.url ??
      o.url
    );
  };

  /** prijme ľubovoľný media-field zo Strapi a vráti pole absolútnych URL-iek */
  private mediaUrls(raw?: MediaFlat | MediaNested): string[] {
    if (!raw) { return []; }

    /* prevedieme na pole objektov s url/formats  */
    let arr: any[] = Array.isArray(raw) ? raw : [];
    if (!arr.length && (raw as any).data) {
      const d = (raw as any).data;
      arr = Array.isArray(d) ? d : [d];
    }

    return arr
      .map((item: any) => {
        // môžu byť dve možné štruktúry ↓↓↓
        const mediaObj = item.attributes ?? item;
        return this.absolutize(this.pickBestUrl(mediaObj));
      })
      .filter(Boolean);
  }

  private pickExternal(at: any): string {
    return at.externalVideo          // camelCase
        ?? at.video_external         // snake_case 1
        ?? at.external_video         // snake_case 2
        ?? '';
  }

  /** ----------- verejné API --------------------------------- */
  getSlides(): Observable<Slide[]> {
    const url =
      `${this.api}/slides` +
      `?sort=order:asc` +
      `&populate[images][populate]=*` +
      `&populate[videos][populate]=*`;

    return this.http.get<StrapiResp>(url).pipe(
      map(resp =>
        resp.data.map(raw => {
          const at = raw.attributes ?? raw;      // flattened vs nested



          return {
            id: raw.id,
            order: at.order ?? 0,
            title: at.title ?? '',
            subtitle: at.subtitle ?? '',
            url: at.url ?? '',
            images: this.mediaUrls(at.images),
            videos: this.mediaUrls(at.videos),
            externalVideo: this.pickExternal(at)
          } as Slide;
        })
      )
    );
  }
}
