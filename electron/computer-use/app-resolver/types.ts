export type ResolvedApplicationTarget = {
  path: string;
  source: string;
  score?: number;
  searchedQuery?: string;
  alternatives?: string[];
};

export interface ApplicationSearchRoot {
  root: string;
  source: string;
  maxDepth: number;
}

export interface ExistingWindowMatch {
  pid: number;
  process: string;
  title: string;
}
