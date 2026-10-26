import { TextField } from "../ui/TextField";
import { useState } from "react";
import { Button } from "../ui/Button";
import { ProjectGlyph } from "./ProjectGlyph";
import { PROJECT_SECTIONS, type ProjectNavigation } from "./types";

export function ProjectSidebarContent({
  model,
  expanded,
}: {
  model: ProjectNavigation;
  expanded: boolean;
}) {
  const [query, setQuery] = useState("");
  const chats = model.conversations.filter((chat) =>
    chat.title.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")),
  );
  return (
    <div
      className="flex min-h-0 flex-1 flex-col px-2 pb-2"
      style={{ fontFamily: "var(--font-system-ui)" }}
    >
      <button
        type="button"
        onClick={model.onBack}
        title="Todos los proyectos"
        aria-label="Todos los proyectos"
        className="project-nav-button shrink-0 text-secondary"
      >
        <ProjectGlyph name="back" />
        {expanded && <span>Todos los proyectos</span>}
      </button>
      {expanded && (
        <div className="px-2.5 pb-3 pt-2">
          <p
            className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-secondary"
            style={{ fontFamily: "var(--font-system-label)" }}
          >
            Proyecto
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-2 text-[13px] font-semibold text-primary">
            <ProjectGlyph name="folder" />
            <span className="truncate" title={model.name}>
              {model.name}
            </span>
          </p>
        </div>
      )}
      <div
        className={`flex shrink-0 gap-1.5 px-1 py-1 ${expanded ? "" : "flex-col items-center"}`}
      >
        <Button
          size="sm"
          className={`!rounded-2xl ${expanded ? "min-w-0 flex-1" : "!p-2.5"}`}
          disabled={!model.canCreateChat}
          onClick={model.onNewChat}
          title={model.chatMessage || "Nuevo chat en este proyecto"}
          aria-label="Nuevo chat en este proyecto"
          icon={<ProjectGlyph name="plus" />}
        >
          {expanded && "Nuevo chat"}
        </Button>
        <button
          type="button"
          onClick={model.onOpenBrowser}
          aria-label="Abrir navegador del proyecto"
          aria-pressed={model.browserOpen}
          title="Navegador del proyecto"
          className={`project-nav-button !w-10 !justify-center !px-0 ${model.browserOpen ? "bg-accent/10 text-accent" : "text-secondary"}`}
        >
          <ProjectGlyph name="browser" />
        </button>
      </div>
      {expanded && (
        <div className="mx-1 my-2 shrink-0">
          <TextField
            aria-label="Buscar chats en el proyecto"
            placeholder="Buscar en el proyecto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="!rounded-2xl !py-2 !text-xs"
            icon={
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m17 17 5 5" />
              </svg>
            }
          />
        </div>
      )}
      <nav
        aria-label="Apartados del proyecto"
        className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto"
      >
        {PROJECT_SECTIONS.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => model.onNavigate(item.id)}
            aria-label={item.label}
            aria-current={model.section === item.id ? "page" : undefined}
            title={expanded ? undefined : item.label}
            className={`project-nav-button project-nav-link ${model.section === item.id ? "bg-accent/10 font-semibold text-accent" : "text-secondary"}`}
          >
            <span className="project-nav-icon"><ProjectGlyph name={item.id} /></span>
            {expanded && <span className="truncate">{item.label}</span>}
          </button>
        ))}
        {expanded && (
          <section
            className="mt-3 border-t border-border pt-3"
            aria-label="Chats recientes del proyecto"
          >
            <div className="flex items-center justify-between px-2.5">
              <h2 className="text-[9.5px] font-semibold uppercase tracking-wider text-secondary">
                Chats recientes
              </h2>
              <button
                type="button"
                onClick={() => model.onNavigate("chats")}
                className="rounded-full px-2 py-1 text-[10px] text-accent focus-visible:ring-2 focus-visible:ring-accent"
              >
                Ver todos
              </button>
            </div>
            {chats.slice(0, query ? 50 : 5).map((chat) => (
              <button
                type="button"
                key={chat.id}
                onClick={() => model.onOpenChat(chat.id)}
                className={`project-nav-button !text-xs ${model.section === "chat" && model.currentConversationId === chat.id ? "bg-accent/10 text-accent" : "text-secondary"}`}
                title={chat.title}
              >
                <ProjectGlyph name="chats" size={16} />
                <span className="truncate">
                  {chat.is_pinned ? "· " : ""}
                  {chat.title}
                </span>
              </button>
            ))}
            {!chats.length && (
              <p className="px-2.5 py-2 text-xs text-secondary">
                {query
                  ? "Sin coincidencias."
                  : model.chatMessage || "Aún no hay chats en este proyecto."}
              </p>
            )}
            {model.chatMessage && model.onRetryChats && <button type="button" onClick={model.onRetryChats} className="mt-1 px-2.5 py-1 text-xs text-accent">Actualizar chats</button>}
          </section>
        )}
      </nav>
    </div>
  );
}
