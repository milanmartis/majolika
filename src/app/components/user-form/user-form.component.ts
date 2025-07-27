import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="checkout-form" [formGroup]="form">
      
      <!-- First / Last Name -->
      <div class="form-row">
        <label>First name *</label>
        <input formControlName="firstName" placeholder="Your first name" />
      </div>

      <div class="form-row">
        <label>Last name *</label>
        <input formControlName="lastName" placeholder="Your last name" />
      </div>

      <!-- Email -->
      <div class="form-row">
        <label>Email *</label>
        <input formControlName="email" type="email" placeholder="your@email.com" />
      </div>

      <!-- Phone -->
      <div class="form-row">
        <label>Phone</label>
        <input formControlName="phone" type="text" placeholder="+421..." />
      </div>

      <!-- Address -->
      <h3>Address</h3>
        <div class="form-row full-width">
          <label>Street *</label>
          <input formControlName="street" placeholder="Street and number" />
        </div>

        <div class="form-row full-width">
          <label>City *</label>
          <input formControlName="city" placeholder="City" />
        </div>

        <div class="form-row full-width">
          <label>ZIP *</label>
          <input formControlName="zip" placeholder="Postal code" />
        </div>

        <div class="form-row full-width">
          <label>Country *</label>
          <input formControlName="country" placeholder="Country" />
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

    .form-row input {
      padding: 0.8rem;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .form-row input:focus {
      border-color: var(--base-blue);
      box-shadow: 0 0 0 3px rgba(41, 68, 186, 0.15);
      outline: none;
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
