const paths: Record<string, string> = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  dashboard: "M4 20V10 M12 20V4 M20 20v-7 M2 20h20",
  activity: "M9 5H5v16h14V5h-4 M9 3h6v4H9z M8 12h8 M8 16h5",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  businesses: "M4 21V3h12v18 M16 9h4v12 M2 21h20 M8 7h4 M8 11h4 M8 15h4",
  services: "M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3",
  categories: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  reviews: "m12 3 2.8 5.7 6.3.9-4.55 4.4 1.1 6.3L12 17.3l-5.65 3 1.1-6.3L2.9 9.6l6.3-.9Z",
  commercial: "M3 8h18v13H3z M8 8V4h8v4 M3 13h18 M10 13v3h4v-3",
  subscriptions: "M3 5h18v14H3z M3 10h18 M7 15h3",
  coupons: "M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z M14 5v3 M14 11v2 M14 16v3",
  adsCredits: "M3 6h18v14H3z M3 10h18 M15 14h3 M3 6l15-3v3",
  aiCredits: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z M20 3v4 M18 5h4",
  alerts: "m12 3 10 18H2Z M12 9v5 M12 17v.01",
  notifications: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  inconsistencies: "M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4 M12 7v5 M12 15v.01",
  communication: "M3 4h18v13H8l-5 4Z M7 8h10 M7 12h7",
  security: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7Z m-4 9 3 3 5-6",
  sounds: "M4 10h4l5-5v14l-5-5H4z M17 8a6 6 0 0 1 0 8 M20 5a10 10 0 0 1 0 14",
  referenceImages: "M3 3h18v18H3z M3 16l6-6 5 5 3-3 4 4 M16 7h.01",
  presentation: "M3 5h18v14H3z m7 4 5 3-5 3Z",
  customization: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
  profile: "M20 21v-2a7 7 0 0 0-14 0v2 M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16 m6-2 5 5",
  quotes: "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h4",
  receipts: "M5 3h14v18l-3-2-4 2-4-2-3 2Z M8 7h8 M8 11h8 M8 15h4",
  proposals: "M5 3h10l4 4v14H5z M15 3v5h4 M8 12h8 M8 16h6",
  ads: "M3 9v6h4l11 5V4L7 9Z M7 15l2 6h3l-2-5 M21 9v6",
  team: "M3 5h18v16H3z M3 10h18 M7 3v4 M17 3v4 M7 14h2 M15 14h2 M7 18h2",
};

/** Decorative, fixed-size icons leave the visible menu label as the accessible name. */
export function PanelMenuIcon({ name }: { name: string }) {
  return <svg className="panel-menu-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name] ?? paths.customization} /></svg>;
}
