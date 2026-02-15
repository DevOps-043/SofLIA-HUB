export interface AIAssistant {
  sendMessage(message: string, context?: any): Promise<string>;
  // Future expansion: streamMessage, functionCall, etc.
}
