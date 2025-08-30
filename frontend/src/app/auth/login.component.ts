import { Component, inject, signal, effect } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

type Login2FA = { status: '2FA_REQUIRED'; method: 'email'; ttlMin: number; emailMasked: string };
type LoginSuccess = { token: string; roles: any[] };
type LoginOk = Login2FA | LoginSuccess;

@Component({
  selector: 'km-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  styles: [`
    .page { max-width: 420px; margin: 48px auto; padding: 24px; border: 1px solid #ddd; border-radius: 12px; }
    h1 { margin: 0 0 12px; }
    form { display: grid; gap: 12px; }
    label { font-weight: 600; }
    input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px; }
    button { padding: 10px 14px; border-radius: 8px; border: none; background: #0b4; color: #fff; font-weight: 600; }
    button[disabled] { opacity: .6; }
    .error { color: #b00020; }
    .muted { color: #666; }
    .row { display:flex; gap: 8px; align-items: center; }
  `],
  template: `
  <div class="page">
    <h1>KidsMin Portal</h1>

    <ng-container *ngIf="!twoFaStage(); else twofaTpl">
      <form [formGroup]="loginForm" (ngSubmit)="submitLogin()">
        <div>
          <label for="email">Email</label>
          <input id="email" type="email" autocomplete="username" formControlName="email" />
        </div>
        <div>
          <label for="password">Password</label>
          <input id="password" type="password" autocomplete="current-password" formControlName="password" />
        </div>
        <div class="row">
          <button type="submit" [disabled]="loginForm.invalid || busy()">Sign in</button>
          <a class="muted" [routerLink]="['/set-password']">Forgot / Set password</a>
        </div>
        <div class="error" *ngIf="error()">{{ error() }}</div>
      </form>
    </ng-container>

    <ng-template #twofaTpl>
      <form [formGroup]="codeForm" (ngSubmit)="verifyCode()">
        <p>We sent a 6-digit verification code to <strong>{{ maskedEmail() }}</strong>.</p>
        <p class="muted">Code expires in {{ countdown() }}s.</p>
        <div>
          <label for="code">Verification code</label>
          <input id="code" type="text" inputmode="numeric" maxlength="6" placeholder="123456" formControlName="code" />
        </div>
        <div class="row">
          <button type="submit" [disabled]="codeForm.invalid || busy()">Verify</button>
          <button type="button" (click)="backToLogin()" [disabled]="busy()">Back</button>
        </div>
        <div class="error" *ngIf="error()">{{ error() }}</div>
      </form>
    </ng-template>
  </div>
  `
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);

  api = environment.apiBase.replace(/\/+$/, '');

  busy = signal(false);
  error = signal<string | null>(null);

  twoFaStage = signal(false);
  loginEmail = signal<string>('');
  maskedEmail = signal<string>('');
  countdown = signal<number>(0);
  private countdownTimer?: any;

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  codeForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  constructor() {
    effect(onCleanup => { onCleanup(() => this.clearTimer()); });
  }

  private startCountdown(minutes: number) {
    this.clearTimer();
    const endAt = Date.now() + minutes * 60_000;
    const tick = () => {
      const remain = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      this.countdown.set(remain);
      if (remain === 0) this.clearTimer();
    };
    tick();
    this.countdownTimer = setInterval(tick, 500);
  }
  private clearTimer() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
  }

  async submitLogin() {
    this.error.set(null);
    if (this.loginForm.invalid) return;
    this.busy.set(true);
    const { email, password } = this.loginForm.value as { email: string; password: string };

    try {
      const res = await firstValueFrom(
        this.http.post<LoginOk>(`${this.api}/auth/login`, { email, password })
      );

      // 2FA required
      if ('status' in res && res.status === '2FA_REQUIRED') {
        this.loginEmail.set(email);
        this.maskedEmail.set(res.emailMasked);
        this.twoFaStage.set(true);
        this.startCountdown(res.ttlMin);
        this.codeForm.reset();
        return;
      }

      // Normal login
      if ('token' in res) {
        this.finishLogin(res.token, res.roles ?? []);
        return;
      }

      throw new Error('Unexpected response from server');
    } catch (e: any) {
      this.error.set(e?.error?.error || e?.message || 'Login failed');
    } finally {
      this.busy.set(false);
    }
  }

  async verifyCode() {
    this.error.set(null);
    if (this.codeForm.invalid) return;
    this.busy.set(true);

    try {
      const res = await firstValueFrom(
        this.http.post<LoginSuccess>(`${this.api}/auth/2fa/verify`, {
          email: this.loginEmail(),
          code: this.codeForm.value.code
        })
      );

      if ('token' in res) {
        this.finishLogin(res.token, res.roles ?? []);
        return;
      }
      throw new Error('Unexpected response from server');
    } catch (e: any) {
      this.error.set(e?.error?.error || e?.message || 'Invalid code');
    } finally {
      this.busy.set(false);
    }
  }

  backToLogin() {
    this.twoFaStage.set(false);
    this.codeForm.reset();
    this.clearTimer();
  }

  private finishLogin(token: string, roles: any[]) {
    localStorage.setItem('token', token);
    localStorage.setItem('roles', JSON.stringify(roles || []));
    this.router.navigateByUrl('/dashboard');
  }
}
