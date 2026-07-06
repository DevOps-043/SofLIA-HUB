export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    owner_key TEXT,
    group_jid TEXT,
    role TEXT NOT NULL CHECK(role IN ('user', 'model')),
    content TEXT NOT NULL,
    media_type TEXT,
    media_filename TEXT,
    timestamp INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_session_key ON messages(session_key);
CREATE INDEX IF NOT EXISTS idx_messages_phone_ts ON messages(phone_number, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(timestamp);

CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    summary_text TEXT NOT NULL,
    message_count INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_summaries_session ON summaries(session_key);
CREATE INDEX IF NOT EXISTS idx_summaries_phone_period ON summaries(phone_number, period_end DESC);

CREATE TABLE IF NOT EXISTS memory_chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('conversation', 'summary', 'fact')),
    source_start_time INTEGER,
    source_end_time INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chunks_session ON memory_chunks(session_key);
CREATE INDEX IF NOT EXISTS idx_chunks_phone ON memory_chunks(phone_number);

CREATE TABLE IF NOT EXISTS facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT,
    category TEXT NOT NULL,
    fact_key TEXT NOT NULL,
    fact_value TEXT NOT NULL,
    source_context TEXT,
    confidence REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_facts_phone ON facts(phone_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_facts_unique ON facts(COALESCE(phone_number,''), category, fact_key);

-- Skills: conocimiento durable APRENDIDO del usuario (preferencias, formato
-- preferido, fuentes confiables, correcciones, procedimientos que funcionaron).
-- Indexado por owner_key (user:<id> / phone:<num> / local:owner) para unificar
-- entre superficies. Se refuerza (confidence/usage) al reaparecer.
CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL,
    skill_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    trigger_context TEXT,
    confidence REAL DEFAULT 0.6,
    usage_count INTEGER DEFAULT 0,
    last_used_at TEXT,
    source TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_skills_owner ON skills(owner_key, confidence DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_unique ON skills(owner_key, skill_type, title);
`;
