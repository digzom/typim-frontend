import type { FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig): Promise<void> {
  // Reserved for remediation smoke setup hooks.
}

export default globalSetup;
