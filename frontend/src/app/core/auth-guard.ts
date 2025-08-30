import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);

  const fail = () => {
    // clear any stale session
    localStorage.removeItem('token');
    localStorage.removeItem('roles');
    localStorage.removeItem('selectedRole');
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  };

  const token = localStorage.getItem('token');
  if (!token) return fail();

  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    const exp = typeof payload?.exp === 'number' ? payload.exp : null;
    // If token has exp and it's in the past, fail
    if (exp && (Date.now() / 1000) >= exp) return fail();
  } catch {
    return fail();
  }

  return true;
};
