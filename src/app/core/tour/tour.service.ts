import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

/** One coachmark: navigate to `route`, spotlight the `[data-tour]` element, show the copy. */
export interface TourStep {
  readonly route: string;
  readonly selector: string;
  readonly title: string;
  readonly body: string;
}

const STEPS: readonly TourStep[] = [
  {
    route: '/radar',
    selector: 'tour-radar',
    title: 'Radar, always-on sourcing',
    body: 'Founders are discovered from public signals against a thesis, then triaged and scored the moment they land. The freshest sit on top.',
  },
  {
    route: '/evaluation',
    selector: 'tour-evaluation',
    title: 'Evaluation, the founder score',
    body: 'Each founder is scored on Proof, Gravity and Trajectory, then combined into one calibrated composite. Every number is a receipt you can click to its source.',
  },
  {
    route: '/data-sources',
    selector: 'tour-data-sources',
    title: 'Data sources, the connectors',
    body: 'Every source is a connector that feeds the score and doubles as a tool the agents can call. A green dot means it is live.',
  },
];

const STORAGE_KEY = 'af.tour.v1.done';

/** Drives the 3 step onboarding tour (Radar, Evaluation, Data sources). */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly router = inject(Router);

  readonly steps = STEPS;
  readonly index = signal(0);
  readonly active = signal(false);
  readonly step = computed<TourStep | undefined>(() =>
    this.active() ? this.steps[this.index()] : undefined,
  );
  readonly isFirst = computed(() => this.index() === 0);
  readonly isLast = computed(() => this.index() === this.steps.length - 1);

  start(): void {
    this.index.set(0);
    this.active.set(true);
    this.go();
  }

  next(): void {
    if (this.isLast()) {
      this.finish();
      return;
    }
    this.index.update((i) => i + 1);
    this.go();
  }

  prev(): void {
    if (this.isFirst()) return;
    this.index.update((i) => i - 1);
    this.go();
  }

  finish(): void {
    this.active.set(false);
    this.markSeen();
  }

  hasSeen(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private go(): void {
    void this.router.navigateByUrl(this.steps[this.index()].route);
  }

  private markSeen(): void {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore storage failures (private mode); the tour just runs again next time
    }
  }
}
