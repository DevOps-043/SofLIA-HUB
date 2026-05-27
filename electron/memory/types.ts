export interface MemoryContext {
  recentMessages: Array<{ role: string; content: string; timestamp: number }>;
  rollingSummary: string | null;
  semanticRecall: Array<{ text: string; score: number; timestamp: number }>;
  timelineRecall?: Array<{ role: string; content: string; timestamp: number; score: number; reason: string }>;
  facts: Array<{ key: string; value: string; category: string }>;
  soul?: string;
  identity?: string;
  memoryCards?: string;
}

export interface StoredMessage {
  id: number;
  session_key: string;
  phone_number: string;
  group_jid: string | null;
  role: string;
  content: string;
  media_type: string | null;
  media_filename: string | null;
  timestamp: number;
}
