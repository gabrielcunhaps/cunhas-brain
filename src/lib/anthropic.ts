import Anthropic from '@anthropic-ai/sdk';
import { queryOne } from './db';

export async function getAnthropicClient(): Promise<Anthropic> {
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = $1',
    ['anthropic_api_key']
  );

  if (!row?.value) {
    throw new Error('Anthropic API key not configured. Go to Settings.');
  }

  return new Anthropic({ apiKey: row.value });
}
