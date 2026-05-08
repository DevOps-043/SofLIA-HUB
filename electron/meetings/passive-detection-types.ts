import type { DriveFile } from '../drive-service';
import type { PassiveDetectionUserContext } from './passive-detection-notifier';

export interface PassiveTranscriptInput {
  user: PassiveDetectionUserContext;
  detectionKey: string;
  fileId: string;
  meetingTitle: string | null;
  sourceRef: string;
  file?: DriveFile;
}

export type PassiveTranscriptProcessor = (input: PassiveTranscriptInput) => Promise<void>;
