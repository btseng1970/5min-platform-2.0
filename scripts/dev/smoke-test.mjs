// FND-000 environment smoke test: PostgreSQL 16 reachable + pg-boss (ADR-000 queue) can start.
// Not application code — no domain schema, no business logic.
import pg from 'pg';
import PgBoss from 'pg-boss';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

async function checkPostgresVersion() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query('SHOW server_version_num');
    const versionNum = Number(rows[0].server_version_num);
    if (versionNum < 160000) {
      throw new Error(`Expected PostgreSQL 16.x, got server_version_num=${versionNum}`);
    }
    console.log(`PostgreSQL version check passed (server_version_num=${versionNum})`);
  } finally {
    await client.end();
  }
}

async function checkPgBoss() {
  const boss = new PgBoss(connectionString);
  boss.on('error', (err) => console.error('pg-boss error', err));
  await boss.start();
  try {
    const client = new Client({ connectionString });
    await client.connect();
    try {
      const { rows } = await client.query(
        "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'pgboss'"
      );
      if (rows.length === 0) {
        throw new Error('pg-boss did not create its schema');
      }
      console.log('pg-boss schema check passed');
    } finally {
      await client.end();
    }
  } finally {
    await boss.stop({ graceful: false, timeout: 5000 });
  }
}

async function main() {
  await checkPostgresVersion();
  await checkPgBoss();
  console.log('FND-000 environment smoke test: PASS');
}

main().catch((err) => {
  console.error('FND-000 environment smoke test: FAIL');
  console.error(err);
  process.exit(1);
});
