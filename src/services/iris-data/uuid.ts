export function isUuidLike(value: string | null | undefined): boolean {
  return !!value && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.trim());
}
