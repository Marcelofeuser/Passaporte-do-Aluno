import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

function secureDatabaseUrl(connectionString: string | undefined) {
  if (!connectionString) return connectionString
  const url = new URL(connectionString)
  if (url.hostname.toLowerCase().endsWith('.neon.tech')) {
    url.searchParams.set('sslmode', 'require')
  }
  return url.toString()
}

export const pool = new Pool({ connectionString: secureDatabaseUrl(process.env.DATABASE_URL) })
export const db = drizzle(pool, { schema })
