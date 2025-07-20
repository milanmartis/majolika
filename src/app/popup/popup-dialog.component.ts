// import { Component, Inject, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
// import { MatButtonModule } from '@angular/material/button';
// import { MatIconModule } from '@angular/material/icon';
// import { PopUpWindow } from '../services/popup.service';
// import { trigger, transition, style, animate } from '@angular/animations';

// const slideFullscreenAnimation = trigger('slideFullscreen', [
//   transition(':enter', [
//     style({ transform: 'translateY(100%)', opacity: 0 }),
//     animate('500ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
//   ]),
//   transition(':leave', [
//     animate('500ms ease-in', style({ transform: 'translateY(100%)', opacity: 0 }))
//   ])
// ]);

// @Component({
//   selector: 'app-popup-dialog',
//   standalone: true,
//   imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
//   template: `
//     <div class="popup-overlay">
//       <div class="popup-container" >
//         <button mat-icon-button class="close-btn" (click)="close()">
//           <mat-icon>close</mat-icon>
//         </button>
//         <div class="popup-background" [ngStyle]="{'background-image': 'url(' + data.media[0].url + ')'}"></div>
//         <!-- <div class="popup-background" [ngStyle]="{'background-image': 'url(' + data.media[0].url + ')'}"></div> -->
//         <div class="popup-content">
//           <h2 class="popup-header">{{ data.header }}</h2>
//           <ng-container *ngIf="data.text?.length; else noText">
//             <div *ngFor="let block of data.text" [ngSwitch]="block.type" class="text-block">
//               <div *ngSwitchCase="'heading'" class="popup-heading">
//                 {{ block.children[0]?.text }}
//               </div>
//               <div *ngSwitchCase="'paragraph'" class="popup-paragraph">
//                 <span *ngFor="let child of block.children">{{ child.text }}</span>
//               </div>
//             </div>
//           </ng-container>
//           <ng-template #noText>
//             <p class="popup-text">Žiadny text na zobrazenie.</p>
//           </ng-template>
//           <button mat-raised-button color="primary" class="popup-button" (click)="openUrl()" [disabled]="clicked">
//             {{ 'Chcem nakupovať' }}
//           </button>
//         </div>
//       </div>
//     </div>
//   `,
//   styles: [
//     `
//     .popup-overlay {
//       display: flex;
//       align-items: center;
//       justify-content: center;
//       width: 100%;
//       height: 100%;
//       background:transparent;
//     }
//     .popup-container {
//       position: relative;
//       width: 100vw;
//       height: 100%;
//       display: flex;
//       flex-direction: column;
//       justify-content: flex-end;
//       border-radius: 8px;
//       overflow: hidden;
//       box-shadow: 0 4px 16px rgba(0,0,0,0.63);
//     }
//     .popup-background {
//       height:100%;
//       position: absolute;
//       inset: 0;
//       background-size: cover;
//       background-position: center;
//       filter: brightness(0.9);
//       z-index: 1;
//     }
//     .popup-content {
//       position: relative;
//       z-index: 2;
//       padding: 1.5rem;
//       color: #fff;
//       overflow-y: auto;
//       max-height: 100vh;
//     }
//     .popup-content::after {
//   content: "";
//   position: absolute;
//   inset: 0;
//   background: linear-gradient(
//     to top,
//     rgba(0, 0, 0, 0.9) 0%,
//     rgba(0, 0, 0, 0) 60%
//   );
//   pointer-events: none;
// }
//     .popup-header {
//       font-size: 1.5rem;
//       margin-bottom: 1rem;
//       text-align: center;
//     }
//     .text-block { margin-bottom: 0.75rem; }
//     .popup-heading { font-size: 1.25rem; margin: 1rem 0 0.5rem; font-weight: bold; }
//     .popup-paragraph { font-size: 1rem; line-height: 1.5; }
//     .popup-paragraph span { display: block; margin-bottom: 0.5rem; }
//     .popup-button {z-index:9999999999; width: 100%; margin-top: 1rem; white-space: normal;  transition: all 0.3s ease;
//     }
//     .popup-button:hover{
//   color: #fff;
//   background:#2944ba

//     }
//     .close-btn { position: absolute; top: 0.5rem; right: 0.5rem; color: #fff; z-index: 3; }
//     @media (min-width: 600px) {
//       .popup-container { width: 60vw; }
//       .popup-content { padding: 2rem; }
//       .popup-header { font-size: 2rem; }
//       .popup-paragraph { font-size: 1.125rem; }
//     }
//     @media (min-width: 960px) {
//       .popup-container { width: 40vw; }
//       .popup-header { font-size: 2.5rem; }
//       .popup-paragraph { font-size: 1.25rem; }
//     }
//   `
//   ],
//   animations: [slideFullscreenAnimation]
// })
// export class PopupDialogComponent implements OnInit {
//   clicked = false;

//   constructor(
//     private dialogRef: MatDialogRef<PopupDialogComponent>,
//     @Inject(MAT_DIALOG_DATA) public data: PopUpWindow
//   ) {
//     dialogRef.disableClose = true;
//   }

//   ngOnInit(): void {
//     if (localStorage.getItem('popupClicked')) this.dialogRef.close();
//   }

//   close(): void {
//     this.dialogRef.close();
//     localStorage.setItem('popupClicked', 'true');
//   }

//   openUrl(): void {
//     if (this.data.url && !this.clicked) {
//       this.clicked = true;
//       window.open(this.data.url, '_blank');
//       localStorage.setItem('popupClicked', 'true');
//     }
//   }
// }

// // In global styles (e.g., styles.css) add:
// // .full-screen-dialog .mat-dialog-container {
// //   background: transparent !important;
// //   box-shadow: none !important;
// //   padding: 0 !important;
// // }
// // Then open dialog with:
// // this.dialog.open(PopupDialogComponent, {
// //   panelClass: 'full-screen-dialog',
// //   width: '100vw', height: '100vh'
// // });
