export async function runIndexerDaemon(
  directories: string[],
  indexDirectory: (dir: string) => Promise<void>,
): Promise<void> {
  for (const dir of directories) {
    try {
      await indexDirectory(dir);
    } catch (err) {
      console.error(`[SemanticIndexer] Daemon failed to index ${dir}:`, err);
    }
  }
}
