import { ProjectFileCollection } from './ProjectFileCollection';
import { ProjectWebPages } from './ProjectWebPages';

export function ProjectFiles(props: { workspaceId: string; projectId: string; kind: 'files' | 'web'; canWrite: boolean; canManage: boolean; onRefresh(): void; onOpenWeb?(url: string): void; onOpenBrowser?(): void }) {
  return props.kind === 'files' ? <ProjectFileCollection key={`${props.workspaceId}/${props.projectId}`} {...props} /> : <ProjectWebPages key={`${props.workspaceId}/${props.projectId}`} {...props} />;
}
