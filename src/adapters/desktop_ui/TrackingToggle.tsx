import React, { useState } from 'react';
import { StartTracking } from '../../core/use_cases/productivity_tracking/StartTracking';
import { StopTracking } from '../../core/use_cases/productivity_tracking/StopTracking';
import { NodeOSAutomation } from '../os_automation/NodeOSAutomation';
import { TrackingRepository } from '../../core/ports/TrackingRepository';

// Mock Repository for UI testing
class MockTrackingRepository implements TrackingRepository {
  async saveActivityLog(log: any): Promise<void> {
    console.log('Saved log:', log);
  }
  async getLastActivityLog(_userId: string): Promise<any> {
    return null;
  }
}

const trackingRepo = new MockTrackingRepository();
const osAutomation = new NodeOSAutomation();
const startTrackingUseCase = new StartTracking(trackingRepo, osAutomation);
const stopTrackingUseCase = new StopTracking(trackingRepo);

export const TrackingToggle: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [userId] = useState('user-123'); // Hardcoded for MVP

  const handleToggle = async () => {
    if (isTracking) {
      await stopTrackingUseCase.execute(userId);
      setIsTracking(false);
    } else {
      await startTrackingUseCase.execute(userId);
      setIsTracking(true);
    }
  };

  return (
    <div className="p-6 flex flex-col items-center gap-6">
      <h2 className="text-2xl font-semibold text-primary dark:text-white">Focus Session</h2>
      <div className="flex flex-col items-center gap-2">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isTracking ? 'bg-accent/20' : 'bg-gray-100 dark:bg-white/5'}`}>
          <div className={`w-8 h-8 rounded-full ${isTracking ? 'bg-accent animate-pulse' : 'bg-gray-400'}`}></div>
        </div>
        <span className="text-sm font-medium text-secondary">
          {isTracking ? 'Tracking Active' : 'Ready to Start'}
        </span>
      </div>

      <div className="text-center">
        <div className="text-4xl font-mono font-bold text-primary dark:text-white tracking-wider">
          {isTracking ? '00:12:45' : '00:00:00'}
        </div>
        <div className="text-xs text-secondary mt-1">SESSION DURATION</div>
      </div>

      <button 
        onClick={handleToggle}
        className={`w-full py-3 px-6 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95 ${
          isTracking 
            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' 
            : 'bg-primary text-white hover:bg-primary/90'
        }`}
      >
        {isTracking ? 'Stop Session' : 'Start Focus Session'}
      </button>
    </div>
  );
};
