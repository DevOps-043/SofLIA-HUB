export const SEARCH_TOOLS = new Set([
  'smart_find_file',
  'web_search',
  'read_webpage',
  'search_clipboard_history',
  'semantic_file_search',
]);

export const BROWSER_PROFILE_TOOLS = new Set(['list_browser_profiles', 'reset_browser_profile']);
export const SCHEDULER_TOOLS = new Set(['task_scheduler', 'list_scheduled_tasks', 'delete_scheduled_task']);
export const TASK_QUEUE_TOOLS = new Set(['list_active_tasks', 'cancel_background_task']);
export const NEURAL_TOOLS = new Set(['neural_organizer_status', 'neural_organizer_toggle']);
export const CALENDAR_TOOLS = new Set(['create_calendar_event']);

export const ALL_MISC_TOOLS = new Set([
  ...SEARCH_TOOLS,
  ...BROWSER_PROFILE_TOOLS,
  ...SCHEDULER_TOOLS,
  ...TASK_QUEUE_TOOLS,
  ...NEURAL_TOOLS,
  ...CALENDAR_TOOLS,
]);
