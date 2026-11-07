import {
  projectManagementInputs,
  type ProjectManagementInputs,
} from "../../src/shared/project-management";
import type { ProjectHubRequestOptions } from "./types";

export function projectListQuery(input: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input))
    if (
      !["workspaceId", "projectId"].includes(key) &&
      typeof value === "string" &&
      value
    )
      params.set(key, value);
  return params.size ? `?${params}` : "";
}
/** Mapeo cerrado de capacidades; el renderer no puede elegir rutas, verbos ni cabeceras. */
export function managementRequest<K extends keyof ProjectManagementInputs>(
  operation: K,
  raw: ProjectManagementInputs[K],
): { path: string; options: ProjectHubRequestOptions } {
  const value = projectManagementInputs[operation].parse(raw);
  const base = `/api/v1/workspaces/${value.workspaceId}/projects/${value.projectId}`;
  const input =
    value as ProjectManagementInputs[keyof ProjectManagementInputs] & {
      expectedUpdatedAt?: string;
    };
  const expected = input.expectedUpdatedAt
    ? { expectedUpdatedAt: input.expectedUpdatedAt }
    : {};
  const mutation = (
    suffix: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ) => ({ path: base + suffix, options: { method, body, retry: false } });
  const read = (suffix: string) => ({ path: base + suffix, options: {} });
  switch (operation) {
    case "getTaskDetail":
      return read(
        `/tasks/${(value as ProjectManagementInputs["getTaskDetail"]).taskId}`,
      );
    case "addTaskComment": {
      const v = value as ProjectManagementInputs["addTaskComment"];
      return mutation(`/tasks/${v.taskId}/comments`, "POST", {
        content: v.content,
      });
    }
    case "listTaskDocuments": {
      const v = value as ProjectManagementInputs["listTaskDocuments"];
      return read(
        `/tasks/${v.taskId}/documents` +
          projectListQuery({ search: v.search, cursor: v.cursor }),
      );
    }
    case "createTaskDocument": {
      const v = value as ProjectManagementInputs["createTaskDocument"];
      return mutation(`/tasks/${v.taskId}/documents`, "POST", {
        document: v.document,
      });
    }
    case "updateTaskDocument": {
      const v = value as ProjectManagementInputs["updateTaskDocument"];
      return mutation(`/tasks/${v.taskId}/documents/${v.documentId}`, "PATCH", {
        updates: v.updates,
        ...expected,
      });
    }
    case "removeTaskDocument": {
      const v = value as ProjectManagementInputs["removeTaskDocument"];
      return mutation(
        `/tasks/${v.taskId}/documents/${v.documentId}` +
          projectListQuery(expected),
        "DELETE",
      );
    }
    case "createTaskLabel": {
      const v = value as ProjectManagementInputs["createTaskLabel"];
      return mutation("/task-labels", "POST", { name: v.name, color: v.color });
    }
    case "getTaskOptions":
      return read("/task-options");
    case "archiveTask": {
      const v = value as ProjectManagementInputs["archiveTask"];
      return mutation(`/tasks/${v.taskId}/archive`, "POST", expected);
    }
    case "listMilestones":
      return read("/milestones" + projectListQuery(value));
    case "createMilestone":
      return mutation("/milestones", "POST", {
        milestone: (value as ProjectManagementInputs["createMilestone"])
          .milestone,
      });
    case "updateMilestone": {
      const v = value as ProjectManagementInputs["updateMilestone"];
      return mutation(`/milestones/${v.milestoneId}`, "PATCH", {
        updates: v.updates,
        ...expected,
      });
    }
    case "cancelMilestone": {
      const v = value as ProjectManagementInputs["cancelMilestone"];
      return mutation(
        `/milestones/${v.milestoneId}${projectListQuery(expected)}`,
        "DELETE",
      );
    }
    case "getProjectTeam":
      return read("/team");
    case "assignProjectTeam":
      return mutation("/team", "PATCH", {
        teamId: (value as ProjectManagementInputs["assignProjectTeam"]).teamId,
        ...expected,
      });
    case "createProjectTeam":
      return mutation("/team", "POST", {
        team: (value as ProjectManagementInputs["createProjectTeam"]).team,
      });
    case "updateProjectTeam": {
      const v = value as ProjectManagementInputs["updateProjectTeam"];
      return mutation(`/team/${v.teamId}`, "PATCH", {
        updates: v.updates,
        ...expected,
      });
    }
    case "addTeamMember": {
      const v = value as ProjectManagementInputs["addTeamMember"];
      return mutation(`/team/${v.teamId}/members`, "POST", {
        userId: v.userId,
        role: v.role,
      });
    }
    case "updateTeamMember": {
      const v = value as ProjectManagementInputs["updateTeamMember"];
      return mutation(`/team/${v.teamId}/members/${v.memberId}`, "PATCH", {
        role: v.role,
      });
    }
    case "removeTeamMember": {
      const v = value as ProjectManagementInputs["removeTeamMember"];
      return mutation(`/team/${v.teamId}/members/${v.memberId}`, "DELETE");
    }
    case "listDocuments":
      return read("/documents" + projectListQuery(value));
    case "createDocument":
      return mutation("/documents", "POST", {
        document: (value as ProjectManagementInputs["createDocument"]).document,
      });
    case "updateDocument": {
      const v = value as ProjectManagementInputs["updateDocument"];
      return mutation(`/documents/${v.documentId}`, "PATCH", {
        updates: v.updates,
        ...expected,
      });
    }
    case "removeDocument": {
      const v = value as ProjectManagementInputs["removeDocument"];
      return mutation(
        `/documents/${v.documentId}${projectListQuery(expected)}`,
        "DELETE",
      );
    }
    case "updateEvidence": {
      const v = value as ProjectManagementInputs["updateEvidence"];
      return mutation(`/evidence/${v.evidenceId}`, "PATCH", {
        updates: v.updates,
      });
    }
    case "archiveEvidence":
      return mutation(
        `/evidence/${(value as ProjectManagementInputs["archiveEvidence"]).evidenceId}`,
        "DELETE",
      );
    default:
      throw new Error("Operación de proyecto desconocida.");
  }
}
