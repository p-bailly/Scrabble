// Durées écoulées, dites simplement (« il y a 3 j »).

/** Il y a combien de temps ? `depuis` et `maintenant` en millisecondes. */
export function ilYa(depuis: number, maintenant = Date.now()): string {
  const minutes = Math.floor(Math.max(0, maintenant - depuis) / 60000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.floor(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  const jours = Math.floor(heures / 24)
  if (jours < 14) return `il y a ${jours} j`
  if (jours < 60) return `il y a ${Math.floor(jours / 7)} sem.`
  return `il y a ${Math.floor(jours / 30)} mois`
}

/** Nombre de jours entiers écoulés. */
export const joursEcoules = (depuis: number, maintenant = Date.now()): number => Math.floor(Math.max(0, maintenant - depuis) / 86400000)
