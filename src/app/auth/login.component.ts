import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FooterComponent } from 'app/components/footer/footer.component';

// Angular Material modules
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    // Material
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FooterComponent
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  form!: FormGroup;
  returnUrl = '/';
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snack: MatSnackBar 
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      identifier: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
  }

  // Getters pre template
  get identifierControl() {
    return this.form.get('identifier');
  }

  get passwordControl() {
    return this.form.get('password');
  }

  get passwordMinLength(): number | null {
    return this.passwordControl?.errors?.['minlength']?.requiredLength ?? null;
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
  
    const { identifier, password } = this.form.value;
  
    this.auth.login(identifier!, password!).subscribe({
      next: () => {
        // ✅ success popup
        this.snack.open('Prihlásenie úspešné! 👌', 'OK', { duration: 3000 });
        this.router.navigate(['/account']);
      },
      error: (err) => {
        console.error('Login failed', err);
  
        const backendMessage = err.error?.error?.message || err.error?.message;
  
        if (backendMessage === 'Your account email is not confirmed') {
          this.snack.open(
            'Musíte najprv potvrdiť e‑mail. Skontrolujte si schránku.',
            'OK',
            { duration: 4000 }
          );
        } else if (backendMessage === 'Invalid identifier or password') {
          this.snack.open('Nesprávny e‑mail alebo heslo.', 'OK', { duration: 4000 });
        } else {
          this.snack.open('Prihlásenie zlyhalo. Skúste to znova.', 'OK', { duration: 4000 });
        }
      }
    });
  }
}
