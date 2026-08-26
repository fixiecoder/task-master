import type { ReactNode, SVGProps } from 'react';

/**
 * Single source of truth for every icon in the app. Swap the icon set by
 * replacing the path data below (or the whole file with a different
 * generator, e.g. wrapping an icon library) — every call site imports from
 * here rather than drawing its own <svg>.
 */

export type IconProps = SVGProps<SVGSVGElement>;

function icon(displayName: string, children: ReactNode, viewBox = '0 0 24 24') {
  function IconComponent(props: IconProps) {
    return (
      <svg
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    );
  }
  IconComponent.displayName = displayName;
  return IconComponent;
}

export const BoardIcon = icon('BoardIcon', (
  <>
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
    <path d="M8 4v16M13.5 4v10" />
  </>
));

export const CalendarIcon = icon('CalendarIcon', (
  <>
    <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
    <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
  </>
));

export const ListsIcon = icon('ListsIcon', (
  <>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth={2.4} />
  </>
));

export const ProjectsIcon = icon('ProjectsIcon', (
  <>
    <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h4.4l1.8 2h8.3A1.5 1.5 0 0 1 21.5 8.5v9A1.5 1.5 0 0 1 20 19H5.5A1.5 1.5 0 0 1 4 17.5v-11Z" />
  </>
));

export const SettingsIcon = icon('SettingsIcon', (
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.3a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1h-.3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6v-.3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1h.3a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
  </>
));

export const AllCategoriesIcon = icon('AllCategoriesIcon', (
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
  </>
));

export const GroceriesIcon = icon('GroceriesIcon', (
  <>
    <path d="M12 10c-3 0-5 2.1-5 5.2 0 3 1.8 5.3 3.6 5.3.8 0 1-.3 1.4-.3s.6.3 1.4.3c1.8 0 3.6-2.5 3.6-5.5 0-2.8-1.6-4.8-3.6-5" />
    <path d="M12 10c0-1.6.9-2.8 2.2-3.3" />
    <path d="M11.6 7c0-1-.9-1.8-2-2" />
  </>
));

export const DiyIcon = icon('DiyIcon', (
  <path d="M20.2 8.8a4.5 4.5 0 0 1-5.9 5.9L7.5 21.5 4 18l6.8-6.8a4.5 4.5 0 0 1 5.9-5.9l-3 3 1.6 1.6 3-3Z" />
));

export const ElectronicsIcon = icon('ElectronicsIcon', (
  <path d="M13 3 5 14h5l-1 8 9-12h-5l1-7Z" />
));

export const OtherIcon = icon('OtherIcon', (
  <>
    <path d="M12.6 3.5 20 10.9a2 2 0 0 1 0 2.8l-6.3 6.3a2 2 0 0 1-2.8 0L3.5 12.6V6a2.5 2.5 0 0 1 2.5-2.5h6.6Z" />
    <circle cx="8.2" cy="8.2" r="1.3" />
  </>
));

export const FilterIcon = icon('FilterIcon', (
  <path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z" />
));

export const BrainIcon = icon('BrainIcon', (
  <>
    <path d="M9.5 3.5a2.5 2.5 0 0 0-2.5 2.5v.2A2.8 2.8 0 0 0 5 8.8v.4a2.6 2.6 0 0 0-1 4.9 2.7 2.7 0 0 0 1.6 3.8A2.6 2.6 0 0 0 8 20.5a2.5 2.5 0 0 0 1.5-.5" />
    <path d="M9.5 3.5c.6 0 1.1.2 1.5.5V19c0 .8-.7 1.5-1.5 1.5" />
    <path d="M14.5 3.5a2.5 2.5 0 0 1 2.5 2.5v.2A2.8 2.8 0 0 1 19 8.8v.4a2.6 2.6 0 0 1 1 4.9 2.7 2.7 0 0 1-1.6 3.8A2.6 2.6 0 0 1 16 20.5a2.5 2.5 0 0 1-1.5-.5" />
    <path d="M14.5 3.5c-.6 0-1.1.2-1.5.5V19c0 .8.7 1.5 1.5 1.5" />
  </>
));

export function BellIcon({ width = 18, height = 18, ...props }: IconProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M12 3c-3.31 0-6 2.69-6 6v3.5L4 15v1h16v-1l-2-2.5V9c0-3.31-2.69-6-6-6z"
        strokeLinejoin="round"
      />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" strokeLinecap="round" />
    </svg>
  );
}
