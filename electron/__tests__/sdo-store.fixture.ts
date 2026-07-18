/**
 * Fake Supabase en memoria para los tests del SDO.
 * Soporta las cadenas que usa SdoStore: insert/upsert(.select().single()),
 * select con eq/ilike/order/limit/maybeSingle, y update con eq.
 */

export type FakeRow = Record<string, unknown>;

export class FakeSupabaseDb {
  tables = new Map<string, FakeRow[]>();

  rows(table: string): FakeRow[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table) as FakeRow[];
  }

  reset(): void {
    this.tables.clear();
  }

  client() {
    return { from: (table: string) => new FakeQuery(this, table) };
  }
}

type Filter = { kind: 'eq' | 'ilike'; column: string; value: unknown };

class FakeQuery implements PromiseLike<{ data: FakeRow[] | null; error: null }> {
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private affected: FakeRow[] = [];
  private mode: 'select' | 'mutation' = 'select';

  constructor(private readonly db: FakeSupabaseDb, private readonly table: string) {}

  insert(row: FakeRow) {
    const copia = { ...row, created_at: (row.created_at as string) ?? new Date().toISOString() };
    this.db.rows(this.table).push(copia);
    this.affected = [copia];
    this.mode = 'mutation';
    return this;
  }

  upsert(row: FakeRow, opts?: { onConflict?: string }) {
    const claves = (opts?.onConflict || '').split(',').map((c) => c.trim()).filter(Boolean);
    const filas = this.db.rows(this.table);
    const existente = claves.length
      ? filas.find((r) => claves.every((c) => r[c] !== null && r[c] !== undefined && r[c] === row[c]))
      : undefined;

    if (existente) {
      Object.assign(existente, row, { id: existente.id, created_at: existente.created_at });
      this.affected = [existente];
    } else {
      const copia = { ...row, created_at: (row.created_at as string) ?? new Date().toISOString() };
      filas.push(copia);
      this.affected = [copia];
    }
    this.mode = 'mutation';
    return this;
  }

  update(updates: FakeRow) {
    this.mode = 'mutation';
    this.affected = [];
    // Se aplica al resolver eq() para conocer el filtro.
    this.pendingUpdate = updates;
    return this;
  }

  private pendingUpdate: FakeRow | null = null;

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    if (this.pendingUpdate) {
      const filas = this.db.rows(this.table).filter((r) => r[column] === value);
      for (const fila of filas) Object.assign(fila, this.pendingUpdate);
      this.affected = filas;
      this.pendingUpdate = null;
      return this;
    }
    this.filters.push({ kind: 'eq', column, value });
    return this;
  }

  ilike(column: string, pattern: string) {
    this.filters.push({ kind: 'ilike', column, value: pattern });
    return this;
  }

  in(column: string, values: unknown[]) {
    const set = new Set(values);
    if (this.pendingUpdate) {
      const filas = this.db.rows(this.table).filter((r) => set.has(r[column]));
      for (const fila of filas) Object.assign(fila, this.pendingUpdate);
      this.affected = filas;
      this.pendingUpdate = null;
      return this;
    }
    this.filters.push({ kind: 'eq', column, value: values });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  private resultados(): FakeRow[] {
    if (this.mode === 'mutation') return this.affected;

    let filas = this.db.rows(this.table).filter((fila) =>
      this.filters.every((f) => {
        if (f.kind === 'eq') {
          if (Array.isArray(f.value)) return (f.value as unknown[]).includes(fila[f.column]);
          return fila[f.column] === f.value;
        }
        const patron = String(f.value).replace(/%/g, '').toLowerCase();
        return String(fila[f.column] ?? '').toLowerCase().includes(patron);
      }),
    );

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      filas = [...filas].sort((a, b) => {
        const va = String(a[column] ?? '');
        const vb = String(b[column] ?? '');
        return ascending ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }

    if (this.limitCount !== null) filas = filas.slice(0, this.limitCount);
    return filas;
  }

  async maybeSingle() {
    const filas = this.resultados();
    return { data: filas[0] ?? null, error: null };
  }

  async single() {
    const filas = this.resultados();
    if (!filas[0]) return { data: null, error: { message: 'no rows returned' } };
    return { data: filas[0], error: null };
  }

  then<TResult1 = { data: FakeRow[] | null; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: FakeRow[] | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.resultados(), error: null as null }).then(onfulfilled, onrejected);
  }
}
