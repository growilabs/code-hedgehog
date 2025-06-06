import * as core from '@actions/core';
import type { ActionConfig } from './config.ts';
import { ActionRunner } from './runner.ts';

async function run(): Promise<void> {
  const config: ActionConfig = {
    processor: core.getInput('processor', { required: true }),
  };
  const runner = new ActionRunner(config);
  await runner.run();
}

run();
