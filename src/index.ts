import 'dotenv/config';
import { createServer } from './server';
import { robotService } from './modules/robot';
import { logger } from './modules/shared';
import { config } from './config/env';

async function bootstrap(): Promise<void> {
  try {
    const app = await createServer();

    app.listen(config.PORT, () => {
      logger.info(`[App] Running on port ${config.PORT}`, {
        env:      config.NODE_ENV,
        graphql:  `${config.PUBLIC_BASE_URL}/graphql`,
      });
    });

    // Start the email robot scheduler
    robotService.startScheduler();

  } catch (err) {
    logger.error('[App] Failed to start', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

bootstrap();