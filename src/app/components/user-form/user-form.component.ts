import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  template: `
    <div class="checkout-form" [formGroup]="form">
      
      <!-- First / Last Name -->
      <div class="form-row">
        <label>{{ ('FORM.FIRST_NAME' | translate) }} *</label>
        <input formControlName="firstName" placeholder="{{ ('FORM.FIRST_NAME' | translate) }}" />
      </div>

      <div class="form-row">
        <label>{{ ('FORM.LAST_NAME' | translate) }} *</label>
        <input formControlName="lastName" placeholder="{{ ('FORM.LAST_NAME' | translate) }}" />
      </div>

      <!-- Email -->
      <div class="form-row">
        <label>{{ ('FORM.EMAIL' | translate) }} *</label>
        <input formControlName="email" type="email" placeholder="{{ ('FORM.EMAIL' | translate) }}" />
      </div>

      <!-- Phone (povinné pri každej objednávke) -->
      <div class="form-row">
        <label>{{ ('FORM.PHONE' | translate) }} *</label>
        <input formControlName="phone" type="tel" inputmode="tel" autocomplete="tel"
               placeholder="+421 901 234 567" />
        <div class="field-error"
             *ngIf="form.get('phone')?.touched && form.get('phone')?.invalid">
          <span *ngIf="form.get('phone')?.errors?.['required']">
            {{ 'FORM.PHONE_REQUIRED' | translate }}
          </span>
          <span *ngIf="form.get('phone')?.errors?.['phoneInvalid']">
            {{ 'FORM.PHONE_INVALID' | translate }}
          </span>
        </div>
      </div>

      <!-- Address -->
      <h3>{{ ('FORM.ADRRESS' | translate) }}</h3>
        <div class="form-row full-width">
          <label>{{ ('FORM.STREET' | translate) }} *</label>
          <input formControlName="street" placeholder="{{ ('FORM.STREET2' | translate) }}" />
        </div>

        <div class="form-row full-width">
          <label>{{ ('FORM.CITY' | translate) }} *</label>
          <input formControlName="city" placeholder="{{ ('FORM.CITY' | translate) }}" />
        </div>

        <div class="form-row full-width">
          <label>{{ ('FORM.ZIP' | translate) }} *</label>
          <input formControlName="zip" placeholder="{{ ('FORM.ZIP' | translate) }}" />
        </div>

        <div class="form-row full-width">
          <label>{{ ('FORM.COUNTRY' | translate) }} *</label>
          <select formControlName="country">
            <option value="SK">{{ 'COMMON.COUNTRY_SK' | translate }}</option>
            <option value="CZ">{{ 'COMMON.COUNTRY_CZ' | translate }}</option>
            <option value="WORLD">{{ 'COMMON.COUNTRY_WORLD_CONTACT' | translate }}</option>
          </select>
        </div>
      </div>

  `,
  styles: [`
    .checkout-form {
      background: #fff;
      padding: 2rem;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    .checkout-form h3 {
      margin-top: 2rem;
      margin-bottom: 1rem;
      font-size: 1.4rem;
      font-weight: 600;
      color: #333;
    }

    /* Každý riadok */
    .form-row {
      display: flex;
      flex-direction: column;
      margin-bottom: 1rem;
    }

    .form-row label {
      font-weight: 600;
      margin-bottom: 0.4rem;
      color: #444;
    }

    .form-row input,
    .form-row select {
      padding: 0.8rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
      background-color: #fff;
    }

    .form-row input:focus,
    .form-row select:focus {
      border-color: var(--base-blue);
      box-shadow: 0 0 0 3px rgba(41, 68, 186, 0.15);
      outline: none;
    }

    .form-row input.ng-invalid.ng-touched {
      border-color: #d33;
    }

    .field-error {
      margin-top: 0.35rem;
      font-size: 0.85rem;
      color: #d33;
    }

    /* Grid pre adresu */
    .address-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem 1.5rem;
    }

    .address-grid .full-width {
      grid-column: span 2;
    }

    /* Responzívne na mobile */
    @media (max-width: 768px) {
      .address-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class UserFormComponent {
  @Input({ required: true }) form!: FormGroup;
}
