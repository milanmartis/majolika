import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from 'app/services/auth.service';

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
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  form!: FormGroup;
  returnUrl = '/';
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  isAuthenticatedSync(): boolean {
    return !!localStorage.getItem('jwt');
  }
  
  ngOnInit() {
    this.form = this.fb.group({
      identifier: ['', Validators.required],
      password:   ['', [Validators.required, Validators.minLength(6)]],
    });
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
  }

  // Getters for template
  get identifierControl() {
    return this.form.get('identifier');
  }

  get passwordControl() {
    return this.form.get('password');
  }

  get passwordMinLength(): number | null {
    return this.passwordControl?.errors?.['minlength']?.requiredLength ?? null;
  }

  submit() {
    if (this.form.invalid) return;
    this.auth.login(this.form.value).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl),
      error: e => this.error = e.error?.message || 'Prihlásenie zlyhalo.'
    });
  }
}
