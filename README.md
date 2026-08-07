# keyzyproxy (Vercel version)

Backend for the future.audio self-serve license dashboard. Talks to Keyzy
(license/activation data) and Shopify (customer metafields) so the
dashboard never needs its own copy of your write API key.

This replaces the Express app that used to run on Render
(futureaudiom/keyzyproxy, main branch) with individual Vercel serverless
functions -- same routes, same behavior, just reshaped for Vercel
instead of a long-running server. No dependencies needed; Node 18+ has
fetch built in.

## Routes

All routes are unchanged from the Render version except get-serial and
health, which are new.

| Route | Method | Purpose |
|---|---|---|
| /api/keyzy/license?serial= | GET | Show license details for a serial |
| /api/keyzy/activations?serial= | GET | List activations (machines) for a serial |
| /api/keyzy/delete/:id | DELETE | Delete one activation by id (frees an activation slot -- this is the error-10 fix) |
| /api/write-metafield | POST {customerId, serial} | Store a customer's serial on their Shopify metafield (called by whatever issues the license, e.g. Zapier) |
| /api/get-serial?customerId= | GET | New. Read a customer's serial back out of their metafield |
| /api/health | GET | Health check |

## Environment variables (set these in Vercel -> Project -> Settings -> Environment Variables)

- APP_ID -- Keyzy app id (write permission, needed for the delete route)
- - APP_KEY -- Keyzy api key (write permission)
  - - SHOP_NAME -- your Shopify subdomain, e.g. futureaudiom for futureaudiom.myshopify.com
    - - SHOPIFY_API_KEY -- Shopify Admin API access token (needs read_customers + write_customers scope for metafields)
      - - ALLOWED_ORIGIN -- optional, restricts CORS once you know the exact origin the dashboard extension calls from. Defaults to * for now.
       
        - Use a clean Keyzy write key here -- not the one labeled "Dashboard" in
        - your Keyzy App Keys page, since that value is the one that leaked in the
        - old futureaudiodashboard repo. Revoke that key regardless of what you
        - deploy.
       
        - ## Known gap before this is customer-facing
       
        - delete/[id].js and get-serial.js currently trust whatever id/customerId
        - they're given -- same trust model the Render version had. Before wiring
        - this up to the actual customer dashboard, add Shopify session-token
        - verification so a customer can only read/delete their own data, not an
        - arbitrary id. That needs the client secret from the Shopify custom app
        - the dashboard extension will live in, which doesn't exist yet -- revisit
        - once that's scaffolded.
       
        - ## Deploying
       
        - 1. This repo is now structured for Vercel. In Vercel: New Project ->
          2. import futureaudiom/keyzyproxy -> set the four env vars above -> Deploy.
          3. 2. Confirm https://your-vercel-domain/api/health responds, then test
             3. /api/keyzy/license?serial=a-real-serial before pointing anything else at
             4. it.
             5. 3. Once confirmed working, update the Zapier step (or whatever calls
                4. /api/write-metafield) to the new Vercel URL, and decommission the Render
                5. service.
