import { ActivityLog } from '../entities/ActivityLog';

export interface TrackingRepository {
  saveActivityLog(log: ActivityLog): Promise<void>;
  getLastActivityLog(userId: string): Promise<ActivityLog | null>;
}
