export interface MeetingContextTeam {
  team_id: string;
  name: string;
}

export interface MeetingContextProject {
  project_id: string;
  project_name: string;
  team_id?: string | null;
}

export interface MeetingContextTeamMember {
  membership_id: string;
  team_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  display_name?: string | null;
  email?: string | null;
  username?: string | null;
}

export interface MeetingDetectedEvent {
  runId: string;
  ownerUserId: string;
  meetingTitle: string | null;
  sourceFileName: string | null;
}
