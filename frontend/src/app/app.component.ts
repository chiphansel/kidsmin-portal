import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { RoleMenuComponent } from './shared/role-menu';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RoleMenuComponent],
  template: `
    @if (!isAuthRoute()) {
      <km-role-menu></km-role-menu>
    }
    <router-outlet></router-outlet>
  `
})
export class AppComponent {
  private router = inject(Router);
  private url = signal(this.router.url);

  constructor() {
    this.router.events.pipe(filter((e: any) => e.constructor.name === 'NavigationEnd'))
      .subscribe(() => this.url.set(this.router.url));
  }

  isAuthRoute = computed(() => {
    const u = this.url();
    return u.startsWith('/login') || u.startsWith('/set-password');
  });
}
