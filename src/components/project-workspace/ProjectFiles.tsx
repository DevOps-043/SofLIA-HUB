import { useState } from "react";
import { projectHubApi } from "../../services/project-hub-api";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { Field, fieldClass, MoreButton } from "./ManagementControls";

import { useProjectCollection } from "./useProjectCollection";
import { ProjectResources } from "./ProjectResources";
import { ProjectDocuments } from "./ProjectDocuments";
import { ProjectStorageFiles } from '../project-creation/ProjectStorageFiles';

export function ProjectFiles({
  workspaceId,
  projectId,
  kind,
  canWrite,
  canManage,
  onRefresh,
  onOpenWeb,
}: {
  workspaceId: string;
  projectId: string;
  kind: "files" | "web";
  canWrite: boolean;
  canManage: boolean;
  onRefresh: () => void;
  onOpenWeb?: (url: string) => void;
}) {
  const [search, setSearch] = useState("");
  const list = useProjectCollection(
    JSON.stringify([workspaceId, projectId, search]),
    (cursor) =>
      projectHubApi.listEvidence(workspaceId, projectId, {
        search: search || undefined,
        cursor,
      }),
    "evidence_id",
  );
  const refresh = () => {
    list.reload();
    onRefresh();
  };
  return (
    <div className="space-y-5">
      {kind === 'files' && <ProjectStorageFiles key={`${workspaceId}/${projectId}`} workspaceId={workspaceId} projectId={projectId} canWrite={canWrite} onOpenWeb={onOpenWeb} />}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Field label="Buscar archivos y recursos">
            <TextField
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>
        <Button size="sm" variant="ghost" onClick={refresh}>
          Actualizar recursos
        </Button>
      </div>
      <ProjectResources
        workspaceId={workspaceId}
        projectId={projectId}
        kind={kind}
        allowUpload={false}
        state={list.state}
        canWrite={canWrite}
        canManage={canManage}
        onRefresh={refresh}
        onOpenWeb={onOpenWeb}
      />
      <MoreButton
        hasMore={list.hasMore}
        loading={list.moreLoading}
        onMore={() => void list.more()}
      />
      {kind === "files" && (
        <ProjectDocuments
          workspaceId={workspaceId}
          projectId={projectId}
          canWrite={canWrite}
          canManage={canManage}
          onRefresh={onRefresh}
          onOpenWeb={onOpenWeb}
        />
      )}
    </div>
  );
}
