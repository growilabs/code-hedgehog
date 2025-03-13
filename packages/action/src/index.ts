import { getConfig } from './config.ts';
import { ActionRunner } from './runner.ts';

async function run(): Promise<void> {
  const config = getConfig();
  const runner = new ActionRunner(config);
  await runner.run();
}

run();
