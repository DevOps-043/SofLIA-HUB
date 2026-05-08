export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

export function isUuidLike(value: string | null | undefined): boolean {
  return !!value && UUID_REGEX.test(value.trim());
}
