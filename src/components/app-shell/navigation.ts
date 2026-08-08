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
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', color: '#e9a76b' },
      { href: '/habits', labelKey: 'nav.habits', icon: 'flame', color: '#6e93a8' },
      { href: '/tasks', labelKey: 'nav.tasks', icon: 'checkCircle', color: '#5f9aa6' },
      { href: '/goals', labelKey: 'nav.goals', icon: 'target', color: '#8592ad' },
      { href: '/calendar', labelKey: 'nav.calendar', icon: 'calendar', color: '#9aa5bd' },
    ],
  },
  {
    titleKey: 'nav.sectionBody',
    items: [
      { href: '/nutrition', labelKey: 'nav.nutrition', icon: 'apple', color: '#d99a63' },
      { href: '/weight', labelKey: 'nav.weight', icon: 'scale', color: '#6fa394' },
      { href: '/sport', labelKey: 'nav.sport', icon: 'dumbbell', color: '#c97f63' },
    ],
  },
  {
    titleKey: 'nav.sectionMind',
    items: [
      { href: '/journal', labelKey: 'nav.journal', icon: 'book', color: '#a98ba0' },
      { href: '/prayers', labelKey: 'nav.prayers', icon: 'moon', color: '#5e9c9b' },
      { href: '/notes', labelKey: 'nav.notes', icon: 'note', color: '#7d8f95' },
      { href: '/finance', labelKey: 'nav.finance', icon: 'wallet', color: '#7ba083' },
    ],
  },
  {
    titleKey: 'nav.sectionAnalysis',
    items: [
      { href: '/stats', labelKey: 'nav.stats', icon: 'chart', color: '#5f9aa6' },
      { href: '/compare', labelKey: 'nav.compare', icon: 'compare', color: '#8592ad' },
      { href: '/ai', labelKey: 'nav.ai', icon: 'sparkles', color: '#e9a76b' },
    ],
  },
];

/** Elements affiches dans la barre de navigation mobile. */
export const MOBILE_NAV: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard', color: '#e9a76b' },
  { href: '/habits', labelKey: 'nav.habits', icon: 'flame', color: '#6e93a8' },
  { href: '/tasks', labelKey: 'nav.tasks', icon: 'checkCircle', color: '#5f9aa6' },
  { href: '/stats', labelKey: 'nav.stats', icon: 'chart', color: '#5f9aa6' },
  { href: '/ai', labelKey: 'nav.ai', icon: 'sparkles', color: '#e9a76b' },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items);
