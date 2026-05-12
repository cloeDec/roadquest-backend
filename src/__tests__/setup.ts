import { pool } from '../config/database';

afterAll(async () => {
  await pool.end();
});

jest.setTimeout(10000);
