/* src/app/shared/safe-url.pipe.ts */
import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Pipe({ name: 'safeUrl', standalone: true })
export class SafeUrlPipe implements PipeTransform {
  constructor(private s: DomSanitizer) {}
  transform(u: string): SafeResourceUrl { return this.s.bypassSecurityTrustResourceUrl(u); }
}
