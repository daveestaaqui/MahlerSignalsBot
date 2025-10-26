# AuroraSignalX — Phase 1 Implementation
- Added tier gating (free/pro/elite) with crypto included in PRO tier by default.
- Modular scoring engine blending technical, sentiment, whale, options, fundamentals.
- Message formatter templates for Elite/Pro/Free (trader-grade, DRY_RUN friendly).
- Pipeline stubs for stocks & crypto producing tiered payloads without external calls.
- Adapter stubs (Polygon, AlphaVantage, Crypto, Quiver) to be wired with real APIs.
Next: connect to production adapters, integrate whale/congress feeds, and feed existing publish queue.
