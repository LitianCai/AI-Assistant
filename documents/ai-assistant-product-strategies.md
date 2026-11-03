# AI Assistant Product Strategies

*Discussion captured 31 October 2026. Founder is the decision maker. This note records the working session; it is not a build specification.*

## How to read status

Every decision in this note carries one label. This note uses exactly three labels.

| **Label** | **Meaning** |
| --- | --- |
| **Locked** | The founder stated this and it stands. |
| **Direction** | The current plan from this discussion. It is the plan we will use until the founder changes it. It is not a final commitment. |
| **Open** | Not decided yet. |

Where a point came from the earlier Gemini architecture draft, this note says so. That point is marked Direction or Open. It is marked Locked only where this session records that the founder locked it.

## Decision summary

The table is the short record of this session. Later sections keep the same labels and add the reasoning.

| **Topic** | **Status** | **Statement** |
| --- | --- | --- |
| **Target market** | **Locked** | Medium-size to medium-large companies. |
| **Market boundaries** | **Locked** | Large companies and small companies sit outside the target. |
| **Regions** | **Locked** | Mainly North America and Europe. Start with North America. The founder is in Canada. |
| **Fees and Europe** | **Open** | Exact fee, packaging, when Europe starts, and the data-residency and GDPR implications. |
| **Industry breadth** | **Locked** | The assistant can serve all industries over time, and the work starts with at least two industries. |
| **First industry pair** | **Direction** | Wholesale and industrial distribution, and insurance brokerages and MGAs. |
| **Pair confirmation** | **Open** | The founder asked for at least two industries and has not yet confirmed this exact pair in their own words. |
| **Later industries** | **Direction** | Freight brokers and mid-size logistics come later. Healthcare, large banks, and document-heavy legal or knowledge work wait. |
| **Product shape** | **Direction** | An industry-neutral core, industry packs, a shared widget and core API, and the client’s existing APIs. |
| **Knowledge sources** | **Direction** | Phase 1 is client APIs, the signed-in user and page, the current conversation, approved pack answers, and a human fallback. Phase 2 is client documents, approved articles, and a cited public-web mode. Tickets, email, licensed feeds, warehouses, direct databases, scraping, and open web search stay out. |
| **Distribution pain points** | **Direction** | 2 November 2026. Signed-in customer or employee lookups: order status and partial shipments, invoices and open balances, customer-specific price and available stock, credit hold when that person may see it, backorder and delivery dates, product find from catalog attributes, catalog substitutes, and recent orders for that account. Manuals and approved procedures wait for Phase 2. Email order entry and management analytics stay out. |
| **Distribution demos** | **Open** | Demo applications will use the embeddable widget to cover some of these pains. Which pains, and the sample data, are not chosen. No demo is started. |
| **Technology** | **Direction** | C#, ASP.NET Core, Azure, Azure AI, and React. The more specific Gemini stack remains the working sketch. |
| **Gemini schedule** | **Locked** | The 8–10 week plan is not a delivery constraint. It was only Gemini’s plan. |
| **First release** | **Direction** | One workflow in each of the two industry packs, for one design partner per industry, on one shared platform. |
| **Release order** | **Open** | Whether both design partners come before any release, which companies, their API access, and the order of the two packs. |
| **Widget** | **Locked** | 31 October 2026. Option 1 is the widget to build. It must include three states besides a successful answer: first open (suggested questions only), waiting (no invented result), and cannot answer (API failure or missing sign-in, no invented facts). A phone or contact line appears only inside a cannot-answer reply when the client configured one. The closed launcher is 44px tall. The panel is not draggable. |
| **Speech-to-text** | **Locked** | 2 November 2026. Microphone control in the message composer, not on the launcher. Recognition uses only the browser's built-in speech recognition. This product does not receive, store, log, or forward audio or the live transcript to our API, Foundry, or any new backend. The transcript is written into the message field; the user reviews it and sends it. No auto-send. No server fallback. No new mountAiAssistant field. The browser's own speech engine may process the voice outside this product. We do not retain audio. A sent message follows the existing 7-day retention. |
| **Azure AI Foundry** | **Locked** | One Foundry project for all tenants. The API isolates each tenant. |

*Detail and the session reasoning follow.*

## Product intent

The product is an embeddable, multi-tenant B2B AI assistant. Independent client companies put a lightweight chat widget in their web applications. End users talk to that company’s data through dynamic API tool-calling. The platform is an orchestration and translation layer. Clients keep their existing backend APIs.

### Who decides and who builds

The founder is the decision maker for product and for the technical direction recorded here.

- **Locked.** The founder is the only product person and the only technical person, and is mainly a technical person.

- **Locked.** Expertise is mainly .NET, C#, Azure, Azure AI, React, and related skills.

### Status of the Gemini architecture note

There is an existing draft, documents/ai-assistant-architecture-gemini.md, saved from a Gemini share.

- **Locked.** The founder said that document is not finalized. It is the output of the founder’s discussion with Gemini.

The draft describes the embeddable assistant above. It also sketches a stack and a roadmap. Those sketches move forward in this note only with the status given in Technical direction and Delivery strategy.

The Gemini roadmap described a solo MVP of 8–10 weeks ending in an onboarding dashboard. The founder later stated that this 8–10 week plan is not a delivery constraint. It was only Gemini’s plan. That statement is Locked and is repeated under Technical direction. The onboarding dashboard is placed later, under Delivery strategy.

## Market

Target clients are medium-size to medium-large companies. North America is the starting region, and Europe is a target region as well.

- **Locked.** Target clients are medium-size to medium-large companies.

- **Locked.** Large companies are outside the target. The founder said large companies should have a strong IT department that can create their own AI assistant solution.

- **Locked.** Small companies are outside the target. The founder said small companies cannot afford the fees charged.

- **Locked.** Target regions are mainly North America and Europe.

- **Locked.** Start with North America. The founder is in Canada.

- **Open.** Exact fee, packaging (per tenant, per seat, or otherwise), and when Europe starts.

- **Open.** Data-residency and GDPR implications for Europe remain open.

## Industries

The assistant is meant to serve many industries over time. The first design starts with at least two industries, so the core stays open to that expansion.

- **Locked.** The assistant can potentially work for all industries over time.

- **Locked.** Start with at least two industries so the founder and the design discussion always remember that the product will expand. The product and solution must stay open and flexible enough to expand.

### The current pair

The pair below is the plan this discussion asked to write down. Confirmation of the exact pair remains a separate, open decision.

- **Direction.** The first two industries in the current plan are (1) wholesale and industrial distribution and (2) insurance brokerages and MGAs. This pair was recommended in the discussion and is carried as the current plan. The founder asked for at least two industries and asked for this plan to be written down. The founder has not yet named a different pair.

- **Open.** The founder has not confirmed the exact pair in their own words beyond “at least two industries” and accepting the recommendation path. The pair can be changed.

### Distribution pack

- **Direction.** The distribution pack covers the pain points recorded below. The person chatting may be the distributor’s customer or a signed-in employee of the distributor.

### Distribution pain points

Recorded 2 November 2026. The founder asked to keep the pains from this discussion and the pains from a ChatGPT note that fit this product. The list below is that selection. Demo applications come later.

- **Direction.** Each pain is a factual lookup for a signed-in customer or a signed-in employee. The answer comes from that tenant’s APIs, shows its source, and includes only records that person may see. The assistant does not estimate a fact the API did not return.

1. Order status and partial shipments. The question is whether an order has shipped and which lines are still open.
2. Invoices. The question is for a copy, what was billed, and which invoices are still open. An open balance is included only when that person may see it. Bank and card numbers stay out.
3. That customer’s price and available stock. The price is the customer’s price. Available quantity, including stock already allocated when the API returns that figure, comes from the inventory system. The assistant does not estimate stock from a document or from the conversation.
4. Credit hold. The question is whether this account can order, and only when that person may see the flag.
5. Backorder, promise date, and delivery status. These are answered when the order or shipping record stores the date or the carrier status.
6. Product find. A buyer or a sales rep describes the part, or gives a requirement such as material, size, or pressure, and the assistant searches the catalog’s own attributes. It does not treat general knowledge as an engineering approval. A requirement the catalog did not verify is stated as unverified.
7. Substitutes and accessories. These are answered only when the catalog or ERP already stores that relationship.
8. Recent orders for this account. A customer uses them to ask for the same goods again. A sales rep uses them to see what the account bought. Showing the prior lines, the current price, and the current availability is in scope. Submitting an order or a quote waits until a person confirms that write. That write is not part of this recorded scope.
9. Return and shipment problems. Status is answered when the API has the return or the delivery record.
10. Manuals, datasheets, safety data sheets, and approved procedures, including how a return is processed. These are real pains. They wait for Phase 2 client documents, and the answer cites the passage.

- **Direction.** These items from the ChatGPT note stay out. Email intake of customer purchase orders and supplier mail stays out, because email is not a knowledge source. Management reports, margin trends, forecasts, and “who stopped buying” stay out, because analytics stores are not a source and the assistant does not infer a trend the API did not return. Draft emails, collection letters, and unconfirmed writes, including issuing a credit or changing a credit limit, stay out. The surface stays the embeddable widget. Document search does not move ahead of the API lookups.

### Insurance pack

- **Direction.** The insurance pack covers policies, coverage facts, and questions from brokers or agents. The person chatting may be a broker or agent at the client. The first insurance workflow starts with factual lookups.

- **Direction.** Coverage advice and sensitive personal data stay out of the first insurance workflow. This advice and data boundary is Direction.

### Why this pair

- **Direction.** The two API shapes and vocabularies differ, so a core that serves both stays industry-neutral. Mid-market firms in both already have a portal and a system of record, can pay a real fee, and do not have an internal team whose job is to build an AI platform. Both are reachable from Canada. Europe has the same industry pattern later.

### Later industries

- **Direction.** Freight brokers and mid-size logistics are a later operations pack. They are too similar to distribution to be the second industry.

- **Direction.** Healthcare, large banks, and document-heavy legal or knowledge work wait. The current product shape answers live API records. Those markets need heavier compliance or search over files.

- **Open.** No design-partner company has been named in either industry.

## Product design and flexibility rules

These rules keep one core, and they let a new industry arrive as a pack. The widget and the core API stay shared.

- **Direction.** The core platform contains no industry nouns. The core domain has no Order, Policy, or SKU types.

- **Direction.** The platform owns the embeddable widget, tenant identity, conversation storage, streaming, audit, and the tool-calling loop.

- **Direction.** Each industry is a pack: a system prompt, a tool list, field mapping onto that client’s APIs, and safety rules. A later industry is a new pack. The widget and the core API stay shared.

- **Direction.** The widget and the token model must support two user relationships: the client’s own customer, and an employee or agent of the client.

- **Direction.** Tenant context is resolved on the server from a validated token or key. This comes from the Gemini draft and remains the working security rule.

- **Direction.** Integration stays non-invasive. The client keeps existing APIs. The platform maps tool calls onto those APIs.

- **Direction.** Build the first design partner in each industry with only the tools that partner actually has.

- **Direction.** A generic self-serve onboarding studio waits until both industry packs are real, so the configuration model is based on two concrete API shapes.

- **Open.** The distribution questions are listed under Distribution pain points. Which of those pains the first demo applications cover is still open. The first insurance workflow is still to be chosen: three or four factual questions a user already asks, and the API call that answers each one.

- **Open.** Brand, widget visual design, and exact conversation features (history UI, handoff to a human, citations, and so on) remain open.

- **Locked.** 31 October 2026. Option 1 is the widget to build. It must include three states besides a successful answer: first open (suggested questions only), waiting (no invented result), and cannot answer (API failure or missing sign-in, no invented facts). A phone or contact line appears only inside a cannot-answer reply when the client configured one. The closed launcher is 44px tall. The panel is not draggable.

## Widget decisions

- **Locked.** A page refresh restores the latest thread for the same signed-in person. The server loads it from the verified token. Messages are deleted 7 days after the last message.

- **Locked.** Attention is a greeting bubble, “How can I help you?”, shown once beside the closed launcher. It stays until dismissed or the assistant is opened. The scale pulse is not used.

- **Locked.** While a lookup runs, the panel shows a generic moving indicator and the word Working. The answer appears a few words at a time only after the tool result is back, with its source.

- **Locked.** The first build uses the standard Option 1 panel. The compact panel is not in the first build.

- **Locked.** First-build chrome copy is fixed: greeting “How can I help you?”, placeholder “Type a message”, suggested questions “What can you do?”, “Help me find something”, and “I have a question”. Cannot-answer copy: “I can’t retrieve that right now.” and “Sign in to continue.” Client editing of those strings is later.

- **Locked.** 2 November 2026. Speech-to-text is a widget composer control. A microphone control sits in the message composer, not on the launcher. The launcher still shows words or an icon, never both. Recognition uses only the browser's built-in speech recognition. This product does not receive, store, log, or forward audio or the live transcript to our API, Foundry, or any new backend. The transcript is written into the existing message field. The user reviews it and sends it with the existing send path. The product does not auto-send. Language follows the widget's existing resolution order: host setting, then page lang, then browser language, then English. Language is limited to English, French, and Spanish. There is no language switcher. When the browser has no speech recognition, the product does not offer a server fallback. The control is hidden or disabled with an accessible explanation. There is no new mountAiAssistant config field. The public embed contract stays as it is. The browser's own speech engine may process the voice outside this product. Our retention rule is unchanged: we do not retain audio. The resulting message, once the user sends it, follows the existing 7-day message retention. The control has an accessible name, a tooltip, and a 44px target. It is keyboard operable, with a visible focus indicator. It respects prefers-reduced-motion. Strings are in English, French, and Spanish.

## Features and capabilities

This list contains only capabilities already implied by the Gemini draft and by this discussion. Each item carries a status. Brand, visual design, and extra conversation features stay in the open list, and this note adds no further feature backlog.

### In the working shape

- **Direction.** From the Gemini draft and this discussion: an embeddable lightweight chat widget that a client company places in its web application.

- **Direction.** From the Gemini draft: multi-tenant operation for independent client companies.

- **Direction.** From the Gemini draft: dynamic API tool-calling, so an end user talks to that company’s data.

- **Direction.** From the Gemini draft and this discussion: the platform as an orchestration and translation layer. The client keeps its existing backend APIs.

- **Direction.** From this discussion: the platform owns tenant identity, conversation storage, streaming, audit, and the tool-calling loop.

- **Direction.** From the Gemini draft: streaming replies to the widget. The draft names SSE as the working sketch for that streaming.

- **Direction.** From this discussion: two user relationships in the widget and the token model, the client’s own customer and an employee or agent of the client.

- **Direction.** From the Gemini draft: server-side tenant resolution from a validated token or key, with rate limits, timeouts, and circuit breakers.

- **Direction.** From this discussion: an industry pack of system prompt, tool list, field mapping onto the client’s APIs, and safety rules. The widget and the core API stay shared.

- **Direction.** From this discussion: a distribution pack for the pain points recorded under Distribution pain points. The person chatting may be the distributor’s customer or a signed-in employee.

- **Direction.** From this discussion: an insurance pack for policies, coverage facts, and questions from brokers or agents, starting with factual lookups. Coverage advice and sensitive personal data stay out of that first workflow.

- **Direction.** From this discussion: the first design partner in each industry is built with only the tools that partner actually has.

### Later, after two real packs

These items wait until two concrete API shapes exist, one from each of the two industries. The Gemini roadmap is the source of the mapping engine and the onboarding dashboard. This discussion places both of them after those two shapes.

- **Direction.** From the Gemini roadmap, placed here by this discussion: a generalized mapping engine, after two real API shapes exist.

- **Direction.** From the Gemini roadmap and this discussion: a self-serve onboarding studio, including the onboarding dashboard in the Gemini roadmap, after both industry packs are real. The configuration model then rests on two concrete API shapes.

- **Direction.** From this discussion: a later operations pack for freight brokers and mid-size logistics.

- **Direction.** From this discussion: healthcare, large banks, and document-heavy legal or knowledge work wait. The current product shape answers live API records. Those markets need heavier compliance or search over files.

- **Open.** Brand, widget visual design, and conversation features such as a history UI, handoff to a human, and citations. They were left undecided in this session.

## Technical direction

The technical direction follows the founder’s skill set and the Gemini draft. The broad stack and the more specific sketch are both Direction. One schedule item from that draft is Locked, because the founder ruled on it in this session.

- **Direction.** Keep C#, ASP.NET Core, Azure, Azure AI, and React. That is the founder’s skill set, and it matches the Gemini draft.

- **Direction.** The more specific Gemini choices remain the working sketch: ASP.NET Core on .NET 9; Azure Cosmos DB partitioned by tenant_id; Semantic Kernel, Azure OpenAI, and Azure AI Foundry; a React, TypeScript, and Vite widget in a Shadow DOM; SSE streaming; Azure Key Vault; a C# adapter with Polly that maps tool calls onto each client’s HTTP API; server-side tenant resolution; rate limits, timeouts, and circuit breakers. These items come from documents/ai-assistant-architecture-gemini.md. They carry Direction status.

The Gemini roadmap described a solo MVP of 8–10 weeks ending in an onboarding dashboard.

- **Locked.** The 8–10 week Gemini schedule is not a delivery constraint. It was only Gemini’s plan.

- **Locked.** 31 October 2026. Use one Azure AI Foundry project for multiple tenants. That project is the shared model and agent runtime. It does not isolate client companies. The .NET API isolates them: it verifies the short-lived signed token, and each request uses only that tenant’s prompt and tools. Conversation history and client API secrets stay in the application store and Key Vault, partitioned by tenant. A separate Foundry project per client is not the demo setup and not the setup for the first clients.

## Delivery strategy

Delivery follows one founder. The current plan keeps both industries on one shared platform.

- **Direction.** The founder is one person, so the first release is narrow: one workflow in each of the two industry packs, aimed at one design partner per industry, with enough tenancy and security for those clients.

- **Direction.** Shared platform behavior is built as one product that both industries use: the widget, identity, conversation store, streaming, audit, and the tool loop.

- **Direction.** The generalized mapping engine and the onboarding dashboard from the Gemini roadmap come after two real API shapes exist.

- **Open.** Whether a design partner in both industries is required before any release, or one partner ships first while the model stays capable of two industries.

- **Open.** Named first companies, access to their APIs, and the order of the two packs.

## Knowledge sources

- **Direction.** The founder asked for every source to be recorded, and accepted this phasing. It can still be changed.

An answer the product stands behind comes from a client-owned system or from text the client approved. Other sources can inform, and they must be labeled as such.

### Phase 1

1. Client systems of record, through the client’s APIs. Live records and the actions those systems allow. Distribution examples: orders, inventory, price, invoices, credit. Insurance examples: policies, coverages, claims status, broker records. Highest exactness when the API returns the field.

2. Who is asking, and where they are. Identity, role, permissions, and the page or record on screen. A customer on an order page, or a broker inside a policy. The assistant may only see what that person may see.

3. The current conversation. Enough to resolve follow-ups such as “that order I just asked about.” Prior chats across sessions are not part of Phase 1.

4. Curated answers and safety rules stored in the industry pack. A small set of approved question-and-answer pairs, the tool list, and rules such as factual lookups only for insurance.

5. A person at the client, as the fallback. When the assistant is unsure, or an action needs approval, it hands the question to a client employee. This is an escape hatch, not a knowledge store.

### Phase 2

1. Client documents. Spec sheets, safety data sheets, catalogs, price lists, contracts, policy wordings, appetite guides, procedure manuals. The assistant shows the passage it used. This matters especially for insurance, because wordings often exist only as files.

2. Client knowledge articles the client already maintains (portal FAQs, playbooks, service-desk or wiki articles), when those articles are approved and current.

3. Public web, as a separate mode. The client chooses the allowed sites. Every answer cites the page. Suitable for public facts such as a manufacturer spec, a regulator page, or a carrier’s public tracking status. Public web is not a source for the client’s own orders, prices, inventory, or coverage.

### Left out

Not in the product plan until a specific client brings a workflow that needs one of them:

1. Work history: support tickets, email, call notes, chat transcripts.

2. Licensed third-party data feeds (address and company data, hazard data, rating or classification data).

3. Analytics stores and warehouses (sales by customer, loss ratios, aged inventory). Suitable for trends across many records. The wrong source for the current state of one record.

4. Direct access to client databases, screen scraping, and unrestricted web search.

## Open decisions

These are the questions the founder still needs to decide. While they stay open, the Direction items in this note remain the working plan.

1. What fee will the product charge, how will it be packaged (per tenant, per seat, or otherwise), and when does Europe start?

2. What data-residency and GDPR implications apply for Europe?

3. Does the founder confirm wholesale and industrial distribution together with insurance brokerages and MGAs as the first two industries, or name a different pair?

4. Which design-partner company, if any, is first in distribution, and which is first in insurance?

5. Which of the recorded distribution pain points will the first demo applications cover?

6. What is the first workflow in the insurance pack, within factual lookups, using that same question-and-API step?

7. What brand, widget visual design, and conversation features will the product include? History UI, handoff to a human, and citations are among the items still open.

8. Is a design partner in both industries required before any release, or may one partner ship first while the model stays capable of two industries?

9. In what order will the two packs be built, and when will access to each partner’s APIs be available?

10. Do Phase 2 documents enter before the public-web mode?

11. Which sites may a client allow in the public-web mode?

Answering these questions updates this note. Until then, Locked items stand, and Direction items are the plan the work will use.
