export async function fetchArrayBufferWithProgress(
  url: string,
  onProgress: (fraction01: number | null) => void,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} al descargar: ${url}`);
  }

  const totalHeader = res.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : NaN;

  // Si no hay body stream o no hay content-length, usamos modo indeterminado
  if (!res.body || !Number.isFinite(total) || total <= 0) {
    onProgress(null);
    const buf = await res.arrayBuffer();
    onProgress(1);
    return buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      onProgress(received / total);
    }
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }

  onProgress(1);
  return out.buffer;
}
