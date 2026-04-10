import { NextResponse } from 'next/server';
import * as CP from '@/lib/categoryPrompts';

export const dynamic = 'force-dynamic';

type PromptModule = Record<string, unknown>;

function pick(mod: PromptModule, key: string): string {
  const v = mod[key];
  return typeof v === 'string' ? v : '';
}

export async function GET() {
  try {
    const mod = CP as unknown as PromptModule;

    return NextResponse.json({
      prompt_classify: pick(mod, 'DEFAULT_CLASSIFIER_PROMPT'),
      prompt_netsuite_kt: pick(mod, 'DEFAULT_NETSUITE_KT_PROMPT'),
      prompt_manager: pick(mod, 'DEFAULT_MANAGER_PROMPT'),
      prompt_customer: pick(mod, 'DEFAULT_CUSTOMER_PROMPT'),
      prompt_student_first: pick(mod, 'DEFAULT_STUDENT_FIRST_PROMPT'),
      prompt_student_subsequent: pick(mod, 'DEFAULT_STUDENT_SUBSEQUENT_PROMPT'),
      prompt_others: pick(mod, 'DEFAULT_OTHERS_PROMPT'),
    });
  } catch (err) {
    console.error('[GET /api/prompts/defaults] error:', err);
    return NextResponse.json(
      { error: 'Failed to load default prompts' },
      { status: 500 }
    );
  }
}
