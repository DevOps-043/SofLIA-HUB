import * as path from 'path';
import { INDEX_BATCH_SIZE, MAX_FILE_CHARS } from './constants';
import type { BetterSqlite3Database } from './database';
import { readFileContent } from './file-reader';
import type { IndexedDocument } from './types';

export async function indexFilesIntoDatabase(db: BetterSqlite3Database, files: string[]): Promise<number> {
  const stmtDelete = db.prepare('DELETE FROM docs WHERE filepath = ?');
  const stmtInsert = db.prepare('INSERT INTO docs (filepath, filename, content) VALUES (?, ?, ?)');
  const insertMany = db.transaction((docs: IndexedDocument[]) => {
    for (const doc of docs) {
      stmtDelete.run(doc.filepath);
      if (doc.content.trim() !== '') stmtInsert.run(doc.filepath, doc.filename, doc.content);
    }
  });

  let batch: IndexedDocument[] = [];
  let indexedCount = 0;

  for (let index = 0; index < files.length; index += 1) {
    const filePath = files[index];
    batch.push({
      filepath: filePath,
      filename: path.basename(filePath),
      content: await readFileContent(filePath, MAX_FILE_CHARS),
    });

    if (batch.length >= INDEX_BATCH_SIZE || index === files.length - 1) {
      insertMany(batch);
      indexedCount += batch.length;
      batch = [];
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return indexedCount;
}
