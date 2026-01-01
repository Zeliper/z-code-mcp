#!/usr/bin/env node

import { createServer } from './server.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  try {
    const server = await createServer();
    await server.start();
  } catch (error) {
    logger.error('Fatal error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

main();
