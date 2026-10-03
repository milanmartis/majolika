////src.app/animations/route.animations

import { trigger, state, transition, style, animate, query, group } from '@angular/animations';


// export const slideLeftAnimation = trigger('routeAnimations', [
//   transition('* <=> *', [
//     // 1) Nastavíme obidva—:enter aj :leave komponent tak, aby boli "fixed" a pokrývali viewport
//     query(
//       ':enter, :leave',
//       style({
//         position: 'fixed',
//         width: '100%',
//         height: '100%',
//         top: 0,
//         left: 0
//       }),
//       { optional: true }
//     ),
//     group([
//       // 2) Odchádzajúca stránka: posunie sa doľava mimo obrazovku
//       query(
//         ':leave',
//         [
//           animate(
//             '300ms ease-in-out',
//             style({ transform: 'translateX(-100%)' })
//           )
//         ],
//         { optional: true }
//       ),
//       // 3) Prichádzajúca stránka: prichádza sprava do svojho štandardného umiestnenia
//       query(
//         ':enter',
//         [
//           style({ transform: 'translateX(100%)' }),
//           animate(
//             '300ms ease-in-out',
//             style({ transform: 'translateX(0%)' })
//           )
//         ],
//         { optional: true }
//       )
//     ])
//   ])
// ]);

// import { trigger, transition, style, query, animate, group } from '@angular/animations';



export const slideFullscreenAnimation = trigger('slideFullscreen', [
  transition(':enter', [
    style({ transform: 'translateY(100%)', opacity: 0 }),
    animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
  ]),
  transition(':leave', [
    animate('300ms ease-in', style({ transform: 'translateY(100%)', opacity: 0 }))
  ])
]);


export const slideAnimation = trigger('slideAnimation', [
  transition(':enter', [
    style({ transform: 'translateX(100%)', opacity: 1 }),
    animate('300ms ease-out', style({ transform: 'translateX(0%)', opacity: 1 }))
  ]),
  transition(':leave', [
    animate(
      '300ms ease-in',
      style({ transform: 'translateX(-100%)', opacity: 0 })
    )
  ])
]);

export const slideLeftAnimation = trigger('routeAnimations', [
  // CLS-safe: ŽIADNA manipulácia s position. Pôvodná verzia dávala :enter aj
  // :leave position:relative, takže obe stránky boli naraz v toku naskladané
  // pod sebou a po odstránení odchádzajúcej prichádzajúca vyskočila nahor o
  // celú výšku = veľký layout shift (CLS ~0.87 pri navigácii). Odchádzajúcu
  // necháme odstrániť okamžite (bez :leave animácie) a prichádzajúcu len
  // jemne prelíname (opacity) – ostáva v normálnom toku na správnej pozícii.
  transition('* <=> *', [
    query(':enter', [
      style({ opacity: 0 }),
      animate('250ms ease-out', style({ opacity: 1 }))
    ], { optional: true })
  ])
]);
  

export const fadeInOutAnimation = trigger('fadeInOut', [
    state('hidden', style({ opacity: 0, transform: 'scale(0.8)' })), // Počiatočný stav (neviditeľné)
    state('visible', style({ opacity: 1, transform: 'scale(1)' })), // Konečný stav (viditeľné)
    transition('hidden => visible', [
      animate('1s ease-out') // Pomalý prechod na viditeľný stav
    ]),
    transition('visible => hidden', [
      animate('0.5s ease-in') // Rýchly prechod späť na skrytý stav
    ])
  ]);



  export const fadeInOut = trigger('fadeInOut', [
    transition(':enter', [
      style({ opacity: 0 }),
      animate('800ms ease-out', style({ opacity: 1 }))
    ]),
    transition(':leave', [
      animate('800ms ease-in', style({ opacity: 0 }))
    ])
  ]);