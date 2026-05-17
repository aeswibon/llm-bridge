import type { WindsurfModel } from './types.js';

export const WINDSURF_MODELS: WindsurfModel[] = [
  {
    id: 'claude-4.5-sonnet',
    name: 'Claude 4.5 Sonnet (Windsurf)',
    capabilities: { streaming: true, tools: true },
  },
  {
    id: 'claude-4.5-opus',
    name: 'Claude 4.5 Opus (Windsurf)',
    capabilities: { streaming: true, tools: true },
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2 (Windsurf)',
    capabilities: { streaming: true, tools: true },
  },
  {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2 Codex (Windsurf)',
    capabilities: { streaming: true, tools: true },
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Windsurf)',
    capabilities: { streaming: true, tools: true },
  },
  {
    id: 'gemini-3.0-pro',
    name: 'Gemini 3.0 Pro (Windsurf)',
    capabilities: { streaming: true, tools: true },
  },
  {
    id: 'gemini-3.0-flash',
    name: 'Gemini 3.0 Flash (Windsurf)',
    capabilities: { streaming: true, tools: true },
  },
  {
    id: 'swe-1.5',
    name: 'SWE-1.5 (Windsurf)',
    capabilities: { streaming: true, tools: true },
  },
];
