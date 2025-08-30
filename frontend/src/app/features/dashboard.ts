import { Component, effect, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

type Level = 'DENOMINATION' | 'NATIONAL' | 'REGIONAL' | 'DISTRICT' | 'CHURCH';
type Role  = 'CMC' | 'CDR' | 'POG' | 'COACH' | 'ADMIN';

type SelectedRole = {
  userId: string;
  entityId: string;
  role: Role;
  level: Level;
  entityName: string;
};

@Component({
  selector: 'km-dashboard',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .wrap { max-width: 1100px; margin: 18px auto; padding: 0 16px; }
    .hdr {
      display: grid; gap: 8px; align-items: center;
      grid-template-columns: 1fr auto; margin-bottom: 12px;
    }
    .pill { background: #eef7f1; color:#135b2f; padding: 6px 10px; border-radius: 999px; font-size: 12px; }
    .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    .muted { color:#666; }
    button { padding:8px 12px; border-radius:8px; border:1px solid #ddd; background:#fff; cursor:pointer; }
    button.active { background:#0b4; color:#fff; border-color:#0b4; }
    .calendar {
      background:#fafafa; border:1px dashed #ccc; border-radius:12px; padding:14px; margin: 8px 0 16px;
    }
    .tabs { display:flex; gap:8px; margin-bottom:10px; }
    .card { border:1px solid #eee; border-radius:12px; padding:14px; background:#fff; }
    .small { font-size:12px; }
  `],
  template: `
  <div class="wrap">
    <div class="hdr">
      <div>
        <h2 style="margin:0;">Entity Dashboard</h2>
        @if (selected()) {
          <div class="row small">
            <span class="pill">User: {{ selected()!.userId }}</span>
            <span class="pill">{{ selected()!.role }} @ {{ selected()!.entityName }}</span>
            <span class="pill">Level: {{ selected()!.level }}</span>
          </div>
        } @else {
          <div class="muted small">No role selected — pick one in the top menu.</div>
        }
      </div>

      <div class="row">
        <button (click)="reloadFromStorage()">Refresh context</button>
        <button (click)="toggleCalendar()">{{ showCal() ? 'Hide' : 'Show' }} calendar</button>
      </div>
    </div>

    @if (showCal()) {
      <div class="calendar">
        <strong>Calendar (placeholder)</strong>
        <div class="muted small">FullCalendar will mount here later; this area can be collapsed.</div>
        <div class="muted small">Selected: {{ selectedTab() }} tab</div>
      </div>
    }

    <div class="tabs">
      @for (t of tabs; track t) {
        <button (click)="selectTab(t)" [class.active]="selectedTab() === t">{{ t }}</button>
      }
    </div>

    <div class="card">
      @if (selectedTab() === 'RR') {
        <h3>Royal Rangers</h3>
        <p class="muted">RR features will appear here.</p>
      } @else if (selectedTab() === 'GM') {
        <h3>Girls Ministries</h3>
        <p class="muted">GM features will appear here.</p>
      } @else if (selectedTab() === 'JBQ') {
        <h3>Junior Bible Quiz</h3>
        <p class="muted">JBQ features will appear here.</p>
      } @else {
        <h3>Other</h3>
        <p class="muted">Additional tools and settings.</p>
      }
    </div>
  </div>
  `
})
export class DashboardComponent {
  private route = inject(ActivatedRoute);

  // UI state
  showCal = signal(true);
  tabs = ['RR','GM','JBQ','Other'] as const;
  selectedTab = signal<typeof this.tabs[number]>('RR');

  // Selected role context
  selected = signal<SelectedRole | null>(null);

  constructor() {
    // 1) Read query params first (if present), else fall back to localStorage
    const qp = this.route.snapshot.queryParamMap;
    const fromQuery: SelectedRole | null = qp.has('userId') && qp.has('entityId') && qp.has('role') && qp.has('level')
      ? {
          userId: String(qp.get('userId')),
          entityId: String(qp.get('entityId')),
          role: qp.get('role') as any,
          level: qp.get('level') as any,
          entityName: this.inferEntityName(String(qp.get('entityId'))) // best-effort (from stored roles)
        }
      : null;

    const fromStorage = this.readSelected();

    // Prefer query if complete; persist it
    if (fromQuery?.userId && fromQuery?.entityId && fromQuery?.role && fromQuery?.level) {
      // If we can resolve a nicer name from roles, do it:
      const better = this.withEntityNameFromRoles(fromQuery);
      this.selected.set(better);
      localStorage.setItem('selectedRole', JSON.stringify(better));
    } else if (fromStorage) {
      this.selected.set(fromStorage);
    }

    // Keep in sync with storage changes (e.g., if role is switched from the menu)
    window.addEventListener('storage', (ev) => {
      if (ev.key === 'selectedRole' || ev.key === 'roles') {
        const current = this.readSelected();
        if (current) this.selected.set(current);
      }
    });
  }

  toggleCalendar() { this.showCal.set(!this.showCal()); }
  selectTab(t: typeof this.tabs[number]) { this.selectedTab.set(t); }
  reloadFromStorage() { const s = this.readSelected(); if (s) this.selected.set(s); }

  // --- helpers to resolve context from storage ---
  private readSelected(): SelectedRole | null {
    try {
      const raw = localStorage.getItem('selectedRole');
      const sel = raw ? JSON.parse(raw) as SelectedRole : null;
      const roles = this.readRoles();
      if (!sel) return null;
      if (!roles.some(r => r.targetId === sel.entityId && r.role === sel.role)) return null;
      // Ensure friendly name is kept fresh
      const match = roles.find(r => r.targetId === sel.entityId && r.role === sel.role);
      return match ? { ...sel, entityName: match.targetName } : sel;
    } catch { return null; }
  }
  private readRoles(): Array<{ targetId: string; targetName: string; role: Role; targetLevel: Level }> {
    try { return JSON.parse(localStorage.getItem('roles') || '[]'); } catch { return []; }
  }
  private inferEntityName(entityId: string): string {
    const match = this.readRoles().find(r => r.targetId === entityId);
    return match?.targetName ?? 'Selected Entity';
    }
  private withEntityNameFromRoles(sel: SelectedRole): SelectedRole {
    const match = this.readRoles().find(r => r.targetId === sel.entityId && r.role === sel.role);
    return match ? { ...sel, entityName: match.targetName } : sel;
  }
}
