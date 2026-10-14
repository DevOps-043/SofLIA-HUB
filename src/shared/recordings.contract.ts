// Generado desde Learning. Sincronizar con scripts/quality/sync-learning-studio.mjs.
import { z } from "zod";
const uuid = z.string().uuid();
export const recordingOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("retry"), run_id: uuid }).strict(),
  z.object({ type: z.literal("snapshot") }).strict(),
  z
    .object({
      type: z.literal("intent"),
      revision: z.number().int().nonnegative(),
      requested: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("publish"),
      run_id: uuid,
      revision: z.number().int().nonnegative(),
      publish: z.boolean(),
      reviewed: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal("play"), run_id: uuid }).strict(),
]);
export const recordingRunSchema = z.object({
  id: uuid,
  status: z.enum([
    "recording",
    "interrupted",
    "processing",
    "importing",
    "ready",
    "failed",
    "missing",
    "purging",
    "purged",
  ]),
  coverage: z.enum(["unknown", "complete", "gaps"]),
  published: z.boolean(),
  publication_revision: z.number().int().nonnegative(),
  created_at: z.string(),
  segments: z.number().int().nonnegative(),
  duration_seconds: z.number().nonnegative(),
});
export const recordingSnapshotSchema = z.object({
  version: z.literal(1).default(1),
  session_id: uuid,
  user_id: uuid,
  required: z.literal(true),
  availability: z
    .enum(["prepared", "missing", "available"])
    .default("prepared"),
  requested: z.boolean(),
  revision: z.number().int().nonnegative(),
  can_manage: z.boolean(),
  runs: z.array(recordingRunSchema).max(100),
});
export const recordingResponseSchema = z
  .object({
    recording_snapshot: recordingSnapshotSchema.optional(),
    playback: z
      .object({
        version: z.literal(1).default(1),
        session_id: uuid,
        user_id: uuid,
        run_id: uuid,
        expires_at: z.string().datetime({ offset: true }),
        segments: z
          .array(
            z.object({
              id: uuid,
              url: z.string().url(),
              duration_seconds: z.number().nonnegative(),
            }),
          )
          .min(1)
          .max(100),
      })
      .optional(),
  })
  .strict();
export type RecordingSnapshot = z.infer<typeof recordingSnapshotSchema>;
export type RecordingOperation = z.infer<typeof recordingOperationSchema>;
export type RecordingResponse = z.infer<typeof recordingResponseSchema>;
