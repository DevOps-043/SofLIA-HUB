export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  trackingEnabled: boolean;
  workingHours: {
    start: string; // HH:mm
    end: string;   // HH:mm
  };
}
