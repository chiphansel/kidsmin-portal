import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  // If your file is at: src/app/auth/login/login.component.ts
  { path: 'login', loadComponent: () => import('./auth/login.component').then(m => m.LoginComponent) }, // Ensure the path './auth/login/login.component.ts' is correct and the file exists
  { path: 'set-password', loadComponent: () => import('./auth/set-password').then(m => m.SetPasswordComponent) },
  { path: 'dashboard', loadComponent: () => import('./features/dashboard').then(m => m.DashboardComponent) },
  { path: '**', redirectTo: 'login' }
];
