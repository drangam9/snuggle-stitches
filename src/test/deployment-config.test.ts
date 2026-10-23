import { parseConfigFileTextToJson } from 'typescript'
import { describe, expect, it } from 'vitest'
import wranglerSource from '../../wrangler.jsonc?raw'
import packageSource from '../../package.json?raw'

interface WorkerConfig {
  name: string
  workers_dev?: boolean
  preview_urls?: boolean
  routes?: string[]
  assets: { directory: string; binding: string; run_worker_first: string[]; not_found_handling: string }
  vars: { ENVIRONMENT: string }
  d1_databases: { binding: string; database_name: string; database_id: string; migrations_dir: string }[]
  r2_buckets: { binding: string; bucket_name: string }[]
  ratelimits: { name: string; namespace_id: string; simple: { limit: number; period: number } }[]
  exports: Record<string, { type: string; cache: { enabled: boolean } }>
}

const parsed = parseConfigFileTextToJson('wrangler.jsonc', wranglerSource)
if (parsed.error) throw new Error('The Wrangler deployment configuration is not valid JSONC.')
const config = parsed.config as WorkerConfig & { env: { staging: WorkerConfig; production: WorkerConfig } }
const { scripts } = JSON.parse(packageSource) as { scripts: Record<string, string> }

describe('deployment environment isolation', () => {
  it('enforces the agreed budgets with isolated staging counters and an uncached gateway', () => {
    const limits = [
      { name: 'LOGIN_LIMITER', simple: { limit: 5, period: 60 } },
      { name: 'ADMIN_LIMITER', simple: { limit: 60, period: 60 } },
      { name: 'PUBLIC_LIMITER', simple: { limit: 240, period: 60 } },
    ]
    for (const environment of [config, ...Object.values(config.env)]) {
      expect(environment.ratelimits.map(({ name, simple }) => ({ name, simple }))).toEqual(limits)
      expect(new Set(environment.ratelimits.map(({ namespace_id }) => namespace_id)).size).toBe(3)
      expect(environment.exports.default.cache.enabled).toBe(false)
      expect(environment.exports.PublicCatalog.cache.enabled).toBe(true)
    }
    expect(config.ratelimits).toEqual(config.env.production.ratelimits)
    const productionIds = config.env.production.ratelimits.map(({ namespace_id }) => namespace_id)
    expect(config.env.staging.ratelimits.every(({ namespace_id }) => !productionIds.includes(namespace_id))).toBe(true)
  })

  it('uses separate staging and production Workers, databases, and buckets', () => {
    const { staging, production } = config.env
    expect(staging.name).not.toBe(production.name)
    expect(staging.d1_databases[0].database_id).not.toBe(production.d1_databases[0].database_id)
    expect(staging.d1_databases[0].database_name).not.toBe(production.d1_databases[0].database_name)
    expect(staging.r2_buckets[0].bucket_name).not.toBe(production.r2_buckets[0].bucket_name)
    expect(staging.vars.ENVIRONMENT).toBe('staging')
    expect(production.vars.ENVIRONMENT).toBe('production')
  })

  it('preserves the existing production resources and serves the same frontend and API bindings', () => {
    expect(config.env.production.name).toBe(config.name)
    expect(config.env.production.d1_databases).toEqual(config.d1_databases)
    expect(config.env.production.r2_buckets).toEqual(config.r2_buckets)
    for (const environment of Object.values(config.env)) {
      expect(environment.assets).toEqual(config.assets)
      expect(environment.d1_databases[0].binding).toBe('DB')
      expect(environment.r2_buckets[0].binding).toBe('IMAGES')
    }
  })

  it('defaults deployment and remote migration commands to staging', () => {
    expect(scripts.deploy).toBe('npm run deploy:staging')
    expect(scripts['db:migrate:remote']).toBe('npm run db:migrate:staging')
    expect(scripts['deploy:staging']).toContain('wrangler deploy --env staging')
    expect(scripts['deploy:production']).toContain('wrangler deploy --env production')
    expect(config.env.staging.preview_urls).toBe(false)
    expect(config.env.staging.routes).toEqual([])
  })
})
