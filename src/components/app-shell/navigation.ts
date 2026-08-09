import type { IconName } from '@/components/ui/icons';
import type { DictionaryKey } from '@/i18n';

/**
 * Definition unique de la navigation.
 * Elle alimente a la fois la barre laterale (bureau) et la barre inferieure
 * (mobile), ce qui evite toute divergence entre les deux.
 */

export interface NavItem {
  href: string;
  labelKey: DictionaryKey;
  icon: IconName;
  color: string;
}

export interface NavSection {
  titleKey: DictionaryKey;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'nav.sectionDaily',
    items: [
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', color: '#fbc7da' },
      { href: '/habits', labelKey: 'nav.habits', icon: 'flame', color: '#e9b8d5' },
      { href: '/tasks', labelKey: 'nav.tasks', icon: 'checkCircle', color: '#e6e6e6' },
      { href: '/goals', labelKey: 'nav.goals', icon: 'target', color: '#d9c7f0' },
      { href: '/calendar', labelKey: 'nav.calendar', icon: 'calendar', color: '#e4d9f5' },
    ],
  },
  {
    titleKey: 'nav.sectionBody',
    items: [
      { href: '/nutrition', labelKey: 'nav.nutrition', icon: 'apple', color: '#ff9fbf' },
      { href: '/weight', labelKey: 'nav.weight', icon: 'scale', color: '#f6d9e4' },
      { href: '/sport', labelKey: 'nav.sport', icon: 'dumbbell', color: '#ff9fbf' },
    ],
  },
  {
    titleKey: 'nav.sectionMind',
    items: [
      { href: '/journal', labelKey: 'nav.journal', icon: 'book', color: '#efc4e2' },
      { href: '/prayers', labelKey: 'nav.prayers', icon: 'moon', color: '#dcc7ea' },
      { href: '/notes', labelKey: 'nav.notes', icon: 'note', color: '#b4b4b4' },
      { href: '/finance', labelKey: 'nav.finance', icon: 'wallet', color: '#fbe3ec' },
    ],
  },
  {
    titleKey: 'nav.sectionAnalysis',
    items: [
      { href: '/stats', labelKey: 'nav.stats', icon: 'chart', color: '#e6e6e6' },
      { href: '/compare', labelKey: 'nav.compare', icon: 'compare', color: '#d9c7f0' },
      { href: '/ai', labelKey: 'nav.ai', icon: 'sparkles', color: '#fbc7da' },
    ],
  },
];

/** Elements affiches dans la barre de navigation mobile. */
export const MOBILE_NAV: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', color: '#fbc7da' },
  { href: '/habits', labelKey: 'nav.habits', icon: 'flame', color: '#e9b8d5' },
  { href: '/tasks', labelKey: 'nav.tasks', icon: 'checkCircle', color: '#e6e6e6' },
  { href: '/stats', labelKey: 'nav.stats', icon: 'chart', color: '#e6e6e6' },
  { href: '/ai', labelKey: 'nav.ai', icon: 'sparkles', color: '#fbc7da' },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
