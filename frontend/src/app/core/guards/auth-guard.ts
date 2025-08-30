import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
// Update the import path if the file is located elsewhere, for example:
import { SessionService } from '../session/session.service';
// Or ensure that '../session/session.service.ts' exists in your project.

export const AuthGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (session.isLoggedIn()) return true;

  router.navigateByUrl('/login');
  return false;
};
