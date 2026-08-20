import { connectDB } from '../services/database';
import { ensureOwnerAdmin } from '../services/auth';
import { seedDefaultSettings } from '../services/settings';
import { seedDefaultFAQs } from '../services/faq';
import { logger } from '../utils/logger';

async function seed(): Promise<void> {
  logger.info('Running seed...');
  await connectDB();
  await seedDefaultSettings();
  await seedDefaultFAQs();
  await ensureOwnerAdmin();
  logger.info('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
