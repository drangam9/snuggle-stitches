const paths = {
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  'arrow-up': 'M6 18 18 6M6 6h12v12',
  'arrow-down': 'M12 4v16m-6-6 6 6 6-6',
  'arrow-left': 'M20 12H4m6-6-6 6 6 6',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5ZM7 10h10M7 14h6',
  instagram: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm9 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm1-5h.01',
  tiktok: 'M14 3v11.5a4.5 4.5 0 1 1-4-4.47M14 3c1 4 3 6 7 6',
  spark: 'm12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2Z',
  gift: 'M3 8h18v5H3zm2 5v8h14v-8M12 8v13M12 8C3 9 4 1 8 3c2 1 4 5 4 5Zm0 0c9 1 8-7 4-5-2 1-4 5-4 5Z',
} as const

export function Icon({ name, size = 24 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

export function Doodle({ kind, className = '' }: { kind: 'yarn' | 'flower' | 'spark' | 'arrow' | 'squiggle'; className?: string }) {
  return (
    <svg className={`doodle ${className}`} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'yarn' && <><circle cx="45" cy="47" r="32" /><path d="M20 27c24 1 43 20 53 39M14 39c22 1 40 17 48 37M16 54c14 1 29 10 36 24M34 17C22 32 20 43 23 56M49 15C37 29 34 42 37 49M63 23 49 37M68 53l8-35m-3 2 5 1M74 63c17 7 15 22 4 20-9-2-4-12 3-10" /></>}
      {kind === 'flower' && <><path d="M50 35C22-9 7 19 28 39-17 38-4 70 31 61 6 91 41 111 50 75c10 38 46 14 20-14 40 10 49-25 4-22C98 10 65-9 50 35Z" fill="currentColor" stroke="none" /><circle cx="51" cy="52" r="12" fill="var(--cream, #fbf8f1)" stroke="none" /></>}
      {kind === 'spark' && <path d="M50 3c2 34 13 45 47 47-34 2-45 13-47 47C48 63 37 52 3 50c34-2 45-13 47-47Z" fill="currentColor" stroke="none" />}
      {kind === 'arrow' && <path d="M89 15C82 85 46 94 31 69 7 29 65 30 41 59 31 70 17 66 7 63m3-11L6 64l12 4" />}
      {kind === 'squiggle' && <path d="M9 65c9 0 9-30 18-30s9 30 18 30 9-30 18-30 9 30 18 30 9-30 18-30" />}
    </svg>
  )
}
