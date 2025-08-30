import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from '../api.service';
import { map, catchError, of } from 'rxjs';

export const AdminSetupGuard: CanActivateFn = () => {
  const api = inject(ApiService);
  const router = inject(Router);

  return api.get<{ exists: boolean }>('/system/admin-exists').pipe(
    map(res => {
      // If an admin already exists, block /create-admin and send to login
      if (res?.exists) {
        router.navigateByUrl('/login');
        return false;
      }
      return true;
    }),
    // If the check fails (backend down), be safe and send to login
    catchError(() => {
      router.navigateByUrl('/login');
      return of(false);
    })
  );
};
