export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolImplementation {
  definition: ToolDefinition;
  execute(args: any): Promise<any>;
}
