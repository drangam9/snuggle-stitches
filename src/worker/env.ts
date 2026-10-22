/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database
  IMAGES: R2Bucket
  ASSETS: Fetcher
  ENVIRONMENT: string
  ADMIN_PASSWORD?: string
}
