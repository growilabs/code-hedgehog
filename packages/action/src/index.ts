import { getConfig } from './config';
import { ActionRunner } from './runner';

async function run(): Promise<void> {
  const config = getConfig();
  const runner = new ActionRunner(config);
  await runner.run();
}

run();
