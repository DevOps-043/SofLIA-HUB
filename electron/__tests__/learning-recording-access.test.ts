import { describe, it, expect, vi } from "vitest";
import { requestLearningStudio } from "../learning-studio-access";
const user = "00000000-0000-4000-8000-000000000011",
  session = "00000000-0000-4000-8000-000000000031",
  run = "00000000-0000-4000-8000-000000000041";
const input = {
  organization_slug: "acme",
  session_id: session,
  operation: { type: "recordings", operation: { type: "play", run_id: run } },
};
const deps = {
  baseUrl: "https://learning.test",
  getIdentity: async () => ({ userId: user, accessToken: "prueba" }),
};
const playback = {
  session_id: session,
  user_id: user,
  run_id: run,
  expires_at: "2026-10-13T19:00:00Z",
  segments: [
    {
      id: run,
      url: "https://project.supabase.co/storage/v1/object/sign/live-recordings/privado?token=prueba",
      duration_seconds: 60,
    },
  ],
};
describe("Concesión de grabación en Hub", () => {
  it("acepta únicamente la edición, sesión y actor solicitados", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ playback })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ playback: { ...playback, user_id: run } }),
        ),
      );
    expect(
      await requestLearningStudio(input, { ...deps, fetcher }),
    ).toMatchObject({ success: true });
    expect(
      await requestLearningStudio(input, { ...deps, fetcher }),
    ).toMatchObject({ success: false });
  });
  it.each([
    "https://zoom.us/recording",
    "https://project.supabase.co/storage/v1/object/public/live-recordings/video",
    "https://project.supabase.co.evil.test/storage/v1/object/sign/live-recordings/video",
  ])("deniega URL %s", async (url) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            playback: {
              ...playback,
              segments: [{ ...playback.segments[0], url }],
            },
          }),
        ),
      );
    expect(
      await requestLearningStudio(input, { ...deps, fetcher }),
    ).toMatchObject({ success: false });
  });
});
