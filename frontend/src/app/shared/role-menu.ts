import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

type RoleAssignment = {
  targetId: string;
  targetName: string;
  targetLevel: 'DENOMINATION' | 'NATIONAL' | 'REGIONAL' | 'DISTRICT' | 'CHURCH';
  role: 'CMC' | 'CDR' | 'POG' | 'COACH' | 'ADMIN';
  active?: string;
  createdAt?: string;
  updatedAt?: string;
};

type SelectedRole = {
  userId: string;
  entityId: string;
  role: RoleAssignment['role'];
  level: RoleAssignment['targetLevel'];
  entityName: string;
};

@Component({
  selector: 'km-role-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  styles: [`
    header.km-bar {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 16px;
      padding: 10px 14px;
      background: #0b4; color: #fff;
      position: sticky; top: 0; z-index: 10;
    }
    .brand { font-weight: 800; letter-spacing: .3px; }
    .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    select, button { border: none; border-radius: 8px; padding: 8px 10px; }
    select { background: #fff; color: #222; min-width: 260px; }
    button { background: rgba(255,255,255,.15); color: #fff; font-weight: 700; cursor: pointer; }
    button:hover { background: rgba(255,255,255,.25); }
    .id-pill { background: rgba(0,0,0,.18); padding: 6px 8px; border-radius: 999px; font-size: 12px; }
  `],
  template: `
    <header class="km-bar">
      <div class="brand">KidsMin Portal</div>

      <div class="controls">
        @if (userId()) {
          <span class="id-pill">User: {{ userId() }}</span>
        }

        <select [value]="selectedKey()" (change)="onSelect($any($event.target).value)">
          <option value="" disabled>Select a role…</option>
          @for (r of roles(); track r.targetId) {
            <option [value]="roleKey(r)">{{ r.role }} @ {{ r.targetName }} ({{ r.targetLevel }})</option>
          }
        </select>

        <button (click)="openDashboard()" [disabled]="!selected()">Open Dashboard</button>
        <button (click)="logout()">Logout</button>
      </div>
    </header>
  `
})
export class RoleMenuComponent {
  private router = inject(Router);

  roles = signal<RoleAssignment[]>(this.readRoles());
  userId = signal<string | null>(this.readUserId());
  selected = signal<SelectedRole | null>(this.readSelected());
  selectedKey = computed(() => this.selected() ? this.serializeKey(this.selected()!) : '');

  constructor() {
    effect(() => {
      const sel = this.selected();
      if (sel) localStorage.setItem('selectedRole', JSON.stringify(sel));
      else localStorage.removeItem('selectedRole');
    });

    window.addEventListener('storage', (ev) => {
      if (ev.key === 'roles' || ev.key === 'token' || ev.key === 'selectedRole') {
        this.roles.set(this.readRoles());
        this.userId.set(this.readUserId());
        this.selected.set(this.readSelected());
      }
    });

    if (!this.selected() && this.roles().length > 0 && this.userId()) {
      const r0 = this.roles()[0];
      this.selected.set({
        userId: this.userId()!,
        entityId: r0.targetId,
        role: r0.role,
        level: r0.targetLevel,
        entityName: r0.targetName,
      });
    }
  }

  private readRoles(): RoleAssignment[] {
    try { return JSON.parse(localStorage.getItem('roles') || '[]'); } catch { return []; }
  }
  private readUserId(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || ''));
      return typeof payload?.sub === 'string' ? payload.sub : null;
    } catch { return null; }
  }
  private readSelected(): SelectedRole | null {
    try {
      const raw = localStorage.getItem('selectedRole');
      const sel = raw ? JSON.parse(raw) as SelectedRole : null;
      const roles = this.readRoles();
      if (!sel || !this.readUserId() || !roles.some(r => r.targetId === sel.entityId && r.role === sel.role)) return null;
      const match = roles.find(r => r.targetId === sel.entityId && r.role === sel.role);
      return match ? { ...sel, entityName: match.targetName } : sel;
    } catch { return null; }
  }

  roleKey(r: RoleAssignment): string { return `${r.role}::${r.targetLevel}::${r.targetId}`; }
  serializeKey(sel: SelectedRole): string { return `${sel.role}::${sel.level}::${sel.entityId}`; }

  onSelect(key: string) {
    const [role, level, entityId] = key.split('::');
    const match = this.roles().find(r => r.role === role && r.targetLevel === level && r.targetId === entityId);
    const uid = this.userId();
    if (!match || !uid) { this.selected.set(null); return; }
    this.selected.set({ userId: uid, entityId: match.targetId, role: match.role, level: match.targetLevel, entityName: match.targetName });
  }

  openDashboard() {
    const sel = this.selected();
    if (!sel) return;
    this.router.navigate(['/dashboard'], {
      queryParams: { userId: sel.userId, entityId: sel.entityId, role: sel.role, level: sel.level }
    });
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('roles');
    localStorage.removeItem('selectedRole');
    this.userId.set(null);
    this.roles.set([]);
    this.selected.set(null);
    this.router.navigateByUrl('/login');
  }
}
