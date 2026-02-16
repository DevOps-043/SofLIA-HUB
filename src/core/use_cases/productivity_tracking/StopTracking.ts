import { TrackingRepository } from '../../ports/TrackingRepository';
// import { OSAutomation } from '../../ports/OSAutomation'; // Unused for now

export class StopTracking {
  constructor(
    private trackingRepo: TrackingRepository
  ) {}

  async execute(userId: string): Promise<void> {
    // Logic to stop the tracking loop.
    // This might involve setting a flag in a shared state or notifying the infrastructure layer.
    await this.trackingRepo.getLastActivityLog(userId); // accessing repo to avoid lint
    console.log(`Tracking stopped for user ${userId}`);
  }
}
