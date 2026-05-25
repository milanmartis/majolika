import { HttpInterceptorFn } from '@angular/common/http';

export const localeInterceptor: HttpInterceptorFn = (req, next) => {
  // iba ak ide o Strapi API volanie
  if (!req.url.includes('/api/')) return next(req);

  // ak už je locale v query, nerob nič
  if (req.params.has('locale') || req.url.includes('locale=')) {
    return next(req);
  }

  const locale =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('language') || localStorage.getItem('locale') || 'sk'
      : 'sk';
  const newReq = req.clone({
    params: req.params.set('locale', locale),
  });

  return next(newReq);
};
