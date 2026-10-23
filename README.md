# Snuggle Stitches

A Romanian-only crochet-plushie showcase and product catalogue, built with React, TypeScript, Vite, and Cloudflare Workers. Published products, descriptions, prices, and images are loaded from Cloudflare D1 and R2. The private owner screen supports creating, editing, publishing, unpublishing, repricing, reordering, and deleting products.

For a diagram of the frontend-to-Worker-to-database flow, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Personal creations preview

The 23 October photo batch contains 12 distinct personal creations: three rabbits, three dogs, two cats, a frog, a pink pony, an axolotl and a floral arrangement. They were added to staging and production with Romanian names, descriptions, labels, categories and alternative text. Their **75-200 RON prices were approved for both environments on 23 October 2026**.

Optimized, metadata-free JPEGs are in [public/images/creatii](./public/images/creatii/). The deployed welcome section uses a dedicated crop of the white rabbit in green overalls, retaining the decorative grass. Original source photos remain unchanged in `public/snuggle-stitches-items-2/`, which is excluded from Cloudflare asset uploads by [public/.assetsignore](./public/.assetsignore). The catalogue photos use static `/images/creatii/` URLs; subsequent admin uploads still use R2.

The content imports were performed explicitly against each environment, not added to automatic database migrations. Existing products were preserved; the imports are not part of future migrations. Both collections remain editable through their respective admin pages.

## Product pricing and photo galleries

- In the admin item editor, choose **Preț fix** (one amount) or **Interval de preț** (minimum and maximum). A fixed price is stored with equal minimum and maximum values and shown as `120 RON`, without range-specific explanatory text. Existing prices remain unchanged.
- Add up to **5 photos per model**, each JPG, PNG or WebP, at most **5 MB per file**. Select several files at once. Drag the photo handles or use the up/down buttons to reorder; the first photo is the cover. Removing a photo only takes effect after saving.
- On collection photos, hovering cycles the gallery every 1.8 seconds and leaving restores the cover. Automatic cycling is disabled for reduced-motion preferences. Single-photo models remain static.
- The product dialog has previous/next buttons, thumbnails, a position counter, keyboard arrow navigation and touch swiping. It does not auto-advance.
- Galleries are persisted in D1 as an ordered `images_json` array; uploaded photo files live in R2. Removed photos are deleted after a successful save, and deleting a model removes all its uploaded photos. Failed uploads/database writes trigger cleanup of newly uploaded files; cleanup failures are logged. Existing single-photo records use their original image until the next save.

Apply [migration 0004](./migrations/0004_product_gallery.sql) **before deploying the updated Worker**. The GitHub staging/production workflow already applies migrations before each deployment. For local development, run `npm run db:migrate:local` again. No remote data migration or deployment is performed by editing the code.

## Run locally

Requires Node.js 22.12+ (or a newer supported release) and npm. Local development uses Wrangler, a local D1 database, and the local Worker.

```sh
npm ci
npm run db:migrate:local
```

Create a `.dev.vars` file in the project root for local admin access:

```dotenv
ENVIRONMENT="local"
ADMIN_PASSWORD="use-at-least-32-random-characters-here"
```

The admin page uses this password locally and in deployed environments. After entering it, the Worker sets an HttpOnly session cookie that expires after 24 hours. Build the static assets, then start the Worker and Vite in separate terminals:

```sh
npm run build
npm run dev:worker
```

```sh
npm run dev
```

Open the local URL printed by Vite. The admin screen is at `/admin.html`; enter the same local password from `.dev.vars`. The Worker serves local D1 and R2 bindings and the Vite server proxies `/api` requests to it. For a frontend-only local build preview (no Worker API):

```sh
npm run build
npm run preview
```

## API abuse protection and catalogue caching

The Worker applies separate per-IP budgets before authentication, database reads, image reads, or cached catalogue access:

| Traffic | Limit |
| --- | --- |
| Login (`POST /api/admin/session`, successful or unsuccessful) | 5 requests/minute |
| Other admin API requests, including unauthenticated requests | 60 requests/minute |
| Public API requests, including `/api/images/*` and unknown API paths | 240 requests/minute |

An exceeded budget returns HTTP `429`, a Romanian error message and `Retry-After: 60`. Static assets are not counted. Client addresses come only from Cloudflare's `CF-Connecting-IP`, not `X-Forwarded-For`; missing addresses are rejected in deployed environments. Local development can share a `local` bucket when no address is supplied.

These Cloudflare Rate Limiting bindings are approximate, eventually consistent, and per Cloudflare location, not a global lockout or spending cap. People sharing an IP share a budget. Staging has separate namespaces from production; reserve the configured namespace IDs for this site's limiters within the account. Keep Cloudflare WAF/bot protections enabled: these application checks run after a Worker invocation has already begun.

Public catalogue responses use **Workers Caching for five minutes**, in a dedicated `PublicCatalog` entrypoint. The outer gateway is explicitly uncached, so rate limiting and admin authentication always run. Cache hits avoid D1 reads; misses query only published products. Forwarded catalogue requests have no client cookies, authorization, query strings or cache-bypass headers, so Cloudflare Access on staging does not prevent sharing this public-data cache after access checks.

Successful product creation, editing, deletion and reordering purge the inner entrypoint's catalogue cache. A purge failure is logged and returned as a warning without pretending the committed database write failed; stale catalogue data may remain until the five-minute TTL expires. Admin/session responses and errors are never cached. The outer response disables browser caching so a browser does not retain an independently stale catalogue. Image responses retain their existing one-day browser cache; this change does not add a shared R2 response cache.

Deploy to staging first. After signing in through Access, check repeated catalogue requests in Workers observability: only cache misses should execute the inner D1 read. Verify a published edit appears on a fresh catalogue request and a sixth login attempt within a minute returns `429`. Local unit tests cover routing, budgets, normalization and purge behavior. With the installed local runtime, the inner fetch ran but did not retain catalogue responses, so local checks do not establish cache hits or TTL expiry; Cloudflare's distributed cache, purge and limiter propagation must also be checked in staging. Local saves may report a cache-purge warning if `ctx.cache` is unavailable.

Platform references: [rate limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [per-entrypoint caching](https://developers.cloudflare.com/workers/cache/configuration/#per-entrypoint-caching), and [cache purging](https://developers.cloudflare.com/workers/cache/purge/).

## Checks

```sh
npm test
npm run lint
npm run build
```

Vitest and Testing Library cover the Romanian-only catalogue, filtering, database-driven pricing, empty and error states, the contact journey, real social links, photo placeholders, and product photo attribution. Keyboard focus trapping, Escape dismissal, focus restoration, and responsive layout are also checked in a real browser.

### Browser checks

Build first, then run `npm run test:e2e`. Playwright starts and stops a production preview server itself. For its bundled browser, install Chromium once with `npx playwright install chromium`. Alternatively, use an installed Microsoft Edge without downloading a browser:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
```

Browser checks cover desktop and mobile layouts, photo placeholders, local product image loading, Romanian copy, collection filters, modal focus trapping and restoration, Escape/backdrop dismissal, mobile navigation, and both social profile links. Screenshots are written to the ignored test-results directory.

## Staging and production deployments

Staging is a persistent, separately deployed Worker, not a version URL backed by production data. Its D1 database and private R2 bucket have been created separately. No production catalogue or images are copied.

| Resource | Staging | Production |
| --- | --- | --- |
| Worker | `snuggle-stitches-staging` | `snuggle-stitches` |
| D1 database | `snuggle-stitches-staging` | `snuggle-stitches` |
| R2 image bucket | `snuggle-stitches-images-staging` | `snuggle-stitches-images` |
| Admin password | Separate staging Worker secret | Existing production Worker secret |
| Access | Entire staging Worker requires sign-in after setup | Public site; admin requires its password |

`npm run deploy` now targets **staging**, not production. So does the `db:migrate:remote` alias. Direct `wrangler deploy` without `--env` still targets the existing top-level production configuration: use the npm commands or always select the environment explicitly.

### One-time staging initialization

1. Authenticate to the intended Cloudflare account with `npx wrangler whoami`. The resource IDs in [wrangler.jsonc](./wrangler.jsonc) already point to the separate staging database and bucket.
2. Initialize the new staging database:

   ```sh
   npm run db:migrate:staging
   ```

   The shared historical migrations insert six unpublished concept drafts. To honor the empty staging catalogue, clear them **once, immediately after this first initialization, before adding any staging products**:

   ```sh
   npx wrangler d1 execute DB --env staging --remote --command "DELETE FROM products;"
   npx wrangler d1 execute DB --env staging --remote --command "SELECT COUNT(*) AS product_count FROM products;"
   ```

   The count should be zero. Never repeat the DELETE after you start adding staging data, and never change that command to `--env production`. Subsequent deployments apply only pending migrations and do not clear products.
3. Build and bootstrap the staging Worker:

   ```sh
   npm run deploy:staging
   npx wrangler secret put ADMIN_PASSWORD --env staging
   ```

   Enter a new strong password interactively; do not put it in source code or a command argument. If the first deployment is blocked by `secrets.required`, create the named Worker through the dashboard and set its `ADMIN_PASSWORD` secret there before deploying. Setting a Worker secret creates a deployment; always include `--env staging`.

### Protect staging before enabling its URL

Staging uses `workers_dev: true` after the initial Access setup, with `preview_urls: false` and no custom routes. Keep the entire staging Worker protected by Access. When bootstrapping this setup in another account, set `env.staging.workers_dev` to `false` until the following setup is complete:

1. Enable Cloudflare Zero Trust for the account if needed.
2. In **Workers & Pages**, select **snuggle-stitches-staging**, then **Access**.
3. Choose **Protect this Worker behind Access**, select **All traffic**, and attach an Allow policy limited to the people who should review the site. An email allow-list with one-time PIN login is sufficient if you do not want an external identity provider.
4. Protect **only the staging Worker**. Do not enable account-wide protection, bypass policies, or a rule limited to `/admin.html`: the requirement is to protect the entire staging site, including API requests and static assets.
5. After applying Access, change only `env.staging.workers_dev` to `true` in [wrangler.jsonc](./wrangler.jsonc), keep `preview_urls: false`, and deploy staging again.
6. Open `https://snuggle-stitches-staging.<your-account-subdomain>.workers.dev` in an incognito window. Both `/` and `/api/products` must require Access authentication. Check that an allowed reviewer can enter and an unlisted reviewer cannot. After Access sign-in, `/admin.html` still uses the separate staging admin password.
7. Add a staging test product and image. Verify it appears on staging but not production. Staging edits, deletions, and reordering must never affect the production catalogue.

Wrangler config does not create the Access application or policy. These dashboard steps are required before the URL is private. Disable `env.staging.workers_dev` again and redeploy if protection cannot be verified.

### Automatic GitHub deployment and production approval

The [deployment workflow](./.github/workflows/deploy.yml) runs checks for pull requests to `main`. Pushes to `main` run tests, build the site, and deploy **staging only**. It never deploys production just because a push or merge occurs.

Before enabling deployments:

1. In the GitHub repository, create environments named `staging` and `production`, restricted to `main`.
2. Add environment-scoped secrets to **each** environment:
   - `CLOUDFLARE_ACCOUNT_ID`: the account containing that environment's resources.
   - `CLOUDFLARE_API_TOKEN`: an account-scoped token with access to the intended Worker and its D1 database; include the R2 permissions Wrangler requires to deploy its bucket binding. Use separate, least-privilege tokens where possible. The local Wrangler OAuth login is not available in GitHub Actions.
3. In the `production` environment, configure **Required reviewers** and disallow administrator bypass where supported. If you are the only reviewer, do not enable Prevent self-review. GitHub plan/repository visibility affects availability of protection rules; if unavailable, the explicit manual promotion described below remains required.
4. Complete the staging database, admin-secret, and Access setup above. Only then set the staging environment variable `STAGING_READY` to `true`. Deployment fails explicitly until this is set.
5. If Cloudflare Workers Builds or another existing deployment integration is enabled, disable its direct-to-production automatic deployment. The workflow cannot intercept a second deployment path.

To promote: inspect staging, then open **Actions > Validate and deploy > Run workflow**, choose `main`, and enable the production promotion checkbox. The workflow revalidates that commit and deploys staging first. Only then can its production job proceed, subject to the `production` environment's approval rules. The exact same frontend artifact and source commit are used for staging and production within that run.

The workflow applies pending migrations to the selected database before deployment. Review migration changes carefully: code rollback does not undo database changes or restore R2 objects. Production deployment never copies staging catalogue data.

Explicit local commands are available for operators and **bypass GitHub's approval rules**:

```sh
npm run deploy:staging
npm run db:migrate:production
npm run deploy:production
```

Regenerate binding types after configuration changes with `npm run types:worker`. Validate packaging without uploading code using `npx wrangler deploy --env staging --dry-run` and `npx wrangler deploy --env production --dry-run`; these do not prove remote resources, secrets, or Access policies are working.

References: [Cloudflare environments](https://developers.cloudflare.com/workers/wrangler/environments/), [protect one Worker with Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/#protect-one-worker), [Workers GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), and [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## Product catalogue and Cloudflare setup

- Products are stored in the D1 `products` table. The migrations create six **unpublished** concept drafts; they never appear in the public catalogue unless the owner replaces their concept content and publishes them. The current schema is Romanian-only.
- Public visitors can read only published products. The owner admin screen is `/admin.html`; it uses the same collection card layout, with inline tag editing and an item editor dialog for product details. Reorder cards by dragging the handle or using the accessible up/down controls; the order is saved to D1.
- The admin collection includes drafts as well as published products. Product categories are free-form Romanian labels, and categories used by published products become filters in the public collection.
- Image attribution is not editable in the admin form. Existing attribution is retained and displayed for the credited inspiration photos.
- New products require an image in the admin editor. Images may be uploaded as JPG, PNG, or WebP (up to 5 MB) and are stored in the private R2 bucket, then served through the Worker. An HTTPS image URL or a local `/images/` path is also supported by the product API.
- For a new Cloudflare account, authenticate Wrangler and create the D1 database and R2 bucket. Enable R2 in the Cloudflare dashboard first if Wrangler requests it:

  ```sh
  npx wrangler login
  npx wrangler d1 create snuggle-stitches
  npx wrangler r2 bucket create snuggle-stitches-images
  ```

- Copy the D1 UUID returned by Wrangler into `database_id` in [wrangler.jsonc](./wrangler.jsonc). The R2 bucket name must match the configured name.
- Apply the schema:

  ```sh
  npm run db:migrate:production
  ```

- Register a `workers.dev` subdomain in the dashboard if the account does not already have one. Deploy once to publish the public site and obtain its URL:

  ```sh
  npm run deploy:production
  ```

- Set a strong, randomly generated admin password as a Worker secret, then deploy:

  ```sh
  npx wrangler secret put ADMIN_PASSWORD --env production
  npm run deploy:production
  ```

- For the production site, remove obsolete Cloudflare Access rules limited to `/admin.html` or `/api/admin/*` if you only want the admin password screen. Keep the full-Worker Access protection on staging; it is intentionally separate from the admin password session.
- The deployment uses the Worker to serve both static assets and the API. To preview the production Worker locally, run `npm run build` and then `npx wrangler dev`; local bindings remain in use unless you explicitly choose remote resources.
- Before going live, replace the concept drafts and any borrowed product photography with the owner's actual products, copy, and original imagery. The hero and story sections currently use photo placeholders. Contact links open [Instagram](https://www.instagram.com/snuggle_stitchess/) and [TikTok](https://www.tiktok.com/@snuggle.stitchess); the site does not submit orders or process payments.
- The site is Romanian-only (`lang="ro"` in [index.html](./index.html)); the admin form and product API use a single Romanian set of product fields. Site copy is in [src/i18n.ts](./src/i18n.ts). Global styling is in [src/index.css](./src/index.css) and page styling in [src/App.css](./src/App.css).
- Google Fonts supplies DM Sans and Fraunces with system fallbacks.

## Inspiration image attribution

Some concept product photos are borrowed and are not work by Snuggle Stitches. Attribution is shown in each product's detail dialog; the hero and story sections use placeholders instead of borrowed photos. Photo adaptations remain under the corresponding share-alike license; those licenses do not apply to the website source code. Replace borrowed product photos before representing the products as finished work.

| Local image | Creator and original source | License |
| --- | --- | --- |
| [bunny-large.jpg](./public/images/bunny-large.jpg) | [Creativa Atelier, Conejita Amigurumi](https://commons.wikimedia.org/wiki/File:Conejita_Amigurumi.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [bear.jpg](./public/images/bear.jpg) | [Thesunandtheturtle, Amigurumi-bear](https://commons.wikimedia.org/wiki/File:Amigurumi-bear.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [fox.jpg](./public/images/fox.jpg) | [Vanessa25120, Renard amigurumi](https://commons.wikimedia.org/wiki/File:Renard_amigurumi.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [cat.jpg](./public/images/cat.jpg) | [Rachel1, Amigurumi Kitty](https://commons.wikimedia.org/wiki/File:Amigurumi_Kitty.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [penguin.jpg](./public/images/penguin.jpg) | [Enziee, Penguin amigurumi](https://commons.wikimedia.org/wiki/File:Penguin_amigurumi.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

[pumpkin.svg](./public/images/pumpkin.svg) is an original concept illustration, not a photograph. Original brand and decorative SVG artwork was created for this frontend.
