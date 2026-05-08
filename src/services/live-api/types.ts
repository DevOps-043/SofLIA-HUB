export interface LiveCallbacks {
  onTextResponse: (text: string) => void;
  onAudioResponse: (audioData: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
  onReady: () => void;
  onGroundingMetadata?: (metadata: any) => void;
  onFunctionCall?: (functionCall: { name: string; args: any }) => Promise<string>;
}
