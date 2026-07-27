/** Inline SVG icons, sized by the `size` prop and coloured via `currentColor`. */

interface IconProps {
  size?: number;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const CursorIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M5 3l6.5 16 2.3-6.6 6.7-2.3z" fill="currentColor" stroke="none" />
  </svg>
);

/** Pen / polygon tool — matches the draw tool in the design's floating toolbar. */
export const PolygonIcon = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 3.2l7 4v6.6l-7 4-7-4V7.2z" />
    <circle cx="12" cy="3.2" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export const EyeIcon = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M2 12s3.6-6.2 10-6.2S22 12 22 12s-3.6 6.2-10 6.2S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.7" />
  </svg>
);

export const EyeOffIcon = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M9.9 5.1A10.9 10.9 0 0 1 12 4.9c6.4 0 10 6.2 10 6.2a18 18 0 0 1-3.1 3.9M6.3 6.4A17.7 17.7 0 0 0 2 11.1s3.6 6.2 10 6.2a10.6 10.6 0 0 0 4.1-.8" />
    <path d="M10.1 9.3a2.8 2.8 0 0 0 3.9 3.9" />
    <path d="M3 3l18 18" />
  </svg>
);

export const TrashIcon = ({ size = 15 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 6.5h16M9.5 6.5V4.8h5V6.5" />
    <path d="M6.4 6.5l.9 12.1a1.4 1.4 0 0 0 1.4 1.3h6.6a1.4 1.4 0 0 0 1.4-1.3l.9-12.1" />
    <path d="M10.3 10v6.3M13.7 10v6.3" />
  </svg>
);

export const SearchIcon = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

export const AlertIcon = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.6v5M12 16.1v.1" />
  </svg>
);

export const CheckIcon = ({ size = 14 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
);
