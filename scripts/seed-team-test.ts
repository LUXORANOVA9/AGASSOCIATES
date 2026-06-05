// scripts/seed-team-test.ts
// Seeds team_members with two test rows (one on-duty, one off-duty)
// and one bank row for the OTP smoke test. Idempotent: drops any
// prior test rows first. Standalone — uses its own pg.Pool, does
// not require the ag-platform .env.
//
// Run with: npx tsx scripts/seed-team-test.ts
//   or:    PGHOST=... PGUSER=... PGPASSWORD=... npx tsx scripts/seed-team-test.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../ag-platform/.env') });

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
});

const TEST_ORG_ID = '00000000-0000-0000-0000-0000000000a1';
const TEST_ADVOCATE_ID = '00000000-0000-0000-0000-0000000000a2';
const TEST_ADVOCATE_PROFILE_ID = '00000000-0000-0000-0000-0000000000d1';
const TEST_BANK_ID = '00000000-0000-0000-0000-0000000000b1';
const ON_DUTY_MEMBER_ID = '00000000-0000-0000-0000-0000000000c1';
const OFF_DUTY_MEMBER_ID = '00000000-0000-0000-0000-0000000000c2';

async function main() {
  await pool.query(`DELETE FROM team_members WHERE org_id = $1`, [TEST_ORG_ID]);
  await pool.query(`DELETE FROM profiles WHERE org_id = $1`, [TEST_ORG_ID]);
  await pool.query(`DELETE FROM banks WHERE id = $1`, [TEST_BANK_ID]);
  await pool.query(`DELETE FROM organizations WHERE id = $1`, [TEST_ORG_ID]);

  await pool.query(
    `INSERT INTO organizations (id, name) VALUES ($1, $2)`,
    [TEST_ORG_ID, 'AG Associates (TEST)'],
  );

  await pool.query(
    `INSERT INTO banks (id, name, short_code, type) VALUES ($1, $2, $3, $4)`,
    [TEST_BANK_ID, 'Test Bank', 'TESTBANK', 'BANK'],
  );

  await pool.query(
    `INSERT INTO profiles (id, user_id, org_id, full_name, role)
     VALUES ($1, $2, $3, 'Adv. Test Advocate', 'PRINCIPAL')
     ON CONFLICT (id) DO NOTHING`,
    [TEST_ADVOCATE_ID, TEST_ADVOCATE_PROFILE_ID, TEST_ORG_ID],
  );

  await pool.query(
    `INSERT INTO profiles (id, user_id, org_id, full_name, role)
     VALUES
       ($1, $2, $3, 'On-Duty Staff', 'EXECUTIVE'),
       ($4, $5, $3, 'Off-Duty Staff', 'CLERK')
     ON CONFLICT (id) DO NOTHING`,
    [ON_DUTY_MEMBER_ID, '00000000-0000-0000-0000-0000000000e1', TEST_ORG_ID, OFF_DUTY_MEMBER_ID, '00000000-0000-0000-0000-0000000000e2'],
  );

  await pool.query(
    `INSERT INTO team_members
       (org_id, advocate_id, member_id, invite_email, role,
        seat_status, telegram_chat_id, telegram_username, on_duty)
     VALUES
       ($1, $2, $3, 'onduty@test.local', 'EXECUTIVE',
        'ACTIVE', '123456789', 'onduty_staff', true),
       ($1, $2, $4, 'offduty@test.local', 'CLERK',
        'ACTIVE', '987654321', 'offduty_staff', false)`,
    [TEST_ORG_ID, TEST_ADVOCATE_ID, ON_DUTY_MEMBER_ID, OFF_DUTY_MEMBER_ID],
  );

  console.log('Seeded:');
  console.log(`  org_id         = ${TEST_ORG_ID}`);
  console.log(`  bank_id        = ${TEST_BANK_ID}`);
  console.log(`  advocate_id    = ${TEST_ADVOCATE_ID}  (PRINCIPAL profile ${TEST_ADVOCATE_PROFILE_ID})`);
  console.log(`  on_duty staff  = ${ON_DUTY_MEMBER_ID} (telegram 123456789)`);
  console.log(`  off_duty staff = ${OFF_DUTY_MEMBER_ID} (telegram 987654321)`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
