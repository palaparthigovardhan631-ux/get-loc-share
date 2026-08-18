// Semantic paragraph chunking with overlap. Targets ~1000 chars per chunk.
const TARGET = 1000;
const MAX = 1400;
const OVERLAP = 180;

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Split on blank lines first, then merge until near TARGET.
  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = "";
  };

  for (const p of paragraphs) {
    if (p.length > MAX) {
      flush();
      // hard-split long paragraph on sentence boundaries
      const sentences = p.split(/(?<=[.!?])\s+/);
      let sbuf = "";
      for (const s of sentences) {
        if ((sbuf + " " + s).length > MAX && sbuf) {
          chunks.push(sbuf.trim());
          sbuf = s;
        } else {
          sbuf = sbuf ? sbuf + " " + s : s;
        }
      }
      if (sbuf) chunks.push(sbuf.trim());
      continue;
    }
    if ((buf + "\n\n" + p).length > TARGET && buf) {
      flush();
    }
    buf = buf ? buf + "\n\n" + p : p;
  }
  flush();

  // Add overlap for RAG continuity
  if (chunks.length <= 1) return chunks;
  const withOverlap: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const prev = i > 0 ? chunks[i - 1].slice(-OVERLAP) : "";
    withOverlap.push(prev ? `…${prev}\n\n${chunks[i]}` : chunks[i]);
  }
  return withOverlap;
}
