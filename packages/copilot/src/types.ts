export interface CopilotModel {
  id: string;
  name: string;
  capabilities: {
    streaming: boolean;
    tools: boolean;
    vision?: boolean;
  };
}

export const COPILOT_MODELS: CopilotModel[] = [
  {
    id: 'gpt-4-copilot',
    name: 'GPT-4 (Copilot)',
    capabilities: { streaming: true, tools: true },
  },
  {
    id: 'gpt-4o-copilot',
    name: 'GPT-4o (Copilot)',
    capabilities: { streaming: true, tools: true },
  },
  {
    id: 'claude-3.5-sonnet-copilot',
    name: 'Claude 3.5 Sonnet (Copilot)',
    capabilities: { streaming: true, tools: true },
  },
  {
    id: 'o1-copilot',
    name: 'o1 (Copilot)',
    capabilities: { streaming: true, tools: true },
  },
  {
    id: 'o1-mini-copilot',
    name: 'o1-mini (Copilot)',
    capabilities: { streaming: true, tools: false },
  },
];

export interface CopilotConfig {
  COPILOT_TOKEN?: string;
  COPILOT_OAUTH_TOKEN?: string;
  COPILOT_OAUTH_REFRESH_TOKEN?: string;
}
