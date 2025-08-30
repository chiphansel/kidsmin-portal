import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <header style="padding:8px 12px; background:#0b4; color:#fff;">
      <strong>KidsMin Portal</strong>
    </header>
    <router-outlet></router-outlet>
  `
})
export class AppComponent {}
