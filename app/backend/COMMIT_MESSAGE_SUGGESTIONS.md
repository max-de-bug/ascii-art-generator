# Git Commit Message Suggestions

## Recent Changes Summary

Based on the recent work, here are suggested commit messages:

---

## Option 1: Focused on Prometheus Metrics (Most Recent)

```
feat(backend-rust): expose Prometheus metrics endpoint

Add /metrics route to expose indexer metrics in Prometheus format.
Metrics include: indexing status, processed transactions, errors,
retries, cache utilization, and last processed timestamp.

This enables monitoring and alerting with Prometheus/Grafana.
```

**Type:** `feat` (new feature)
**Scope:** `backend-rust`
**Why:** This was the most recent change we made

---

## Option 2: Comprehensive (If committing all changes)

```
feat(backend-rust): add Prometheus metrics and improve database connectivity

- Add /metrics endpoint for Prometheus monitoring
- Configure TLS for PostgreSQL connections (Supabase compatibility)
- Fix blocking RPC calls in async context using spawn_blocking
- Update dependencies for rustls support

This enables production monitoring and fixes database connection issues.
```

**Type:** `feat` (new feature)
**Scope:** `backend-rust`

---

## Option 3: Separate Commits (Recommended)

### Commit 1: Prometheus Metrics
```
feat(backend-rust): expose Prometheus metrics endpoint

Register /metrics route to expose indexer metrics in Prometheus format.
Enables monitoring with Prometheus and Grafana dashboards.
```

### Commit 2: Other changes (if needed)
```
fix(backend-rust): configure TLS for PostgreSQL connections

- Add rustls support for Supabase SSL connections
- Implement custom certificate verifier
- Fix database connection issues
```

---

## Option 4: Simple and Direct

```
feat: add Prometheus metrics endpoint to Rust backend

Expose /metrics route for monitoring indexer performance and status.
```

---

## Option 5: Conventional Commits Format (Detailed)

```
feat(backend-rust): add Prometheus metrics endpoint

Add HTTP endpoint at /metrics that exposes indexer metrics in
Prometheus text format. Metrics include:

- indexer_is_indexing: Whether indexer is running (0/1)
- indexer_processed_transactions: Transactions in cache
- indexer_currently_processing: Currently processing count
- indexer_total_errors: Cumulative errors
- indexer_total_retries: Cumulative retries
- indexer_cache_utilization: Cache usage (0.0-1.0)
- indexer_last_processed_unix: Last processed timestamp

This enables integration with Prometheus for monitoring and alerting.

Closes: #XXX (if applicable)
```

---

## Recommended: Option 1 or Option 3

**For single commit (all changes together):**
Use **Option 2**

**For focused commit (just metrics):**
Use **Option 1**

**For clean history (separate commits):**
Use **Option 3**

---

## Commit Message Format Guidelines

### Structure:
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

### Scope:
- `backend-rust`: Rust backend
- `backend-nestjs`: NestJS backend
- `wasm`: WebAssembly code

---

## Quick Copy-Paste

**Most Recent Change (Metrics Only):**
```
feat(backend-rust): expose Prometheus metrics endpoint

Add /metrics route to expose indexer metrics in Prometheus format.
Enables monitoring with Prometheus and Grafana.
```

**All Recent Changes:**
```
feat(backend-rust): add Prometheus metrics and improve connectivity

- Add /metrics endpoint for Prometheus monitoring
- Configure TLS for PostgreSQL connections
- Fix async/blocking issues in RPC calls
```

