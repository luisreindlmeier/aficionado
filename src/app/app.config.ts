import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import {
  // header
  heroBars3,
  heroMagnifyingGlass,
  heroQuestionMarkCircle,
  heroBell,
  heroCog6Tooth,
  heroAcademicCap,
  // sidebar nav
  heroSignal,
  heroRectangleStack,
  heroClipboardDocumentCheck,
  heroScale,
  heroDocumentMagnifyingGlass,
  heroCircleStack,
  // project selector
  heroChevronUpDown,
  heroFolderOpen,
  heroPlus,
  heroArrowRightOnRectangle,
  // footer
  heroLifebuoy,
  // command palette
  heroChatBubbleLeftRight,
} from '@ng-icons/heroicons/outline';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideNgIconsConfig({ size: '1.15rem' }),
    provideIcons({
      heroBars3,
      heroMagnifyingGlass,
      heroQuestionMarkCircle,
      heroBell,
      heroCog6Tooth,
      heroAcademicCap,
      heroSignal,
      heroRectangleStack,
      heroClipboardDocumentCheck,
      heroScale,
      heroDocumentMagnifyingGlass,
      heroCircleStack,
      heroChevronUpDown,
      heroFolderOpen,
      heroPlus,
      heroArrowRightOnRectangle,
      heroLifebuoy,
      heroChatBubbleLeftRight,
    }),
  ],
};
