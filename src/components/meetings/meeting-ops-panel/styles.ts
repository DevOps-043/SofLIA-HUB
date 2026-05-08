export const DEFAULT_FORM = {
  meetingTitle: '',
  meetingType: 'general',
  defaultTeamId: '',
  defaultProjectId: '',
  manualText: '',
  driveRef: '',
};

export const STATUS_STYLES: Record<string, string> = {
  SOURCE_IMPORTED: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
  EXTRACTING: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20',
  REVIEW_REQUIRED: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
  APPROVED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  SYNCING: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  SYNCED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  CLOSED: 'bg-gray-500/15 text-gray-500 dark:text-gray-400 border-gray-500/20',
  FAILED_EXTRACTION: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
  BLOCKED_REVIEW: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20',
  SYNC_FAILED: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
};

export const DESTINATION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  IRIS: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', icon: 'I' },
  'Project Hub': { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', icon: 'P' },
  Team: { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', icon: 'T' },
  Project: { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', icon: 'Pj' },
  None: { bg: 'bg-gray-500/10', text: 'text-gray-500', icon: '-' },
};

export const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-600 dark:text-red-300',
  high: 'bg-orange-500/20 text-orange-600 dark:text-orange-300',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-300',
  low: 'bg-gray-500/15 text-gray-500 dark:text-gray-400',
};

export const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  low: 'bg-gray-500/15 text-gray-500 dark:text-gray-400',
};
