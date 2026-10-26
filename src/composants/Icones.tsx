// Icônes au trait (SVG), couleur héritée du texte.

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

type P = { taille?: number }

export const IconeSolo = ({ taille = 22 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)
export const IconeParties = ({ taille = 22 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
  </svg>
)
export const IconeLoupe = ({ taille = 22 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </svg>
)
export const IconeStats = ({ taille = 22 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)
export const IconeReglages = ({ taille = 22 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h11M19 18h1" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="18" r="2" />
  </svg>
)
export const IconeMelanger = ({ taille = 18 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
)
export const IconeRappeler = ({ taille = 18 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
  </svg>
)
export const IconeOk = ({ taille = 18 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base} strokeWidth={2.6}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
export const IconeCroix = ({ taille = 18 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base} strokeWidth={2.4}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)
export const IconeRetour = ({ taille = 22 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <path d="m15 18-6-6 6-6" />
  </svg>
)
export const IconePartager = ({ taille = 18 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </svg>
)
export const IconePlus = ({ taille = 18 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base} strokeWidth={2.4}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconeEffacer = ({ taille = 18 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <path d="M21 4H8l-7 8 7 8h13a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1ZM18 9l-6 6M12 9l6 6" />
  </svg>
)
export const IconeCrayon = ({ taille = 18 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)
export const IconeSac = ({ taille = 18 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <path d="M9 3h6l-1.4 3.2h-3.2L9 3Z" />
    <path d="M10.4 6.2C6 8.2 4 12 4 15.6 4 19 7.2 21 12 21s8-2 8-5.4c0-3.6-2-7.4-6.4-9.4" />
  </svg>
)
export const IconeMenu = ({ taille = 22 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base} strokeWidth={3.2}>
    <path d="M12 5h.01M12 12h.01M12 19h.01" />
  </svg>
)
export const IconeHistorique = ({ taille = 22 }: P) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M12 7v5l3 3" />
  </svg>
)
