import { put } from "@vercel/blob";

export async function uploadBuffer(
  path: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const blob = await put(path, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

export async function fetchAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch blob at ${url}: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
