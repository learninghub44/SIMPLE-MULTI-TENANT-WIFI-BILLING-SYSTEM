# Operator onboarding and deployment

The project has a static Next.js frontend and a Node.js/Express API. Keep the frontend on Cloudflare Pages and run the API on a Node host; this code is not a Cloudflare Worker.

## Operator domains

1. Set `OPERATOR_BASE_DOMAIN` to the platform's apex domain (for example, `example.com`).
2. Route the apex and wildcard operator subdomains to the Cloudflare Pages frontend.
3. Route `api.<domain>` to the Node API host and set `PUBLIC_API_BASE_URL` to that API origin.
4. Set `NEXT_PUBLIC_API_URL` to the public API origin when building the static frontend. The browser's operator subdomain origin is used to scope API requests to the correct operator.
5. Operators register at `/operator/signup`; each chosen slug then resolves as `https://<slug>.<OPERATOR_BASE_DOMAIN>`.
6. Until the base domain is configured and wildcard routing is active, operators can create accounts and save integration settings, but customer subdomains will not resolve.

For a MikroTik captive portal redirect, include the router-provided MAC in the URL, for example `https://<operator-subdomain>/?mac=$(mac)`.

## Payment and router settings

- Operators enter PayHero API username, API password, and channel ID at `/operator/settings`. Wi-Fi checkout uses PayHero when configured. Otherwise it can use the existing platform-level Daraja configuration.
- Loan payments are not routed through PayHero.
- Operators also enter their own MikroTik API host and credentials. Credentials are encrypted before storage and are never returned by the settings API.
- The current router client uses unencrypted MikroTik API on port 8728. Do not use it with a router exposed to the public internet in production; API-SSL or a protected network path is required before live use. The host must resolve only to public IPv4 addresses, and private/local addresses are rejected to reduce server-side request forgery risk.
- Keep `PAYMENT_CREDENTIALS_KEY` stable, or keep the selected `SESSION_SECRET` / `JWT_SECRET` stable if using the fallback. Rotating the encryption key without re-encrypting credentials makes saved integration credentials unreadable.
- For a split Cloudflare Pages + Node API deployment, browser requests are scoped using the `Origin` subdomain and PayHero callbacks use `/api/payhero/callback/<operator-slug>`. Keep API CORS enabled for the platform and operator origins.

## Database rollout

The new operator/payment migration is included but was not applied to any database. Back up the target database, then run `npx prisma migrate deploy` in the target environment before starting the updated app. Do not run `db push` against production.

## Audit items still requiring a decision or separate work

- Existing Wi-Fi access uses MikroTik hotspot bypass bindings. The application records package expiry, but this binding currently has no router-side expiry/revocation job; paid access can outlive its package until that is addressed.
- Daraja credentials remain platform-wide. Operators with their own PayHero credentials are isolated; per-operator Daraja accounts are not implemented.
- Existing loan, support, and legacy admin features are intentionally excluded from operator subdomains. They remain platform-host features.
- The customer MAC is supplied by the captive-portal redirect or router lookup. The installed hotspot login page must actually pass the router's `$(mac)` value.
