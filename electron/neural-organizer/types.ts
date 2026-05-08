export interface NeuralOrganizerOptions {
  apiKey: string;
  notifyCallback?: (message: string) => Promise<void>;
}

export interface FileCategoryInfo {
  category: string;
  summary: string;
}
