/** Selección privada: no concede permisos ni forma parte de auth:get-state. */
let selection = { userId: null as string | null, organizationId: null as string | null, revision: 0 };
export function setOrganizationContext(userId: string | null, organizationId: string | null): void {
  const selected = userId ? organizationId : null;
  if (selection.userId !== userId || selection.organizationId !== selected) {
    selection = { userId, organizationId: selected, revision: selection.revision + 1 };
  }
}
export function getOrganizationContext() { return { ...selection }; }
