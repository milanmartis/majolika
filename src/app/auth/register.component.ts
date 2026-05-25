import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../environments/environment';
import { FooterComponent } from 'app/components/footer/footer.component';
import { AuthService } from 'app/services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

declare global {
  interface Window {
    turnstile?: any;
  }
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FooterComponent,
    MatProgressSpinnerModule,
    TranslateModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit, OnDestroy, AfterViewInit {
  form!: FormGroup;
  error: string | null = null;
  isSubmitting = false;
  lastAttemptedEmail: string | null = null;

  cooldownSec = 0;
  private cooldownTimer?: any;
  private turnstileRenderAttempts = 0;
  private turnstileWidgetId: string | null = null;

  turnstileSiteKey = environment.turnstileSiteKey;
  turnstileToken: string | null = null;
  turnstileError = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private snack: MatSnackBar,
    public auth: AuthService,
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordsMatchValidator });
  }

  ngAfterViewInit() {
    this.renderTurnstile();
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }
  }

  get username() { return this.form.get('username'); }
  get email() { return this.form.get('email'); }
  get password() { return this.form.get('password'); }
  get confirmPassword() { return this.form.get('confirmPassword'); }

  get passwordMinLength(): number | null {
    return this.password?.errors?.['minlength']?.requiredLength ?? null;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.turnstileToken) {
      this.turnstileError = true;
      return;
    }

    this.isSubmitting = true;
    const { username, email, password } = this.form.value;
    this.lastAttemptedEmail = email;

    this.http.post(`${environment.apiUrl}/auth/register-with-turnstile`, {
      username,
      email,
      password,
      turnstileToken: this.turnstileToken
    }).subscribe({
      next: () => {
        this.snack.open(
          '✅ Registrácia úspešná! Skontrolujte si e-mail a potvrďte účet.',
          'OK',
          { duration: 5000, panelClass: ['success-snackbar'] }
        );

        this.router.navigate(['/registration-success']);
      },
      error: (err: HttpErrorResponse) => {
        const errMsg = err.error?.error?.message || 'Registrácia zlyhala.';
        this.snack.open(errMsg, 'OK', { duration: 5000 });
        this.resetTurnstile();
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  resendConfirmation(email?: string) {
    if (this.isSubmitting || this.cooldownSec > 0) return;

    this.isSubmitting = true;
    this.auth.resendConfirmation(email || this.lastAttemptedEmail || '')
      .subscribe({
        next: () => {
          this.startCooldown(30);
          this.snack.open('Potvrdzovací e-mail bol znovu odoslaný.', 'OK', { duration: 4000 });
        },
        error: (err) => {
          const errMsg = err?.error?.error?.message || 'Nepodarilo sa odoslať potvrdzovací e-mail.';
          this.snack.open(errMsg, 'OK', { duration: 5000 });
        }
      }).add(() => this.isSubmitting = false);
  }

  private renderTurnstile() {
    const container = document.getElementById('turnstile-container');

    if (!container) {
      return;
    }

    if (window.turnstile?.render) {
      if (this.turnstileWidgetId !== null) {
        return;
      }

      this.turnstileWidgetId = window.turnstile.render('#turnstile-container', {
        sitekey: this.turnstileSiteKey,
        theme: 'auto',
        callback: (token: string) => {
          this.turnstileToken = token;
          this.turnstileError = false;
        },
        'expired-callback': () => {
          this.turnstileToken = null;
        },
        'error-callback': () => {
          this.turnstileToken = null;
          this.turnstileError = true;
        }
      });

      return;
    }

    if (this.turnstileRenderAttempts < 20) {
      this.turnstileRenderAttempts++;
      setTimeout(() => this.renderTurnstile(), 300);
    }
  }

  private passwordsMatchValidator = (group: FormGroup) => {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  };

  private startCooldown(sec: number) {
    this.cooldownSec = sec;
    this.cooldownTimer && clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      this.cooldownSec--;
      if (this.cooldownSec <= 0) clearInterval(this.cooldownTimer);
    }, 1000);
  }

  private resetTurnstile() {
    this.turnstileToken = null;
    this.turnstileError = false;

    if (window.turnstile && this.turnstileWidgetId !== null) {
      window.turnstile.reset(this.turnstileWidgetId);
    }
  }
}