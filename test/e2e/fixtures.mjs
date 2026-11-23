import { test as base } from '@playwright/test';
import { createEnvironment } from '../../scripts/validation/environment.mjs';

const demoPassword = 'E2E-Test-Password-2026!';

export const test = base.extend({
  app: [async ({ browserName }, use) => {
    void browserName;
    const environment = await createEnvironment({ demoPassword });
    try {
      await use({ origin: environment.origin, demoPassword });
    } finally {
      await environment.cleanup();
    }
  }, { scope: 'worker' }],
});

export { expect } from '@playwright/test';
