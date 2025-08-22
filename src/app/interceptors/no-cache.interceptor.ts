import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from 'environments/environment';

export const noCacheInterceptor: HttpInterceptorFn = (req, next) => {
  // 1) API requesty na Strapi nechaj tak (žiadne ?v=...)
  const isStrapiApi = req.url.startsWith(environment.apiUrl);
  if (isStrapiApi) {
    // voliteľne len hlavičky, ktoré Strapi toleruje
    const req2 = req.clone({
      setHeaders: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });
    return next(req2);
  }

  // 2) Cache-buster len pre statické assety na rovnakom pôvode (ak ho chceš)
  const sameOrigin = req.url.startsWith(location.origin);
  const isGet = req.method === 'GET';
  const pathname = sameOrigin ? new URL(req.url, location.origin).pathname : '';
  const isAsset = /\.(?:js|css|png|jpe?g|webp|svg|json|woff2?)$/i.test(pathname);

  if (sameOrigin && isGet && isAsset) {
    const req2 = req.clone({ params: req.params.set('_', Date.now().toString()) });
    return next(req2);
  }

  return next(req);
};

// import { HttpInterceptorFn, HttpParams } from '@angular/common/http';
// import { environment } from '../../environments/environment';

// export const noCacheInterceptor: HttpInterceptorFn = (req, next) => {

//   const base = (environment.apiUrl || 'https://majolika-cms.appdesign.sk').replace(/\/+$/, '');
//   const apiBase = base.endsWith('/api') ? base + '/' : base + '/api/';

//   const isStrapiGet =
//     req.method === 'GET' &&
//     (req.url.startsWith(apiBase) || req.url.includes('/api/')); // poistka

//   if (isStrapiGet) {
//     const params = (req.params ?? new HttpParams()).set('v', Date.now().toString());
//     const cloned = req.clone({
//       params,
//       setHeaders: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
//     });
//     return next(cloned);
//   }
//   return next(req);
// };
