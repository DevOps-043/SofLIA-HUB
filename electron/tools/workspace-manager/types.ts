export interface WorkspaceActionInput {
  action: 'save' | 'restore' | 'list' | 'delete';
  name?: string;
}

export interface SavedWorkspaceApp {
  Name: string;
  MainWindowTitle?: string;
  Path?: string;
}
