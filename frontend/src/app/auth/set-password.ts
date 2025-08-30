import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

function passwordPolicyValidator(c: AbstractControl): ValidationErrors | null {
  const v = String(c.value ?? '');
  const ok =
    v.length >= 12 &&
    /[A-Z]/.test(v) &&
    /[a-z]/.test(v) &&
    /[0-9]/.test(v) &&
    /[^A-Za-z0-9]/.test(v);
  return ok ? null : { policy: true };
}
function matchValidator(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const cf = group.get('confirm')?.value;
  return pw === cf ? null : { mismatch: true };
}

@Component({
  selector: 'km-set-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  styles: [`
    .page { max-width: 520px; margin: 48px auto; padding: 24px; border: 1px solid #ddd; border-radius: 12px; }
    h1 { margin: 0 0 12px; }
    form { display: grid; gap: 12px; }
    label { font-weight: 600; }
    input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px; }
    button { padding: 10px 14px; border-radius: 8px; border: none; background: #0b4; color: #fff; font-weight: 600; }
    button[disabled] { opacity: .6; }
    .error { color: #b00020; }
    .muted { color: #666; }
    ul { margin: 6px 0 0 18px; }
  `],
  template: `
  <div class="page">
    <h1>Set / Reset Password</h1>
    <p class="muted">Enter and confirm a new password for your account.</p>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <div>
        <label for="password">New password</label>
        <input id="password" type="password" autocomplete="new-password" formControlName="password" />
        <div class="muted" *ngIf="form.get('password')?.touched">
          <div *ngIf="form.get('password')?.hasError('required')" class="error">Password is required.</div>
          <div *ngIf="form.get('password')?.hasError('policy')" class="error">
            Must be at least 12 characters and include:
            <ul>
              <li>Uppercase letter</li>
              <li>Lowercase letter</li>
              <li>Number</li>
              <li>Symbol</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <label for="confirm">Confirm password</label>
        <input id="confirm" type="password" autocomplete="new-password" formControlName="confirm" />
        <div *ngIf="form.hasError('mismatch') && form.get('confirm')?.touched" class="error">
          Passwords do not match.
        </div>
      </div>

      <button type="submit" [disabled]="form.invalid || busy()">Save password</button>
      <a class="muted" [routerLink]="['/login']">Back to login</a>

      <div class="error" *ngIf="error()">{{ error() }}</div>
      <div *ngIf="ok()" class="muted">Password updated. Redirecting…</div>
    </form>
  </div>
  `
})
export class SetPasswordComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private router = inject(Router);

  api = environment.apiBase.replace(/\/+$/, '');

  busy = signal(false);
  error = signal<string | null>(null);
  ok = signal(false);

  form = this.fb.group({
    password: ['', [Validators.required, passwordPolicyValidator]],
    confirm: ['', [Validators.required]],
  }, { validators: matchValidator });

  async submit() {
    this.error.set(null);
    this.ok.set(false);
    if (this.form.invalid) return;

    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.error.set('Missing or invalid token.');
      return;
    }

    this.busy.set(true);
    try {
      await this.http.post<{ ok: true }>(`${this.api}/auth/set-password`, {
        token,
        password: this.form.value.password
      }).toPromise();

      this.ok.set(true);
      setTimeout(() => this.router.navigateByUrl('/login'), 1200);
    } catch (e: any) {
      this.error.set(e?.error?.error || 'Unable to set password.');
    } finally {
      this.busy.set(false);
    }
  }
}
