export type GmailClient = {
  users: {
    messages: {
      send: (args: any) => Promise<any>;
      list: (args: any) => Promise<any>;
      get: (args: any) => Promise<any>;
      modify: (args: any) => Promise<any>;
      batchModify: (args: any) => Promise<any>;
      trash: (args: any) => Promise<any>;
    };
    labels: {
      list: (args: any) => Promise<any>;
      create: (args: any) => Promise<any>;
      delete: (args: any) => Promise<any>;
    };
  };
};

export interface GmailLabelRecord {
  id: string;
  name: string;
}
