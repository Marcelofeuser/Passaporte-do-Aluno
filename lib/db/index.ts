import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

function getDatabaseHost(connectionString: string | undefined) {
  if (connectionString) return new URL(connectionString).hostname.toLowerCase()
  return process.env.PGHOST?.toLowerCase()
}

function isLocalDatabaseHost(hostname: string | undefined) {
  return !hostname || hostname.startsWith('/') || ['localhost', '127.0.0.1', '::1'].includes(hostname)
}

function secureDatabaseUrl(connectionString: string | undefined, useSsl: boolean) {
  if (!connectionString || !useSsl) return connectionString
  const url = new URL(connectionString)
  url.searchParams.set('sslmode', 'require')
  return url.toString()
}

const databaseConnectionString = process.env.DATABASE_URL
const databaseUsesSsl = !isLocalDatabaseHost(getDatabaseHost(databaseConnectionString))

export const pool = new Pool({
  connectionString: secureDatabaseUrl(databaseConnectionString, databaseUsesSsl),
  ...(databaseUsesSsl ? { ssl: true } : {}),
})
export const db = drizzle(pool, { schema })
