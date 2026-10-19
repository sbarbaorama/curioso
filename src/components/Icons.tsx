const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const HomeIcon = () => (
  <svg {...base}>
    <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />
  </svg>
);

export const ReviewIcon = () => (
  <svg {...base}>
    <path d="M12 4a8 8 0 1 0 8 8" />
    <path d="M20 4v5h-5" />
  </svg>
);

export const ProgressIcon = () => (
  <svg {...base}>
    <path d="M4 19 10 12l4 4 6-8" />
  </svg>
);

export const SettingsIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </svg>
);

export const LanguagesIcon = () => (
  <svg {...base}>
    <path d="M4 5h9v7H8l-3 3v-3H4z" />
    <path d="M13 9h7v7h-1v3l-3-3h-3v-3" />
  </svg>
);
