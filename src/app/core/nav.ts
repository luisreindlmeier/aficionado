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
    // Discovery + tracking: find founders, then keep the watched ones in view.
    items: [
      { label: 'Radar', route: 'radar', icon: 'heroSignal' },
      { label: 'Pipeline', route: 'pipeline', icon: 'heroRectangleStack' },
    ],
  },
  {
    // Assessment: score → verdict → deep dive.
    label: 'Assessment',
    items: [
      { label: 'Decision', route: 'decision', icon: 'heroScale' },
      { label: 'Evaluation', route: 'evaluation', icon: 'heroClipboardDocumentCheck' },
      { label: 'Diligence', route: 'diligence', icon: 'heroDocumentMagnifyingGlass' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Agent Runs', route: 'agent-runs', icon: 'heroCpuChip' },
      { label: 'Data Sources', route: 'data-sources', icon: 'heroCircleStack' },
      { label: 'Settings', route: 'settings', icon: 'heroCog6Tooth' },
    ],
  },
];
