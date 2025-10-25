## AuroraSignalX hardening (stocks-first, safe)
- Add limits/retry helpers
- Alpha Vantage adapter
- Indicators (SMA/RVOL/gaps)
- Safe stocks runner (`alphaRunner.safe.ts`) to avoid overwrites
- Makefile utilities (diagnostics, tg targets, once)
- CodeRabbit config & CODEOWNERS

**Risk**: Low (non-destructive).  
**Secrets**: Never included.  
**Post-merge**: consider merging `alphaRunner.safe.ts` into `alphaRunner.ts` via `scripts/merge-alpha-runner.sh`.
