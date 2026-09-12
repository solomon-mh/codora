/**
 * Inline stroke icons.
 *
 * Inline SVG rather than an icon font or sprite sheet: the webview CSP allows
 * no remote assets, and Codora's panels need a handful of glyphs at one weight.
 * Every icon inherits `currentColor` and scales from a single `size` prop, so
 * an icon always matches the text it sits beside.
 */

import type { ReactNode } from 'react';

export interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Svg({
  size = 16,
  className,
  strokeWidth = 1.6,
  children,
}: IconProps & { children: ReactNode }): JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', display: 'block' }}
    >
      {children}
    </svg>
  );
}

export const IconGrid = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </Svg>
);

export const IconHistory = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M3.05 11a9 9 0 1 0 2.67-7.06" />
    <path d="M3 3.5V9h5.5" />
    <path d="M12 7.5V12l3.5 2" />
  </Svg>
);

export const IconCube = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 2.75 20.5 7v10L12 21.25 3.5 17V7z" />
    <path d="M3.5 7 12 11.5 20.5 7" />
    <path d="M12 11.5v9.75" />
  </Svg>
);

export const IconSliders = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="16" cy="18" r="2" />
  </Svg>
);

export const IconSpark = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </Svg>
);

export const IconFlame = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 3s4.5 3.6 4.5 8.2c0 1.6-.6 2.9-1.6 3.8.3-1.9-.6-3.6-2.2-4.6.3 2.4-.9 3.6-2.2 4.6-1-.9-1.5-2-1.5-3.3C9 9.4 12 8 12 3z" />
    <path d="M6.5 14.5a5.5 5.5 0 0 0 11 0c0 3.9-2.5 6.5-5.5 6.5s-5.5-2.6-5.5-6.5z" />
  </Svg>
);

export const IconCheck = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4.5 12.5 9 17l10.5-10.5" />
  </Svg>
);

export const IconCheckCircle = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.2l2.7 2.7L16.2 9.4" />
  </Svg>
);

export const IconXCircle = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Svg>
);

export const IconAlert = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 3.8 21 19.5H3z" />
    <path d="M12 9.5v4.2M12 16.8v.01" />
  </Svg>
);

export const IconArrowUp = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);

export const IconArrowDown = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
);

export const IconArrowRight = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const IconChevronDown = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);

export const IconBulb = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 1 3.6 10.8c-.6.5-.9 1-.9 1.7v.5h-5.4v-.5c0-.7-.3-1.2-.9-1.7A6 6 0 0 1 12 3z" />
  </Svg>
);

export const IconMedal = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="12" cy="14.5" r="5.5" />
    <path d="M12 12.6l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" />
    <path d="M8 8.5 6 3h12l-2 5.5" />
  </Svg>
);

export const IconLock = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Svg>
);

export const IconPlay = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M8 5.5l10 6.5-10 6.5z" />
  </Svg>
);

export const IconShield = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 3l7.5 3v5.5c0 4.4-3 8-7.5 9.5-4.5-1.5-7.5-5.1-7.5-9.5V6z" />
    <path d="M9.2 12.2l2 2 3.6-3.8" />
  </Svg>
);

export const IconTrash = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13" />
    <path d="M10.5 11v5.5M13.5 11v5.5" />
  </Svg>
);

export const IconBell = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M18 15.5V10a6 6 0 0 0-12 0v5.5L4.5 18h15z" />
    <path d="M10 21h4" />
  </Svg>
);

export const IconClock = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3.2 2" />
  </Svg>
);

export const IconGauge = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M3.5 18a9 9 0 1 1 17 0" />
    <path d="M12 18l4-5.5" />
    <circle cx="12" cy="18" r="1.4" />
  </Svg>
);

export const IconLayers = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 3 3.5 7.2 12 11.4l8.5-4.2z" />
    <path d="M3.5 12.2 12 16.4l8.5-4.2" />
    <path d="M3.5 16.8 12 21l8.5-4.2" />
  </Svg>
);

export const IconFile = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M6 3h7l5 5v13H6z" />
    <path d="M13 3v5h5" />
  </Svg>
);

export const IconTarget = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" />
  </Svg>
);

export const IconPanelLeft = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M9.5 4v16" />
  </Svg>
);

export const IconRefresh = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 0 0-14-4.5L4 9" />
    <path d="M4 4.5V9h4.5" />
    <path d="M4 13a8 8 0 0 0 14 4.5l2-2.5" />
    <path d="M20 19.5V15h-4.5" />
  </Svg>
);

export const IconTerminal = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M7.5 9.5 10 12l-2.5 2.5M12.5 15h4" />
  </Svg>
);

export const IconKey = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="8" cy="12" r="4" />
    <path d="M12 12h9M17.5 12v3M20 12v2" />
  </Svg>
);
