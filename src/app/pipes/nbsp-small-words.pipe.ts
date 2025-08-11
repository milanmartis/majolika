// src/app/pipes/nbsp-small-words.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'nbspSmallWords' })
export class NbspSmallWordsPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;
    // nahradí medzeru za jednopísmenkovou predložkou/bindzou
    // (?<=\b[aiouksvzAIIOUSKVZ]) => predchádzajúce je jedno z týchto písmen
    return value.replace(/\b([aiouksvzAIIOUSKVZ])\s+/g, '$1&nbsp;');
  }
}
