import { getApiBaseUrl } from "../lib/apiBase";

export async function apiUploadSingle(
  token: string,
  input: {
    uri: string;
    name: string;
    mimeType: string;
    category: string;
  }
) {
  const url = `${getApiBaseUrl()}/uploads/single`;

  const form = new FormData();
  form.append("category", input.category);
  form.append(
    "file",
    {
      uri: input.uri,
      name: input.name,
      type: input.mimeType,
    } as any
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // No seteamos Content-Type: fetch lo setea con boundary.
    },
    body: form,
  });

  if (!res.ok) {
    let msg = res.statusText || "Upload failed";
    try {
      const data = (await res.json()) as any;
      if (data?.message) msg = String(data.message);
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  return (await res.json()) as {
    ok: true;
    file: { originalName: string; mimeType: string; size: number; path: string };
  };
}
