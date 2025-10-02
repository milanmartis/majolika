import { HttpInterceptorFn } from '@angular/common/http';

export const localeInterceptor: HttpInterceptorFn = (req, next) => {
  // iba ak ide o Strapi API volanie
  if (!req.url.includes('/api/')) return next(req);

  // ak už je locale v query, nerob nič
  if (req.params.has('locale') || req.url.includes('locale=')) {
    return next(req);
  }

  const locale = localStorage.getItem('locale') || 'sk';
  const newReq = req.clone({
    params: (req.params ?? new URLSearchParams() as any).set('locale', locale),
  });

  return next(newReq);
};
