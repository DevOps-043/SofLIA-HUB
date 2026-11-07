import { calendarClient } from '../calendar';
export type WorkspaceApis = {
  cal: ReturnType<typeof calendarClient>;
  gmail: any;
  drive: any;
};

export function getWorkspaceApis(): WorkspaceApis {
  return {
    cal: calendarClient(),
    gmail: (window as any).gmail,
    drive: (window as any).drive,
  };
}

export function unavailable(message: string): string {
  return JSON.stringify({ error: message });
}
