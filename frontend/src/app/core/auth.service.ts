import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { tap } from 'rxjs/operators';

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  login(email: string, password: string) {
    return this.api
      .post<{ token: string; roles: RoleAssignment[] }>('/login', { email, password })
      .pipe(
        tap(res => {
          localStorage.setItem('jwt', res.token);
          localStorage.setItem('roles', JSON.stringify(res.roles || []));
        })
      );
  }

  requestReset(email: string) {
    return this.api.post('/auth/request-reset', { email });
  }

  setPassword(token: string, password: string) {
    return this.api.post('/auth/set-password', { token, password });
  }

  createAdmin(firstName: string, lastName: string, email: string) {
    return this.api.post('/createAdmin', { firstName, lastName, email });
  }
}
