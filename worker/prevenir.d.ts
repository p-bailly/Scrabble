export function traiter(
  requete: Request,
  config: { projectId: string },
  dep: { verifierJeton: (jeton: string) => Promise<string | null>; google: any },
): Promise<Response>
