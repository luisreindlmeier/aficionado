export interface NavItem {
  readonly label: string;
  readonly route: string;
  readonly icon: string;
  /** Visually de-emphasized in the sidebar (a deliberate nice-to-have). */
  readonly dimmed?: boolean;
}

export interface NavGroup {
  /** Category header; omit for the top (uncategorized) group. */
  readonly label?: string;
  readonly items: readonly NavItem[];
}

/** Single source of truth for the sidebar navigation + the page routes. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    // The funnel: Radar (inbound) → Pipeline → Evaluation → Decision → Diligence.
    items: [
      { label: 'Radar', route: 'radar', icon: 'heroSignal' },
      { label: 'Pipeline', route: 'pipeline', icon: 'heroRectangleStack' },
      { label: 'Evaluation', route: 'evaluation', icon: 'heroClipboardDocumentCheck' },
      { label: 'Decision', route: 'decision', icon: 'heroScale' },
      { label: 'Diligence', route: 'diligence', icon: 'heroDocumentMagnifyingGlass', dimmed: true },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Data Sources', route: 'data-sources', icon: 'heroCircleStack' },
      { label: 'Settings', route: 'settings', icon: 'heroCog6Tooth' },
    ],
  },
];
