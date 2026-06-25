import { pool } from '../config/database';
import { stopCleanupInterval } from '../utils/tokenBlacklist';

afterAll(async () => {
  stopCleanupInterval();
  await pool.end();
});

jest.setTimeout(30000);
