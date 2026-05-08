export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  handler?: (args: any) => Promise<any> | any;
}

export interface ToolSourceInfo {
  filePath: string;
  filename: string;
  rootPath: string;
}

export interface LoadedTool {
  tool: ToolSchema;
  source: ToolSourceInfo;
}
