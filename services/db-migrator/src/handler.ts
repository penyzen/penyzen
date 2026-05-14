import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const secrets = new SecretsManagerClient({});

interface DbSecret {
  username: string;
  password: string;
  host: string;
  port: number;
  dbname: string;
}

export async function handler(): Promise<{ statusCode: number; body: string }> {
  const secretArn = process.env['DB_SECRET_ARN'];
  const proxyHost = process.env['DB_PROXY_ENDPOINT'];
  if (!secretArn) throw new Error('DB_SECRET_ARN env var is required');
  if (!proxyHost) throw new Error('DB_PROXY_ENDPOINT env var is required');

  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!result.SecretString) throw new Error('Secret has no SecretString');
  const creds = JSON.parse(result.SecretString) as DbSecret;

  // Connect via RDS Proxy (use proxy host, not the secret's host which points to the cluster)
  const client = new Client({
    host: proxyHost,
    port: 5432,
    user: creds.username,
    password: creds.password,
    database: creds.dbname,
    ssl: { rejectUnauthorized: false },
  });

  const sql = readFileSync(join(__dirname, 'initial-schema.sql'), 'utf8').replace(/^﻿/, '');

  await client.connect();
  try {
    // Idempotent: only run if the User table doesn't exist yet
    const check = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User') AS exists",
    );
    if (check.rows[0]?.exists) {
      return { statusCode: 200, body: JSON.stringify({ status: 'already-migrated' }) };
    }

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    return { statusCode: 200, body: JSON.stringify({ status: 'migrated', appliedBytes: sql.length }) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}
