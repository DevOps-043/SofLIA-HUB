import { useEffect } from "react";
import type { Folder } from "../../services/folder-service";
import { ProjectSourcesTab } from "../project-hub/ProjectSourcesTab";
import { useProjectSources } from "../project-hub/useProjectSources";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { dateLabel } from "./dashboard-data";
import { PROJECT_SECTIONS, type ProjectNavigation } from "./types";

/** Presentación de las carpetas anteriores sin convertirlas en proyectos IRIS. */
export function FolderProjectPanel({
  folder,
  navigation,
  userId,
  orgId,
}: {
  folder: Folder;
  navigation: ProjectNavigation;
  userId: string;
  orgId: string;
}) {
  const sources = useProjectSources({ folderId: folder.id, userId, orgId });
  const load = sources.loadSourcesData;
  useEffect(() => {
    if (navigation.section === "files" || navigation.section === "web")
      void load();
  }, [load, navigation.section]);
  return (
    <div className="project-workspace custom-scrollbar h-full min-w-0 flex-1 overflow-y-auto p-4 text-primary md:p-7">
      <header className="mb-6">
        <p className="mb-3 text-xs text-secondary">Proyectos / {folder.name}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {folder.name}
          </h1>
          <Button
            size="sm"
            className="!rounded-2xl"
            disabled={!navigation.canCreateChat}
            onClick={navigation.onNewChat}
          >
            Nuevo chat
          </Button>
        </div>
        <p className="mt-2 text-sm text-secondary">
          {folder.description || "Conversaciones y recursos de este proyecto."}
        </p>
      </header>
      {navigation.section === "summary" && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-secondary">Chats del proyecto</p>
              <p className="mt-3 text-3xl font-semibold">
                {navigation.conversations.length}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-secondary">Creado</p>
              <p className="mt-3 text-sm font-semibold">
                {dateLabel(folder.created_at)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-secondary">Acceso al espacio</p>
              <p className="mt-3 text-sm font-semibold">
                {folder.can_edit === false ? "Sólo lectura" : "Edición"}
              </p>
            </Card>
          </div>
          <Card>
            <h2 className="text-sm font-semibold">Recursos del proyecto</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigation.onNavigate("files")}
              >
                Archivos y fuentes
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigation.onNavigate("chats")}
              >
                Chats del proyecto
              </Button>
            </div>
          </Card>
          <Card>
            <h2 className="text-sm font-semibold">Seguimiento del trabajo</h2>
            <p className="mt-3 text-sm text-secondary">
              Este espacio conserva sus carpetas y conversaciones. Tareas,
              hitos, ciclos y métricas de negocio requieren vincular un proyecto
              de gestión; no se generan automáticamente.
            </p>
          </Card>
        </div>
      )}
      {navigation.section === "chats" && (
        <Card>
          <h2 className="text-lg font-semibold">Chats del proyecto</h2>
          <p className="my-3 text-xs text-secondary">
            Los chats nuevos permanecen en este espacio. No se mueven al salir
            del panel.
          </p>
          <div className="space-y-1">
            {navigation.conversations.map((chat) => (
              <button
                type="button"
                key={chat.id}
                onClick={() => navigation.onOpenChat(chat.id)}
                className="project-nav-button"
              >
                {chat.title}
              </button>
            ))}
            {!navigation.conversations.length && (
              <p className="text-sm text-secondary">
                Aún no hay conversaciones.
              </p>
            )}
          </div>
        </Card>
      )}
      {(navigation.section === "files" || navigation.section === "web") && (
        <ProjectSourcesTab
          {...sources}
          hasWorkspaceIdentity={Boolean(userId && orgId)}
          onCloseDrivePicker={() => sources.setShowDrivePicker(false)}
          onDriveSearchChange={sources.setDriveSearch}
          onDriveSelect={sources.handleDriveSelect}
          onFileUpload={sources.handleFileUpload}
          onOpenDrivePicker={sources.openDrivePicker}
          onOpenSource={sources.handleOpenSource}
          onRemoveSource={sources.handleRemoveSource}
          onSearchDrive={() =>
            sources.loadDriveFiles(sources.driveSearch.trim() || undefined)
          }
          onToggleAddMenu={() => sources.setShowAddMenu(!sources.showAddMenu)}
          onUploadClick={sources.triggerUpload}
        />
      )}
      {!["summary", "files", "web", "chats", "chat"].includes(
        navigation.section,
      ) && (
        <Card>
          <h2 className="text-lg font-semibold">
            {
              PROJECT_SECTIONS.find((item) => item.id === navigation.section)
                ?.label
            }
          </h2>
          <p className="mt-3 text-sm text-secondary">
            Este apartado requiere un proyecto de gestión vinculado. Las
            carpetas y sus datos actuales permanecen intactos.
          </p>
        </Card>
      )}
    </div>
  );
}
