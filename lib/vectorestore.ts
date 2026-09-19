import { getEmbedding, cosineSimilarity } from "./embeddings";

interface Chunk {
  id: number;
  text: string;
  embedding: number[];
  docId: string;
  source: string;
}

// In-memory store — one store per document
const stores: Map<string, Chunk[]> = new Map();

export async function indexDocument(
  docId: string,
  filename: string,
  chunks: string[]
): Promise<void> {
  const indexed: Chunk[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await getEmbedding(chunks[i]!);
    indexed.push({ id: i, text: chunks[i]!, embedding, docId, source: filename });
  }
  stores.set(docId, indexed);
}

export function retrieveChunks(docId: string, queryEmbedding: number[], topK: number): Chunk[] {
  const store = stores.get(docId) ?? [];
  return store
    .map(chunk => ({ ...chunk, similarity: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}