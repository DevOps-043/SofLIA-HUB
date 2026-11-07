export function safeWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    for (const key of [...url.searchParams.keys()])
      if (
        /^(token|access_token|refresh_token|code|key|api_key|apikey|password|passwd|secret|session|auth|signature|sig)$/i.test(
          key,
        )
      )
        url.searchParams.delete(key);
    return url.toString();
  } catch {
    return null;
  }
}
