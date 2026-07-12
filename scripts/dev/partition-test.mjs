// FND-000 partition capability test: proves PostgreSQL 16 declarative range
// partitioning + DETACH PARTITION works, and that the partition key can sit
// in the PK (precondition for GA-008 / TDS §39.4). Uses an ephemeral schema
// only — not a domain migration, dropped at the end regardless of outcome.
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const SCHEMA = '_env_check';
const TABLE = `${SCHEMA}.partition_capability_test`;

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${SCHEMA}`);

    await client.query(`
      CREATE TABLE ${TABLE} (
        created_at_utc timestamptz NOT NULL,
        id bigint GENERATED ALWAYS AS IDENTITY,
        PRIMARY KEY (created_at_utc, id)
      ) PARTITION BY RANGE (created_at_utc)
    `);

    await client.query(`
      CREATE TABLE ${SCHEMA}.partition_capability_test_2026_01
        PARTITION OF ${TABLE}
        FOR VALUES FROM ('2026-01-01T00:00:00Z') TO ('2026-02-01T00:00:00Z')
    `);
    await client.query(`
      CREATE TABLE ${SCHEMA}.partition_capability_test_2026_02
        PARTITION OF ${TABLE}
        FOR VALUES FROM ('2026-02-01T00:00:00Z') TO ('2026-03-01T00:00:00Z')
    `);

    await client.query(`INSERT INTO ${TABLE} (created_at_utc) VALUES ($1), ($2)`, [
      '2026-01-15T00:00:00Z',
      '2026-02-15T00:00:00Z',
    ]);

    const { rows: totalRows } = await client.query(`SELECT count(*)::int AS count FROM ${TABLE}`);
    if (totalRows[0].count !== 2) {
      throw new Error(`Expected 2 rows across partitions, got ${totalRows[0].count}`);
    }

    const { rows: janRows } = await client.query(
      `SELECT count(*)::int AS count FROM ${SCHEMA}.partition_capability_test_2026_01`
    );
    if (janRows[0].count !== 1) {
      throw new Error(`Expected 1 row in the January partition, got ${janRows[0].count}`);
    }
    console.log('Partition routing check passed (row landed in the correct monthly partition)');

    await client.query(
      `ALTER TABLE ${TABLE} DETACH PARTITION ${SCHEMA}.partition_capability_test_2026_01`
    );

    const { rows: parentAfterDetach } = await client.query(
      `SELECT count(*)::int AS count FROM ${TABLE}`
    );
    if (parentAfterDetach[0].count !== 1) {
      throw new Error(
        `Expected 1 row in parent after DETACH PARTITION, got ${parentAfterDetach[0].count}`
      );
    }

    const { rows: detachedStillHasData } = await client.query(
      `SELECT count(*)::int AS count FROM ${SCHEMA}.partition_capability_test_2026_01`
    );
    if (detachedStillHasData[0].count !== 1) {
      throw new Error('Detached partition lost its data');
    }
    console.log('DETACH PARTITION check passed (parent view shrank, detached data intact)');

    console.log('FND-000 partition capability test: PASS');
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.end();
  }
}

main().catch((err) => {
  console.error('FND-000 partition capability test: FAIL');
  console.error(err);
  process.exit(1);
});
