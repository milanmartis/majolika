import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../environments/environment';
import { FooterComponent } from 'app/components/footer/footer.component';
import { AuthService } from 'app/services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

// Material moduly
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

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
export class RegisterComponent implements OnInit {
  form!: FormGroup;
  error: string | null = null;
  isSubmitting = false; // 🆕 pridané
  lastAttemptedEmail: string | null = null; // uloží email ak nastane chyba

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
    });
  }

  get username() { return this.form.get('username'); }
  get email() { return this.form.get('email'); }
  get password() { return this.form.get('password'); }
  get passwordMinLength(): number | null {
    return this.password?.errors?.['minlength']?.requiredLength ?? null;
  }

  submit() {
    if (this.form.invalid) return;

    this.isSubmitting = true;
    const { username, email, password } = this.form.value;
    this.lastAttemptedEmail = email;

    this.http.post(`${environment.apiUrl}/auth/local/register`, { username, email, password })
      .subscribe({
        next: (res: any) => {
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
          this.isSubmitting = false;

        },
        complete: () => {
          this.isSubmitting = false;
        }
      });
  }

cooldownSec = 0;
private cooldownTimer?: any;

resendConfirmation(email?: string) {
  if (this.isSubmitting || this.cooldownSec > 0) return;

  this.isSubmitting = true;
  this.auth.resendConfirmation(email || this.lastAttemptedEmail || '')
    .subscribe({
      next: () => {
        this.startCooldown(30); // 30 s pauza
        // ... snackbar „odoslané“
      },
      error: (err) => {
        // ... snackbar podľa chyby
      }
    }).add(() => this.isSubmitting = false);
}

private startCooldown(sec: number) {
  this.cooldownSec = sec;
  this.cooldownTimer && clearInterval(this.cooldownTimer);
  this.cooldownTimer = setInterval(() => {
    this.cooldownSec--;
    if (this.cooldownSec <= 0) clearInterval(this.cooldownTimer);
  }, 1000);
}
}