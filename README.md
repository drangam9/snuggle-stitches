# Snuggle Stitches

A Romanian-only crochet-plushie showcase and product catalogue, built with React, TypeScript, Vite, and Cloudflare Workers. Published products, descriptions, prices, and images are loaded from Cloudflare D1 and R2. The private owner screen supports creating, editing, publishing, unpublishing, repricing, reordering, and deleting products.

For a diagram of the frontend-to-Worker-to-database flow, see [ARCHITECTURE.md](./ARCHITECTURE.md).

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

The admin page uses this password locally and in production. After entering it, the Worker sets an HttpOnly session cookie that expires after 12 hours. Build the static assets, then start the Worker and Vite in separate terminals:

```sh
npm run build
npm run dev:worker
```

```sh
npm run dev
```

Open the local URL printed by Vite. The admin screen is at `/admin.html`; enter the same local token from `.dev.vars`. The Worker serves local D1 and R2 bindings and the Vite server proxies `/api` requests to it. For a production preview:

```sh
npm run build
npm run preview
```

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
  npm run db:migrate:remote
  ```

- Register a `workers.dev` subdomain in the dashboard if the account does not already have one. Deploy once to publish the public site and obtain its URL:

  ```sh
  npm run deploy
  ```

- Set a strong, randomly generated admin password as a Worker secret, then deploy:

  ```sh
  npx wrangler secret put ADMIN_PASSWORD
  npm run deploy
  ```

- If you previously configured Cloudflare Access for `/admin.html` or `/api/admin/*`, disable or remove those path rules. They would otherwise redirect to the identity-provider login before the password screen can load. The admin page itself is public, but all product-management API routes remain protected by the Worker password session.
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
