import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSidebarContent } from "../../components/project-workspace/ProjectSidebarContent";
import { projectProgress } from "../../components/project-workspace/dashboard-data";
import type { ProjectNavigation } from "../../components/project-workspace/types";
import { safeWebUrl } from "../../services/project-web-url";
import { ChatHeader } from '../../adapters/desktop_ui/chat-ui/header/ChatHeader';
import type { ChatUIController } from '../../adapters/desktop_ui/chat-ui/useChatUIController';

afterEach(cleanup);
function navigation(): ProjectNavigation {
  return {
    name: "Proyecto A",
    section: "summary",
    currentConversationId: null,
    canCreateChat: true,
    browserOpen: false,
    conversations: [
      {
        id: "a",
        user_id: "u",
        title: "Decisiones del proyecto",
        created_at: "",
        updated_at: "",
      },
    ],
    onNavigate: vi.fn(),
    onBack: vi.fn(),
    onNewChat: vi.fn(),
    onOpenChat: vi.fn(),
    onOpenBrowser: vi.fn(),
  };
}
describe("Navegación contextual de proyectos", () => {
  it('ofrece una flecha junto al selector de modelo para volver a los chats del proyecto', () => {
    const back = vi.fn();
    const controller = { props: { onBackToProject: back }, runtime: { model: { currentModel: { name: 'Soflia Pro' }, currentThinkingOption: { name: 'Medio' } } }, state: { header: { show: true } } } as unknown as ChatUIController;
    render(<ChatHeader controller={controller} />);
    expect(screen.getByRole('button', { name: /Seleccionar modelo/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a los chats del proyecto' })); expect(back).toHaveBeenCalledOnce();
  });
  it("abre secciones, chats y navegador mediante acciones de la misma interfaz", () => {
    const model = navigation();
    render(<ProjectSidebarContent model={model} expanded />);
    expect(screen.queryByRole("tab")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir navegador del proyecto" }),
    );
    expect(model.onOpenBrowser).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: "Nuevo chat en este proyecto" }),
    );
    expect(model.onNewChat).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: "Decisiones del proyecto" }),
    );
    expect(model.onOpenChat).toHaveBeenCalledWith("a");
    fireEvent.click(screen.getByRole("button", { name: "Hitos" }));
    expect(model.onNavigate).toHaveBeenCalledWith("milestones");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Buscar chats en el proyecto" }),
      { target: { value: "otro" } },
    );
    expect(
      screen.queryByRole("button", { name: "Decisiones del proyecto" }),
    ).toBeNull();
    expect(screen.getByText("Sin coincidencias.")).toBeInTheDocument();
  });
  it("mantiene acciones accesibles al colapsar y no permite crear sin espacio autorizado", () => {
    const model = {
      ...navigation(),
      canCreateChat: false,
      chatMessage: "Espacio no preparado",
    };
    render(<ProjectSidebarContent model={model} expanded={false} />);
    expect(
      screen.getByRole("button", { name: "Nuevo chat en este proyecto" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Abrir navegador del proyecto" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Archivos" })).toBeEnabled();
    expect(screen.queryByText("Decisiones del proyecto")).toBeNull();
  });
});
describe("Datos verificables del panel", () => {
  it("distingue falta de datos y cero tareas de avance real", () => {
    expect(projectProgress(null)).toBeNull();
    expect(
      projectProgress({ tasks: { total: 0, completed: 0 } })?.percent,
    ).toBeNull();
    expect(
      projectProgress({ tasks: { total: 36, completed: 24 } })?.percent,
    ).toBe(67);
    expect(projectProgress({ tasks: { total: 2, completed: 4 } })).toBeNull();
  });
  it("no convierte credenciales o protocolos ejecutables en enlaces navegables", () => {
    expect(safeWebUrl("javascript:alert(1)")).toBeNull();
    expect(safeWebUrl("file:///C:/private")).toBeNull();
    expect(safeWebUrl("https://user:secret@example.com")).toBeNull();
    expect(safeWebUrl("https://example.com/proyecto")).toBe(
      "https://example.com/proyecto",
    );
  });
});
