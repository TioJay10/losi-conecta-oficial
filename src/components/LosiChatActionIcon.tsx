const paths = {
  reply: 'm9 10-5 4 5 4 M4 14h10a6 6 0 0 0 6-6V5',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  close: 'm6 6 12 12 M18 6 6 18',
  back: 'm10 5-7 7 7 7 M3 12h18',
} as const;

export function LosiChatActionIcon({ name }: { name: keyof typeof paths }) {
  return <svg className="lc-message-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
