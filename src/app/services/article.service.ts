import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'environments/environment';

import type { Article } from 'app/models/article.model';
import type { ContentBlock, ImageBlock, VideoBlock } from 'app/models/blocks.model';

interface StrapiResponse<T> {
  data: T & { id: number };
  meta: unknown;
}

@Injectable({ providedIn: 'root' })
export class ArticleService {
  private base = environment.apiUrl.replace(/\/+$/, '');

  constructor(private http: HttpClient) {}

  getArticleBySlug(slug: string): Observable<Article> {
    return this.http
      .get<StrapiResponse<Omit<Article, 'id'>>>(`${this.base}/articles/${slug}`)
      .pipe(
        map(res => {
          const { id, title, slug: _slug, createdAt, updatedAt, publishedAt, locale, content = [] } = res.data;
          const art: Article = { id, title, slug: _slug, createdAt, updatedAt, publishedAt, locale, content };

          // mapovanie blokov
          const blocks = content as ContentBlock[];
          art.content = blocks.map(block => {
            // IMAGE BLOCK
            if (block.__component === 'blocks.image-block') {
              const rawMedia = (block as any).media;
              const mediaAttrs = rawMedia?.data?.attributes ?? rawMedia;
              const formats = mediaAttrs?.formats ?? {};
              const toUrl = (path?: string) => path ? (path.startsWith('http') ? path : `${this.base}${path}`) : '';

              return {
                ...(block as ImageBlock),
                thumbnailUrl: toUrl(formats.thumbnail?.url) || toUrl(mediaAttrs.url),
                mediumUrl:    toUrl(formats.medium?.url)    || toUrl(mediaAttrs.url),
                largeUrl:     toUrl(formats.large?.url)     || toUrl(mediaAttrs.url),
                alignment:    (block as ImageBlock).alignment
              };
            }

            // VIDEO BLOCK
            if (block.__component === 'blocks.video-block') {
              const vb = block as VideoBlock & { videoUrl?: string; url?: string; caption?: string };
              // primárne videoUrl z attributes
              let resolved = vb.videoUrl ?? '';
              if (resolved && !resolved.startsWith('http')) {
                resolved = `${this.base}${resolved}`;
              }
              // fallback na vb.url
              if (!resolved && vb.url) {
                resolved = vb.url.startsWith('http') ? vb.url : `${this.base}${vb.url}`;
              }
              return {
                ...vb,
                url: resolved,
                caption: vb.caption
              } as VideoBlock;
            }

            // ostatné bloky bez zmeny
            return block;
          }) as ContentBlock[];

          return art;
        })
      );
  }
}