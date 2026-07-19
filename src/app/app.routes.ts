import { Routes } from '@angular/router';
import { Type } from '@angular/core';
import { NAV_GROUPS } from './core/nav';
import { PlaceholderPage } from './features/placeholder-page';
import { EvaluationPage } from './features/evaluation/evaluation-page';
import { DataSourcesPage } from './features/data-sources/data-sources-page';

// Real feature pages by route. Anything not listed falls back to PlaceholderPage.
const FEATURE_PAGES: Readonly<Record<string, Type<unknown>>> = {
  evaluation: EvaluationPage,
  'data-sources': DataSourcesPage,
};

const pageRoutes: Routes = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    path: item.route,
    component: FEATURE_PAGES[item.route] ?? PlaceholderPage,
    data: { title: item.label },
  })),
);

export const routes: Routes = [
  { path: '', redirectTo: 'radar', pathMatch: 'full' },
  ...pageRoutes,
  { path: '**', redirectTo: 'radar' },
];
