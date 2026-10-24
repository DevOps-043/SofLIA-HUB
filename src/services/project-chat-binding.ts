/** Compatibilidad de lectura con el vínculo existente. No crea ni mueve carpetas. */
export async function readProjectChatBinding(
  workspaceId: string,
  projectId: string,
  signal: AbortSignal,
): Promise<string | null> {
  const { supabase } = await import("../lib/supabase");
  const { data, error } = await supabase
    .from("project_chat_bindings")
    .select("lia_folder_id")
    .eq("iris_workspace_id", workspaceId)
    .eq("iris_project_id", projectId)
    .eq("binding_status", "active")
    .abortSignal(signal)
    .maybeSingle();
  if (error)
    throw new Error(
      "No se pudo comprobar el espacio de conversaciones del proyecto.",
    );
  return data && typeof data.lia_folder_id === "string"
    ? data.lia_folder_id
    : null;
}
