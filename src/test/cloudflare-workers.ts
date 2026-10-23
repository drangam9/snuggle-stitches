import type { Env } from '../worker/env'

// The real base class is provided by workerd; unit tests supply its context and bindings.
export class WorkerEntrypoint {
  protected ctx: ExecutionContext
  protected env: Env

  constructor(ctx: ExecutionContext, env: Env) {
    this.ctx = ctx
    this.env = env
  }
}
