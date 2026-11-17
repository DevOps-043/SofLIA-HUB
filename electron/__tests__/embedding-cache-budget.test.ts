import { describe, expect, it, vi } from 'vitest';
import { searchMemoryEmbeddings } from '../memory/embedding-search';
import { EMBEDDING_CACHE_MAX_CHUNKS, EMBEDDING_CACHE_MAX_SESSIONS } from '../memory/constants';
vi.mock('../ai-provider/embeddings', () => ({ EMBEDDING_MODEL: 'modelo-fixture' }));
function fixture(size = 1) {
  const load = vi.fn((session: string) => Array.from({ length: size }, (_, index) => ({ id: Number(session) * 10000 + index, embedding: [1, 0], startTime: 0 })));
  return { embeddingCache: new Map<string, ReturnType<typeof load>>(), loadChunksFromDB: load,
    db: { prepare: vi.fn(() => ({ all: (...ids: number[]) => ids.map(id => ({ id, chunk_text: `Texto ${id}`, source_start_time: 1 })) })) } };
}
describe('Caché de vectores acotada sin borrar memoria persistida', () => {
  it('expulsa por LRU y recarga los mismos resultados de una sesión antigua', () => {
    const service = fixture();
    const query = (key: string) => searchMemoryEmbeddings(service, key, 'usuario', [1, 0], 5);
    const first = query('0');
    for (let index = 1; index < EMBEDDING_CACHE_MAX_SESSIONS; index++) query(String(index));
    query('0'); query('4');
    expect(service.embeddingCache.has('0')).toBe(true);
    expect(service.embeddingCache.has('1')).toBe(false);
    expect(service.embeddingCache.size).toBe(EMBEDDING_CACHE_MAX_SESSIONS);
    query('5'); query('6'); query('7'); query('8');
    expect(service.embeddingCache.has('0')).toBe(false);
    const calls = service.loadChunksFromDB.mock.calls.length;
    expect(query('0')).toEqual(first);
    expect(service.loadChunksFromDB).toHaveBeenCalledTimes(calls + 1);
  });
  it('limita vectores acumulados sin reducir filas buscadas o resultados', () => {
    const service = fixture(EMBEDDING_CACHE_MAX_CHUNKS);
    expect(searchMemoryEmbeddings(service, '1', 'usuario', [1, 0], 5)).toHaveLength(5);
    expect(searchMemoryEmbeddings(service, '2', 'usuario', [1, 0], 5)).toHaveLength(5);
    expect([...service.embeddingCache.values()].reduce((total, rows) => total + rows.length, 0)).toBeLessThanOrEqual(EMBEDDING_CACHE_MAX_CHUNKS);
    service.embeddingCache.delete('2');
    searchMemoryEmbeddings(service, '2', 'usuario', [1, 0], 5);
    expect(service.loadChunksFromDB).toHaveBeenCalledTimes(3);
    service.embeddingCache.clear();
    expect(service.embeddingCache.size).toBe(0);
  });
});
