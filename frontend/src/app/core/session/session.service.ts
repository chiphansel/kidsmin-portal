import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private tokenKey = 'jwt';
  private rolesKey = 'roles';

  // --- auth token ---
  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }
  setToken(token: string) {
    localStorage.setItem(this.tokenKey, token);
  }

  // --- roles (optional for now) ---
  getRoles(): any[] {
    try { return JSON.parse(localStorage.getItem(this.rolesKey) || '[]'); }
    catch { return []; }
  }
  setRoles(roles: any[]) {
    localStorage.setItem(this.rolesKey, JSON.stringify(roles || []));
  }

  // --- clear everything ---
  clear() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.rolesKey);
  }
}
