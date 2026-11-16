# Oxc deployment

This fork deploys `oxc-factory` on Cloudflare Workers with Cloudflare Sandbox
0.12.5, Durable Objects, Workflows, and two private R2 buckets. Inference uses a
named AI Gateway. No Astro Discord destination is configured. The Astro release
security capability remains inactive because its repository scope is unchanged.
Oxc disables the upstream Astro persona accounts in `.github/factory.yml`.

## Account and credentials

Use the Cloudflare account approved for Oxc infrastructure. The old triage
Action's Workers AI token is not necessarily a deployment token. Deployment
needs Workers, Durable Objects, Workflows, Containers, and R2 permissions.
The existing Oxc CI token was denied Containers (403) and Workflows (401) in
[the credential preflight](https://github.com/oxc-project/oxc/actions/runs/43802011137).
Provide a deployment token separately from inference credentials.
Create `oxc-factory-private-reports` and `oxc-factory-adversary-artifacts` in that
account before deploying. Configure the named Gateway to accept authenticated
requests from the inference token.

Store these encrypted Worker secrets (never in the sandbox):
- `GITHUB_APP_ID`: `oxc-captain` App client ID (`CAPTAIN_ID` in Oxc CI).
- `GITHUB_APP_PRIVATE_KEY`: its PKCS#8 key (`CAPTAIN_KEY` in Oxc CI); convert a
  PKCS#1 key using `openssl pkcs8 -topk8 -nocrypt` before uploading.
- `GITHUB_WEBHOOK_SECRET`: a new random secret shared with the App webhook.
- `FACTORY_AI_GATEWAY_ACCOUNT_ID`: Gateway account ID.
- `FACTORY_AI_GATEWAY_ID`: Gateway slug.
- `FACTORY_AI_GATEWAY_TOKEN`: token authorized to call that Gateway.

Opus 5.5 uses `cloudflare-ai-gateway/claude-opus-5-5`. It requires working
Gateway provider billing or a configured Anthropic provider key. Oxc's direct
Unified Billing CI probes on 2026-11-16 returned HTTP 402; resolve that before
turning on the Opus configuration. Model metadata alone does not enable billing.

## Build and deploy

```sh
pnpm install --frozen-lockfile
pnpm cf-typegen
pnpm check:types
pnpm test
pnpm build
pnpm test:smoke
pnpm exec wrangler deploy --dry-run
pnpm exec wrangler deploy
```

A Docker daemon is required to build the sandbox image. The image includes
Corepack/pnpm, Rustup, just, cargo-insta, cargo-shear, and ast-grep. The checkout's
`rust-toolchain.toml` selects Rust, so install its components during bootstrap.
`INSTA_REQUIRE_FULL_MATCH=1` applies to all sandbox commands.

## Cutover

1. Merge Oxc's Factory configuration and compatible triage skills. Keep its
   legacy Issue Triage workflow enabled during deployment.
2. Install `oxc-captain` on Oxc with Contents, Issues, and Pull requests write.
   Issue triage alone does not need Checks write. Review and preview capabilities
   additionally require Checks access and their documented subscriptions.
3. Deploy with the six secrets above; verify `/health` returns `{"status":"ok"}`
   and unsigned webhook requests are rejected.
4. Set the GitHub App webhook URL to the deployed Worker's
   `/channels/github/webhook`, with the same signing secret. Subscribe to
   **Issues** and **Issue comment**. These App subscriptions require an App
   owner; the existing App has no subscribed events as of 2026-11-16.
5. Disable legacy triage by setting Oxc's Actions repository variable
   `FACTORY_ENABLED=true`, then activate the App webhook. Check GitHub's ping
   delivery and run a controlled issue triage before considering cutover done.
   Keep only one consumer active while testing an issue.

Rollback: deactivate the Factory webhook, then remove or set
`FACTORY_ENABLED=false` to resume the legacy Action. Existing state labels are
shared. Factory uses `factory/fix-N` branches; legacy branches use their own
prefix and are not automatically adopted or deleted by Factory.
