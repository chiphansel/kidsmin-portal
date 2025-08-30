// src/app/core/session/session.service.ts
import { Injectable, signal, computed } from '@angular/core';

export interface RoleAssignment {
  targetType: 'ENTITY';
  targetId: number;
  targetName: string;
  targetLevel: 'NATIONAL' | 'REGIONAL' | 'DISTRICT' | 'CHURCH';
  role: 'CMC' | 'CDR' | 'POG' | 'COACH' | 'ADMIN';
  active: string;
  createdAt: string;
  updatedAt: string;
}

interface JwtPayload { sub?: string; exp?: number; cred?: string; }

function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1] || '';
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

const TOKEN_KEY = 'jwt';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private _roles = signal<RoleAssignment[]>([]);
  private _selectedRole = signal<RoleAssignment | null>(null);

  /** user id from JWT `sub` (or null) */
  userId = computed<number | null>(() => {
    const t = this._token(); if (!t) return null;
    const p = decodeJwt(t);  if (!p?.sub) return null;
    const n = Number(p.sub);
    return Number.isFinite(n) ? n : null;
  });

  token() { return this._token(); }
  roles() { return this._roles(); }
  selectedRole() { return this._selectedRole(); }

  /** On login: store token & roles; preselect the first role */
  setLogin(token: string, roles: RoleAssignment[]) {
    this._token.set(token);
    localStorage.setItem(TOKEN_KEY, token);
    this._roles.set(roles || []);
    this._selectedRole.set(roles?.[0] ?? null);
  }

  /** Change current working role */
  setSelectedRole(r: RoleAssignment) { this._selectedRole.set(r); }

  /** Logout */
  clear() {
    this._token.set(null);
    localStorage.removeItem(TOKEN_KEY);
    this._roles.set([]);
    this._selectedRole.set(null);
  }

  /** Basic logged-in check; respects exp if present */
  isLoggedIn(): boolean {
    const t = this._token(); if (!t) return false;
    const p = decodeJwt(t);
    if (!p) return false;
    return !p.exp || Date.now() < p.exp * 1000;
  }
}
