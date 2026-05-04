import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Determine connection URL or use individual parameters
const connectionString = 
  process.env.DATABASE_URL || 
  (process.env.DB_POSTGRESDB_USER && process.env.DB_POSTGRESDB_PASSWORD && process.env.DB_POSTGRESDB_HOST && process.env.DB_POSTGRESDB_DATABASE
    ? `postgres://${process.env.DB_POSTGRESDB_USER}:${process.env.DB_POSTGRESDB_PASSWORD}@${process.env.DB_POSTGRESDB_HOST}/${process.env.DB_POSTGRESDB_DATABASE}`
    : undefined);

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});
