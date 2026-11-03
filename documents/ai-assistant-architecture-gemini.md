*Source: https://gemini.google.com/share/e55df4a77de3*

# Embeddable Multi-Tenant B2B AI Assistant Platform

*High-level architecture, technical stack, and implementation strategy*

## 1. Executive Summary

This document outlines the high-level architecture, technical stack, and implementation strategy for an embeddable, multi-tenant B2B AI assistant platform. The system allows independent client companies to integrate a lightweight chat widget into their web applications, enabling users to interact conversationally with their data through dynamic API tool-calling (function calling).

## 2. Core Architectural Principles

- Strict Multi-Tenant Data Isolation: Zero data leakage between tenant organizations. Tenant boundaries are enforced server-side using cryptographically signed tokens or authenticated widget keys.

- Non-Invasive Integration: Client companies retain their existing backend APIs and data structures. Our platform acts as a secure translation and orchestration layer via an adaptable mapping engine.

- Modular & Scalable: Built on enterprise-grade cloud patterns using modern .NET and Azure services to ensure reliability, security, and low-latency streaming responses.

## 3. High-Level System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                 Client Company Web Application              │
│      [ Embeddable JS Widget / Isolated Shadow DOM UI ]      │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS / Server-Sent Events (SSE) Stream
               ▼
┌─────────────────────────────────────────────────────────────┐
│                Central SaaS Backend (ASP.NET Core)          │
│  - Tenant Resolution Middleware                             │
│  - Session & Conversation State Manager                     │
└──────┬──────────────────────────────────────────────┬───────┘
       │                                              │
       ▼                                              ▼
┌──────────────┐                             ┌─────────────────┐
│  LLM Engine  │                             │  Tool-Calling   │
│ (Azure OpenAI│                             │  Orchestration  │
│  / Semantic  │                             │  (Semantic      │
│   Kernel)    │                             │   Kernel)       │
└──────────────┘                             └────────┬────────┘
                                                      │
                                                      │ Secure Outbound Call
                                                      │ (Dynamic Schema Mapping)
                                                      ▼
                                             ┌─────────────────┐
                                             │  Client Custom  │
                                             │ Backend APIs &  │
                                             │  Data Services  │
                                             └─────────────────┘
```

### Tier 1: The Presentation Layer (The Embeddable Widget)

- Technology: React, TypeScript, Vite (compiled into a self-contained bundle).

- Delivery: A single script tag or NPM package injected into the client website.

- Isolation: Encapsulated within a Shadow DOM to prevent host-site CSS pollution and script conflicts.

- Communication: Real-time token streaming via Server-Sent Events (SSE).

### Tier 2: The Multi-Tenant Core API

- Technology: ASP.NET Core Web API (.NET 9).

- Responsibilities: Incoming request authentication, tenant context resolution, rate limiting, and session state persistence.

- Storage: Azure Cosmos DB (partitioned by tenant_id) for high-performance storage of conversation history and tenant configurations.

### Tier 3: The Orchestration & Tool-Calling Engine

- Technology: Microsoft Semantic Kernel for .NET / Azure AI Foundry.

- Responsibilities: Managing chat turns, system prompts, memory, and LLM orchestration.

- Dynamic Plugin Registration: Automatically loads tenant-specific API tool definitions into the LLM context window based on the authenticated request.

### Tier 4: The Integration & Schema Translation Layer

- Technology: Custom C# Adapter Middleware with Polly resilience policies.

- Responsibilities: Accepts standardized LLM tool call payloads and dynamically maps/transforms them into the unique HTTP method, headers, and body structures expected by each client's custom backend API.

## 5. Security & Multi-Tenancy Design

1. Zero Trust Frontend: The client frontend never dictates its own tenant_id. All tenant context is resolved server-side from validated authentication tokens or secure API keys.

2. Credential Vaulting: Client API secrets and private tokens are encrypted at rest using Azure Key Vault or secure database column encryption with row-level restrictions.

3. Resilience & Timeouts: Strict HTTP timeouts and circuit breakers prevent a slow or failing client-side backend API from hanging the central AI processing pipeline.

## 6. Implementation Roadmap (Solo MVP in 8–10 Weeks)

- Phase 1 (Weeks 1–2): Core ASP.NET Core Web API, multi-tenant database partitioning (Cosmos DB), and authentication middleware.

- Phase 2 (Weeks 3–4): AI orchestration setup via Semantic Kernel and the dynamic tool mapping/translation engine.

- Phase 3 (Weeks 5–6): Embeddable React widget development with Shadow DOM packaging and SSE streaming.

- Phase 4 (Weeks 7–8): Client onboarding configuration dashboard and end-to-end security hardening.
