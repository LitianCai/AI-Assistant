# Production to-dos

Status as of 22 November 2026. Items are what must be true before the first paying client goes live, what waits until after the pilot, what is needed to onboard a second client, and what is deliberately later.

## After the pilot

1. **Thread storage.** For the pilot, the API will not store the conversation thread. The browser tab holds the thread for the visit and sends the recent turns with the next message. The API does not treat that history as fact. Tool results must come from a fresh tool call in the current request. A refresh may restore the thread from the tab. The thread is gone when the tab closes. The 7-day server retention does not apply during the pilot. The message-request history field and the removal of the in-memory store are not built yet. Where the thread is stored in production is a separate founder decision and must be recorded then.

## Before the first paying client

2. **The audit log survives a restart.** Tool calls and handoffs are recorded in memory only. Done means an append-only store that holds no secrets and no unneeded personal data.
3. **Real sign-in.** The only token today comes from a development-only endpoint that mints one demo customer. Done means a client's portal issues short-lived signed tokens for its own users, and the API checks them for that tenant only.
4. **Next task: a second tenant, proven isolated.** The API is wired to the Northline demo tenant and its tools. Done means a second tenant has its own prompt, tools, and data scope, and a test shows it cannot see Northline's data.
   - Open questions for the founder before any code (tenancy and security, so `AGENTS.md` requires a decision first):
     - Is the tenant named "SouthSupplyLine" or "Southline Supply"? The repo has `demo-applications/SouthlineSupply.*`.
     - Which client API does its tool calls use? The Southline demo API, or another?
     - Which jurisdiction applies: canada-other, or Quebec (which needs the residency flag and canadaeast)?
     - How is the tenant resolved from the signed token, and where is its prompt, tool list, and data scope stored?
     - Does the per-tenant token-signing secret wait for the Key Vault store approval (item 5), or use the first-release HS256 secret?
     - Does the tenant use the same single Foundry project (`foundry-tenancy.mdc`)?
5. **A place for client API secrets.** The Foundry key and the token signing key sit in local developer secrets. The 16 November 2026 Locked decision is that each tenant's token-signing secret is stored in Key Vault as the production design, and the founder still has to approve the store. Done means the founder approves the store, partitioned by tenant, and no secret appears in source, logs, or the widget. Do not create a Key Vault until the founder asks.
6. **Quebec residency on the remote.** The Locked rule (8 November 2026), the region catalog, and the tenant flag exist only as uncommitted local work. origin/master still has the commit that removed the transfer block. Done means the local work is reviewed, tested, committed, and pushed. This blocks any Quebec client in the first sales.
7. **Hosting in Canada.** The API listens on localhost and only local demo sites can call it. Done means the API and the embed script are hosted in Canada on a hostname the founder controls, with TLS everywhere, and only each client's real sites can call the API.
8. **Rate limits.** Nothing stops one tenant or user from flooding the service or running up the Foundry bill. Done means per-tenant and per-user limits are in place.
9. **A handoff per client.** When a lookup fails, the rules require offering a handoff. There is no client-configured link or phone number yet. Done means each tenant can set one, and it appears only in the cannot-answer reply.
10. **Paperwork.** The repo has no client contract, data-processing terms, privacy notice, or Quebec privacy impact assessment process. Done means these exist for PIPEDA and Quebec Law 25 before a client's real users chat.
11. **Access and deletion.** A user's data cannot yet be exported or deleted on request. Done means the founder can export or delete one person's data within one tenant.
12. **A real client API.** The demo talks to the Northline stand-in. Done means a design partner's real API is connected with the same timeouts, circuit breaker, and source labels. No design partner is named yet; that is an Open decision.
13. **Pending.** The admin console that generates a tenant's token-signing secret and shows it once does not exist yet. The first release relies on it (see the 22 November 2026 Locked decision on the token-signing method). Done means the console generates the secret per tenant, shows it once over HTTPS, never emails it, supports rotation, and records each action in the audit log with no secret value in the log.

## Before a second client, without hand-editing code

- Add a tenant with its tools, API address, allowed websites, region, and handoff contact without a code change. No onboarding studio unless the founder asks.
- Widget branding (preset, corner, colour) passes the allow-list and the WCAG AA contrast check.
- Per-tenant usage and outcome reports, event-level only, with no conversation content. Fee and packaging are Open.
- Written support process, availability, and incident expectations.
- The first insurance workflow (three or four factual questions and the API call for each) is still Open.

## Deliberately later

- Insurance coverage advice and sensitive personal data are out of the first insurance workflow.
- Europe and a GDPR programme are Open. Keep the data region selectable so this is not ruled out.
- SOC 2: no programme exists and none is claimed. Keep the controls that would support one later (role-based access, TLS, audit logs).
- A server fallback for speech-to-text is Locked out.
- Client editing of the greeting, suggestions, and placeholder.
- The compact panel.
- Phase 2 client documents, the public web mode, the mapping engine, the onboarding studio, and later industries.
- The two industries are confirmed (Locked, 22 November 2026).
- Open product decisions: name design partners, brand, history screen, fee, and release order.

## Git reminder

The six documents/_* scratch files (documents/_*.py and documents/_*.txt) must never be committed.
