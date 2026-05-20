export interface WindsurfModel {
  id: string;
  name: string;
  capabilities: {
    streaming: boolean;
    tools: boolean;
    vision?: boolean;
  };
}

export interface WindsurfConfig {
  WINDSURF_TOKEN?: string;
  WINDSURF_OAUTH_TOKEN?: string;
  WINDSURF_LANGUAGE_SERVER_PATH?: string;
}

export interface WindsurfTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}
