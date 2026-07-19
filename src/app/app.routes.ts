import { Routes } from '@angular/router';
import { Type } from '@angular/core';
import { NAV_GROUPS } from './core/nav';
import { PlaceholderPage } from './features/placeholder-page';
import { RadarPage } from './features/radar/radar-page';
import { EvaluationPage } from './features/evaluation/evaluation-page';
import { DataSourcesPage } from './features/data-sources/data-sources-page';
import { PipelinePage } from './features/pipeline/pipeline-page';
import { DecisionPage } from './features/decision/decision-page';
import { SettingsPage } from './features/settings/settings-page';
import { DiligencePage } from './features/diligence/diligence-page';
import { CompanyPage } from './features/company/company-page';
import { AgentRunsPage } from './features/agent-runs/agent-runs-page';

// Real feature pages by route. Anything not listed falls back to PlaceholderPage.
const FEATURE_PAGES: Readonly<Record<string, Type<unknown>>> = {
  radar: RadarPage,
  pipeline: PipelinePage,
  evaluation: EvaluationPage,
  decision: DecisionPage,
  diligence: DiligencePage,
  'agent-runs': AgentRunsPage,
  'data-sources': DataSourcesPage,
  settings: SettingsPage,
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
  { path: 'company/:id', component: CompanyPage, data: { title: 'Company' } },
  { path: '**', redirectTo: 'radar' },
];
