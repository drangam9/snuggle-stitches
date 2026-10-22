/// <reference types="@cloudflare/workers-types" />

export interface Env extends Omit<WorkerBindings, 'ADMIN_PASSWORD'> {
  ADMIN_PASSWORD?: string
}
