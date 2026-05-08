export type WorkspaceApis = {
  cal: any;
  gmail: any;
  drive: any;
};

export function getWorkspaceApis(): WorkspaceApis {
  return {
    cal: (window as any).calendar,
    gmail: (window as any).gmail,
    drive: (window as any).drive,
  };
}

export function unavailable(message: string): string {
  return JSON.stringify({ error: message });
}
