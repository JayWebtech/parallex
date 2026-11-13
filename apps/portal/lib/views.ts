import type { Project } from '@parallax/db';

/** What the API returns for a project. Internal IDs (owner, Umami website) stay server-side. */
export interface ProjectView {
  id: string;
  name: string;
  domains: string[];
  stellarId: string;
  stellarIdKind: Project['stellarIdKind'];
  stellarNetwork: Project['stellarNetwork'];
  scfUrl: string | null;
  status: Project['status'];
  createdAt: string;
}

export function toProjectView(p: Project): ProjectView {
  return {
    id: p.id,
    name: p.name,
    domains: p.domains,
    stellarId: p.stellarId,
    stellarIdKind: p.stellarIdKind,
    stellarNetwork: p.stellarNetwork,
    scfUrl: p.scfUrl,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  };
}
