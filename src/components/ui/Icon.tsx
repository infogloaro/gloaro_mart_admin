/**
 * Inline stroke icons on a 24×24 grid.
 *
 * Kept in-repo rather than pulled from an icon package so the admin bundle does
 * not grow by a dependency for the ~50 glyphs the sidebar needs.
 */
const PATHS = {
  dashboard: 'M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  box: 'M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7ZM3 8.5 12 14l9-5.5M12 14v7',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5',
  tag: 'M3 3h7.5L21 13.5 13.5 21 3 10.5V3ZM7 7h.01',
  sliders: 'M4 6h16M4 12h16M4 18h16M9 3v6M15 9v6M7 15v6',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3ZM9 12l2 2 4-4',
  upload: 'M12 16V4m0 0L8 8m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  package: 'M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7ZM7.5 5.8l9 5.2M12 21v-9.5',
  store: 'M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9l1.5-5h15L21 9a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0ZM9 20v-6h6v6',
  idcard: 'M3 5h18v14H3zM8.5 11a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM5.5 16c.4-1.7 1.6-2.6 3-2.6s2.6.9 3 2.6M14.5 9.5H19M14.5 13H19',
  map: 'm9 4-6 2.5v13L9 17l6 2.5L21 17V4l-6 2.5L9 4Zm0 0v13m6-10.5v13',
  percent: 'M19 5 5 19M7.5 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm9 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  gauge: 'M4 18a9 9 0 1 1 16 0M12 14l4-4',
  cart: 'M2.5 3.5h2.2l2.3 11h10.4l2.1-8H6M9 20.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm8 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z',
  tower: 'M12 3v18M8 3 5 21M16 3l3 18M7 11h10M6 16h12',
  route: 'M6.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm11 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6.5 8v4a4 4 0 0 0 4 4h3a4 4 0 0 1 4 4',
  truck: 'M3 6h11v10H3zM14 9h4l3 3.5V16h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  mappin: 'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  bike: 'M5.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm13 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM9 16.5l3.5-6.5M12.5 10 10 6h4m1 10.5-3-9.5m4.5-1.5h2',
  wallet: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H18v2.5M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M3 7.5h16a2 2 0 0 1 2 2V15M21 15h-4a2 2 0 0 1 0-4h4',
  card: 'M3 6h18v12H3zM3 10h18M6.5 14.5h3',
  refund: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3 4v5h5',
  receipt: 'M5 3h14v18l-2.5-1.6L14 21l-2-1.6L10 21l-2.5-1.6L5 21V3Zm3.5 5h7m-7 4h7m-7 4h4',
  coins: 'M9 11a5.5 3 0 1 0 0-6 5.5 3 0 0 0 0 6Zm-5.5-3v4c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3V8m1.5 5.5c2.4.3 4 1.4 4 2.8 0 1.7-2.5 3-5.5 3s-5.5-1.3-5.5-3',
  note: 'M5 3h9l5 5v13H5V3Zm9 0v5h5M8.5 13h7m-7 4h4',
  undo: 'M3 9h11a5.5 5.5 0 0 1 0 11H8M3 9l4.5-4.5M3 9l4.5 4.5',
  swap: 'M4 8h13l-3.5-3.5M20 16H7l3.5 3.5',
  ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8',
  headset: 'M4 14v-2a8 8 0 0 1 16 0v2M4 13h2.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Zm16 0h-2.5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1v-5Zm-3.5 6.5c0 1.2-1.5 2-3.5 2',
  star: 'm12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.5Z',
  briefcase: 'M3 8h18v12H3zM8.5 8V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V8M3 13h18',
  filetext: 'M6 3h8l4.5 4.5V21H6V3Zm8 0v4.5h4.5M9.5 12h6m-6 4h6',
  quote: 'M6 3h12v18l-6-3.5L6 21V3Zm3 5h6m-6 4h4',
  clipboard: 'M9 4H6v17h12V4h-3M9 4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v1.5H9V4Zm-.5 9h7m-7 4h4',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  menu: 'M4 6h16M4 12h16M4 18h10',
  sections: 'M3 4h18v5H3zM3 12h8v8H3zM14 12h7v8h-7z',
  megaphone: 'M3 10v4a1 1 0 0 0 1 1h3l7 4.5V4.5L7 9H4a1 1 0 0 0-1 1Zm15-2a5 5 0 0 1 0 8M7 15v4.5',
  bell: 'M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5ZM10 19.5a2.2 2.2 0 0 0 4 0',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 9c.6-3.6 3.3-5.5 7-5.5s6.4 1.9 7 5.5M16 4.5a3.5 3.5 0 0 1 0 7m1.5 3.2c2.5.6 4.1 2.4 4.5 5.3',
  network: 'M12 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM5 16a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm14 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM12 8v4m0 0H5v4m7-4h7v4',
  gift: 'M3 11h18v10H3zM3 7h18v4H3zM12 7v14M12 7S9.5 3 7.5 4.2 9.5 7 12 7Zm0 0s2.5-4 4.5-2.8S14.5 7 12 7Z',
  lock: 'M5 11h14v10H5zM8 11V7.5a4 4 0 0 1 8 0V11M12 15v2.5',
  history: 'M3.5 12a8.5 8.5 0 1 1 2.6 6.1M3 20v-5h5M12 7.5V12l3 2',
  flag: 'M5 21V4m0 0 8 1.5L19 4v10l-6 1.5L5 14',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5c0-.6-.06-1.1-.17-1.7l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2.9-1.7L14.3 2h-4l-.33 2.7a8 8 0 0 0-2.9 1.7l-2.3-1-2 3.4 2 1.5a8.6 8.6 0 0 0 0 3.4l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2.9 1.7L10.3 22h4l.33-2.7a8 8 0 0 0 2.9-1.7l2.3 1 2-3.4-2-1.5c.11-.6.17-1.1.17-1.7Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5.5-1.5L21 21',
  logout: 'M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M15.5 16.5 20 12l-4.5-4.5M20 12H9',
  chevron: 'm9 6 6 6-6 6',
  sparkle: 'm12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm7 9.5.9 2.3 2.1.7-2.1.7-.9 2.3-.9-2.3-2.1-.7 2.1-.7.9-2.3Z',
  bolt: 'M13.5 2 4 13.5h6L10.5 22 20 10.5h-6L13.5 2Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3.5 2',
  x: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 3 1.8 20.5h20.4L12 3Zm0 6v5m0 3.2h.01',
  chat: 'M4 5h16v11H9l-5 4V5Zm4 4.5h8m-8 3.5h5',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2',
  calendar: 'M4 6h16v14H4zM4 10h16M8.5 3v4m7-4v4',
  /* Sidebar collapse — a rail beside the page. */
  panel: 'M3 5h18v14H3zM9 5v14',
  trendup: 'm4 16 5-5 3.5 3.5L20 7m0 0h-5m5 0v5',
  trenddown: 'm4 8 5 5 3.5-3.5L20 17m0 0h-5m5 0v-5',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  className?: string;
  /** Stroke weight — 1.6 reads well at 18px, 1.8 at 14px. */
  strokeWidth?: number;
}

export function Icon({ name, className = 'h-[18px] w-[18px]', strokeWidth = 1.7 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
