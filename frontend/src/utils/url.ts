import { getServerOrigin } from "../lib/apiBase";

export function absoluteUrl(maybePath: string | null | undefined) {
  const v = (maybePath ?? "").trim();
  if (!v) return null;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("/")) return `${getServerOrigin()}${v}`;
  return v;
}
