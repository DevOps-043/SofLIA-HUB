import { z } from "zod";

const uuid = z.string().uuid();
const target = z.object({ workspaceId: uuid, projectId: uuid }).strict();
const nonempty = (value: object) =>
  Object.values(value).some((item) => item !== undefined);
const name = z.string().trim().min(1).max(255);
const date = z.iso.date();
export const projectPage = z
  .object({
    cursor: z.string().max(2000).optional(),
    search: z.string().trim().max(255).optional(),
  })
  .strict();
export const projectTaskFilters = projectPage.extend({
  statusId: uuid.optional(),
  assigneeId: uuid.optional(),
  priorityId: uuid.optional(),
  cycleId: uuid.optional(),
});
export const milestoneFields = z
  .object({
    name,
    description: z.string().max(20000).nullable().optional(),
    target_date: date,
    status: z
      .enum(["pending", "in_progress", "completed", "missed", "cancelled"])
      .optional(),
    sort_order: z.number().int().min(0).max(1000000).optional(),
  })
  .strict();
const expected = z.iso.datetime({ offset: true }).optional();
const externalUrl = z
  .string()
  .url()
  .max(4000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  });
export const linkedDocument = z
  .object({
    name,
    provider: z.enum([
      "google_drive",
      "google_sheets",
      "google_docs",
      "internal",
    ]),
    external_id: z.string().min(1).max(500),
    external_url: externalUrl,
    doc_type: z.enum([
      "spreadsheet",
      "document",
      "presentation",
      "folder",
      "other",
    ]),
    mime_type: z.string().max(255).nullable().optional(),
  })
  .strict();
export const teamFields = z
  .object({
    name,
    description: z.string().max(20000).nullable().optional(),
    visibility: z.enum(["public", "private", "internal"]).optional(),
  })
  .strict();
export const teamMemberRole = z.enum([
  "admin",
  "moderator",
  "member",
  "viewer",
]);
export const projectManagementInputs = {
  getTaskDetail: target.extend({ taskId: uuid }),
  addTaskComment: target.extend({
    taskId: uuid,
    content: z.string().trim().min(1).max(20000),
  }),
  listTaskDocuments: target.extend({ taskId: uuid, ...projectPage.shape }),
  createTaskDocument: target.extend({ taskId: uuid, document: linkedDocument }),
  updateTaskDocument: target.extend({
    taskId: uuid,
    documentId: uuid,
    updates: z
      .object({ name, doc_type: linkedDocument.shape.doc_type.optional() })
      .strict(),
    expectedUpdatedAt: expected,
  }),
  removeTaskDocument: target.extend({
    taskId: uuid,
    documentId: uuid,
    expectedUpdatedAt: expected,
  }),
  createTaskLabel: target.extend({
    name,
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
  }),

  getTaskOptions: target,
  archiveTask: target.extend({ taskId: uuid, expectedUpdatedAt: expected }),
  listMilestones: target.extend(projectPage.shape),
  createMilestone: target.extend({ milestone: milestoneFields }),
  updateMilestone: target.extend({
    milestoneId: uuid,
    updates: milestoneFields.partial().refine(nonempty),
    expectedUpdatedAt: expected,
  }),
  cancelMilestone: target.extend({
    milestoneId: uuid,
    expectedUpdatedAt: expected,
  }),
  getProjectTeam: target,
  assignProjectTeam: target.extend({
    teamId: uuid,
    expectedUpdatedAt: expected,
  }),
  createProjectTeam: target.extend({ team: teamFields }),
  updateProjectTeam: target.extend({
    teamId: uuid,
    updates: teamFields.partial().refine(nonempty),
    expectedUpdatedAt: expected,
  }),
  addTeamMember: target.extend({
    teamId: uuid,
    userId: uuid,
    role: teamMemberRole,
  }),
  updateTeamMember: target.extend({
    teamId: uuid,
    memberId: uuid,
    role: teamMemberRole,
  }),
  removeTeamMember: target.extend({ teamId: uuid, memberId: uuid }),
  listDocuments: target.extend(projectPage.shape),
  createDocument: target.extend({ document: linkedDocument }),
  updateDocument: target.extend({
    documentId: uuid,
    updates: z
      .object({ name, doc_type: linkedDocument.shape.doc_type.optional() })
      .strict(),
    expectedUpdatedAt: expected,
  }),
  removeDocument: target.extend({
    documentId: uuid,
    expectedUpdatedAt: expected,
  }),
  updateEvidence: target.extend({
    evidenceId: uuid,
    updates: z
      .object({
        title: z.string().trim().min(1).max(500),
        summary: z.string().max(20000).nullable().optional(),
        expected_title: z.string().min(1).max(500),
        expected_summary: z.string().max(20000).nullable(),
      })
      .strict(),
  }),
  archiveEvidence: target.extend({ evidenceId: uuid }),
};
export type ProjectManagementInputs = {
  [K in keyof typeof projectManagementInputs]: z.input<
    (typeof projectManagementInputs)[K]
  >;
};
export const PROJECT_MANAGEMENT_CHANNELS = [
  ["get-task-detail", "getTaskDetail", null],
  ["add-task-comment", "addTaskComment", "Publicar comentario en la tarea"],
  ["list-task-documents", "listTaskDocuments", null],
  [
    "create-task-document",
    "createTaskDocument",
    "Vincular documento a la tarea",
  ],
  [
    "update-task-document",
    "updateTaskDocument",
    "Actualizar documento de la tarea",
  ],
  [
    "remove-task-document",
    "removeTaskDocument",
    "Desvincular documento de la tarea sin borrar el original",
  ],
  [
    "create-task-label",
    "createTaskLabel",
    "Crear etiqueta para el equipo del proyecto",
  ],

  ["get-task-options", "getTaskOptions", null],
  ["archive-task", "archiveTask", "Archivar tarea"],
  ["list-milestones", "listMilestones", null],
  ["create-milestone", "createMilestone", "Crear hito"],
  ["update-milestone", "updateMilestone", "Actualizar hito"],
  ["cancel-milestone", "cancelMilestone", "Cancelar hito"],
  ["get-project-team", "getProjectTeam", null],
  ["assign-project-team", "assignProjectTeam", "Asignar equipo al proyecto"],
  [
    "create-project-team",
    "createProjectTeam",
    "Crear equipo en el espacio de trabajo",
  ],
  ["update-project-team", "updateProjectTeam", "Actualizar equipo"],
  ["add-team-member", "addTeamMember", "Añadir integrante al equipo"],
  ["update-team-member", "updateTeamMember", "Cambiar rol del integrante"],
  ["remove-team-member", "removeTeamMember", "Retirar integrante del equipo"],
  ["list-documents", "listDocuments", null],
  ["create-document", "createDocument", "Vincular documento al proyecto"],
  ["update-document", "updateDocument", "Actualizar documento vinculado"],
  [
    "remove-document",
    "removeDocument",
    "Desvincular documento sin borrar el original",
  ],
  ["update-evidence", "updateEvidence", "Actualizar datos del archivo"],
  [
    "archive-evidence",
    "archiveEvidence",
    "Retirar archivo del proyecto sin borrar el original",
  ],
] as const;
