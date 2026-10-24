export interface GmailRequestOptions { timeout: number; retry: boolean; signal?: AbortSignal }
export type GmailClient = {
  users: {
    messages: {
      send: (args: any, options?: GmailRequestOptions) => Promise<any>;
      list: (args: any, options?: GmailRequestOptions) => Promise<any>;
      get: (args: any, options?: GmailRequestOptions) => Promise<any>;
      modify: (args: any, options?: GmailRequestOptions) => Promise<any>;
      batchModify: (args: any, options?: GmailRequestOptions) => Promise<any>;
      trash: (args: any, options?: GmailRequestOptions) => Promise<any>;
    };
    labels: {
      list: (args: any, options?: GmailRequestOptions) => Promise<any>;
      create: (args: any, options?: GmailRequestOptions) => Promise<any>;
      delete: (args: any, options?: GmailRequestOptions) => Promise<any>;
    };
  };
};

export interface GmailLabelRecord {
  id: string;
  name: string;
}
