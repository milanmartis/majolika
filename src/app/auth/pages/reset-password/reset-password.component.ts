import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FooterComponent } from 'app/components/footer/footer.component';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'app/services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-set-new-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    FooterComponent,
    TranslateModule
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent {
  code = '';
  password = '';
  password2 = '';
  loading = false;
  ok = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    // načítaj ?code=... až po injekcii ActivatedRoute
    this.code = this.route.snapshot.queryParamMap.get('code') ?? '';

    // ak chceš reagovať aj na zmenu query parametrov počas života komponentu:
    // this.route.queryParamMap.subscribe(qp => {
    //   this.code = qp.get('code') ?? '';
    // });
  }
  get passwordsMatch(): boolean {
    return this.password === this.password2 && this.password.length >= 8;
  }
  submit() {
    if (!this.passwordsMatch) return;
    if (!this.code) {
      this.error = 'Chýba kód obnovy.';
      return;
    }
    if (!this.password || this.password.length < 8) {
      this.error = 'Heslo musí mať aspoň 8 znakov.';
      return;
    }
    if (this.password !== this.password2) {
      this.error = 'Heslá sa nezhodujú.';
      return;
    }

    this.loading = true;
    this.error = '';

    this.auth.resetPassword(this.code, this.password).subscribe({
      next: () => {
        this.ok = true;
        this.loading = false;
        // napr. po 1-2s presmerovať na login
        setTimeout(() => this.router.navigateByUrl('/login'), 1200);
      },
      error: (e) => {
        // Strapi zvyčajne vráti 400 pri expirovanom/nesprávnom code
        this.error = 'Obnova zlyhala. Skús znova požiadať o obnovu hesla.';
        this.loading = false;
      },
    });
  }
}
