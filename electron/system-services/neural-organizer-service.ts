import { analyzeDirectoryContents } from './analyze-directory';
import { buildExtensionMap } from './categories';
import { organizeDirectoryContents } from './organize-directory';
import { generateOrganizationSummaryText } from './summary-text';
import type { DirectoryAnalysis, OrganizeSummary } from './types';

export class NeuralOrganizerService {
  private extToCategory: Record<string, string> = buildExtensionMap();

  public async analyzeDirectory(dirPath: string): Promise<DirectoryAnalysis> {
    return analyzeDirectoryContents(dirPath, this.extToCategory);
  }

  public async organizeDirectory(dirPath: string): Promise<OrganizeSummary> {
    console.log(`[NeuralOrganizer] Starting organization for: ${dirPath}`);
    const summary = await organizeDirectoryContents(dirPath, this.extToCategory);
    console.log(`[NeuralOrganizer] Finished organization for: ${dirPath}. Processed: ${summary.totalProcessed} files.`);
    return summary;
  }

  public generateSummaryText(summary: OrganizeSummary): string {
    return generateOrganizationSummaryText(summary);
  }
}
