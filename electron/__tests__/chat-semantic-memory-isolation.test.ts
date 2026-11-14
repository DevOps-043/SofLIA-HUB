import { DatabaseSync } from 'node:sqlite';
import { expect, it, vi } from 'vitest';
import { loadMemoryChunksFromDB, searchMemoryEmbeddings } from '../memory/embedding-search';
import { MEMORY_EMBEDDING_DIMENSIONS } from '../memory/constants';
vi.mock('../ai-provider/embeddings', () => ({ EMBEDDING_MODEL: 'text-embedding-3-small' }));

it('la memoria semántica del chat conserva sesión y propietario aunque otra conversación sea similar', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE memory_chunks(id INTEGER PRIMARY KEY, session_key TEXT, phone_number TEXT, chunk_text TEXT, embedding TEXT, source_start_time INTEGER)');
    const vector = Array(MEMORY_EMBEDDING_DIMENSIONS).fill(0); vector[0] = 1;
    const embedding = JSON.stringify({ model: 'text-embedding-3-small', vector });
    const insert = db.prepare('INSERT INTO memory_chunks VALUES(?,?,?,?,?,?)');
    insert.run(1, 'chat:usuario:presentacion', 'user:usuario', 'Calidad de software', embedding, 1);
    insert.run(2, 'chat:usuario:emocional', 'user:usuario', 'Apoyo emocional: otro encargo privado', embedding, 2);
    insert.run(3, 'chat:usuario:presentacion', 'user:otro', 'Contenido de otro propietario', embedding, 3);
    expect(loadMemoryChunksFromDB(db, 'chat:usuario:presentacion', 'user:usuario').map(chunk => chunk.id)).toEqual([1]);
    const service = { db, embeddingCache: new Map(), loadChunksFromDB: (session: string, owner: string) => loadMemoryChunksFromDB(db, session, owner) };
    const recalled = searchMemoryEmbeddings(service, 'chat:usuario:presentacion', 'user:usuario', vector, 10);
    expect(recalled.map(item => item.text)).toEqual(['Calidad de software']);
  } finally { db.close(); }
});
