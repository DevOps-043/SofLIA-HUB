import type { OrganizeSummary } from './types';

export function generateOrganizationSummaryText(summary: OrganizeSummary): string {
  let text = `*Organization Report for ${summary.directory}*\n`;
  const durationMs = summary.endTime.getTime() - summary.startTime.getTime();
  text += `Duration: ${(durationMs / 1000).toFixed(2)} seconds\n`;
  text += `Total Files Moved: ${summary.totalProcessed}\n\n`;

  if (summary.totalProcessed > 0) {
    text += `*Moved by Category:*\n`;
    for (const [category, count] of Object.entries(summary.moved)) {
      text += `- ${category}: ${count} files\n`;
    }
  } else {
    text += `No files were moved (directory was already organized or empty).\n`;
  }

  if (summary.errors.length > 0) {
    text += `\n*Errors encountered (${summary.errors.length}):*\n`;
    const displayErrors = summary.errors.slice(0, 5);
    for (const err of displayErrors) {
      text += `- ${err}\n`;
    }
    if (summary.errors.length > 5) {
      text += `- ... and ${summary.errors.length - 5} more errors.\n`;
    }
  }

  return text;
}
