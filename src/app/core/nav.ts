export interface NavItem {
  readonly label: string;
  readonly route: string;
  readonly icon: string;
}

export interface NavGroup {
  /** Category header; omit for the top (uncategorized) group. */
  readonly label?: string;
  readonly items: readonly NavItem[];
}

/** Single source of truth for the sidebar navigation + the page routes. */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', route: 'dashboard', icon: 'heroSquares2x2' },
      { label: 'Pipeline', route: 'pipeline', icon: 'heroRectangleStack' },
    ],
  },
  {
    label: 'Workflow',
    items: [
      { label: 'Sourcing', route: 'sourcing', icon: 'heroSignal' },
      { label: 'Evaluation', route: 'evaluation', icon: 'heroUserGroup' },
      { label: 'Recommendation', route: 'recommendation', icon: 'heroScale' },
      { label: 'Diligence', route: 'diligence', icon: 'heroDocumentMagnifyingGlass' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Sources', route: 'sources', icon: 'heroCircleStack' },
      { label: 'Integrations', route: 'integrations', icon: 'heroPuzzlePiece' },
      { label: 'Settings', route: 'settings', icon: 'heroCog6Tooth' },
    ],
  },
];
