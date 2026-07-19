import { Routes } from '@angular/router';
import { NAV_GROUPS } from './core/nav';
import { PlaceholderPage } from './features/placeholder-page';

// Shell only: every nav item routes to an empty placeholder page for now.
const pageRoutes: Routes = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    path: item.route,
    component: PlaceholderPage,
    data: { title: item.label },
  })),
);

export const routes: Routes = [
  { path: '', redirectTo: 'radar', pathMatch: 'full' },
  ...pageRoutes,
  { path: '**', redirectTo: 'radar' },
];
