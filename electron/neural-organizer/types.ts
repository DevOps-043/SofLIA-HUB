export interface NeuralOrganizerOptions {
  notifyCallback?: (message: string) => Promise<void>;
}

export interface FileCategoryInfo {
  category: string;
  summary: string;
}
