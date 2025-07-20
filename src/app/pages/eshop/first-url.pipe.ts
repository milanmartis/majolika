import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'firstUrl', standalone: true })
export class FirstUrlPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return value.split(',')[0].trim();
  }
}