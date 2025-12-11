# Git Commit Message Examples - Comprehensive Guide

## Table of Contents
1. [Basic Format](#basic-format)
2. [Feature Commits](#feature-commits)
3. [Fix Commits](#fix-commits)
4. [Refactor Commits](#refactor-commits)
5. [Performance Commits](#performance-commits)
6. [Documentation Commits](#documentation-commits)
7. [Configuration Commits](#configuration-commits)
8. [Database Commits](#database-commits)
9. [API/Endpoint Commits](#apiendpoint-commits)
10. [Real-World Examples](#real-world-examples)

---

## Basic Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

---

## Feature Commits

### Simple Feature
```
feat: add user authentication
```

### Feature with Scope
```
feat(backend-rust): add Prometheus metrics endpoint
```

### Feature with Details
```
feat(backend-rust): add Prometheus metrics endpoint

Add /metrics route to expose indexer metrics in Prometheus format.
Enables monitoring with Prometheus and Grafana dashboards.
```

### Feature with Breaking Change
```
feat(api): change user endpoint response format

BREAKING CHANGE: User endpoint now returns nested user object
instead of flat structure. Update client code accordingly.
```

### Feature with Multiple Changes
```
feat(backend-rust): add metrics and improve error handling

- Add Prometheus /metrics endpoint
- Improve error messages for RPC failures
- Add retry logic for transient errors
```

---

## Fix Commits

### Simple Fix
```
fix: resolve database connection timeout
```

### Fix with Scope
```
fix(backend-rust): fix blocking RPC calls in async context
```

### Fix with Details
```
fix(backend-rust): wrap blocking RPC calls in spawn_blocking

RpcClient calls were blocking the async runtime. Wrap them in
tokio::task::spawn_blocking to prevent runtime blocking.

Fixes: #123
```

### Fix with Multiple Issues
```
fix(backend-rust): fix database TLS and async blocking issues

- Configure rustls for PostgreSQL SSL connections
- Wrap blocking RPC calls in spawn_blocking
- Fix certificate verification for Supabase
```

### Fix with Test
```
fix(backend-rust): fix memory leak in indexer cache

Add proper cleanup for processed signatures cache.
Adds test to verify cache cleanup behavior.

Fixes: #456
```

---

## Refactor Commits

### Simple Refactor
```
refactor: extract indexer logic into separate service
```

### Refactor with Details
```
refactor(backend-rust): extract metrics into separate module

Move Prometheus metrics collection logic from main.rs to
dedicated metrics module for better organization.
```

### Refactor with Benefits
```
refactor(backend-rust): use Arc<RwLock> for shared state

Replace Mutex with RwLock for better read performance.
Allows multiple concurrent readers while maintaining
exclusive write access.
```

---

## Performance Commits

### Simple Performance
```
perf: optimize database queries
```

### Performance with Details
```
perf(backend-rust): optimize transaction processing

- Batch database inserts for multiple NFTs
- Reduce RPC calls by caching transaction data
- Improve cache hit rate from 60% to 85%

Reduces average processing time by 40%.
```

### Performance with Metrics
```
perf(backend-rust): improve indexer throughput

- Parallelize transaction processing
- Optimize event parsing with zero-copy deserialization
- Reduce memory allocations

Throughput: 2,000 tx/s → 5,000 tx/s (2.5x improvement)
```

---

## Documentation Commits

### Simple Docs
```
docs: update README with setup instructions
```

### Docs with Details
```
docs(backend-rust): add Prometheus monitoring guide

Document how to set up Prometheus and Grafana for monitoring
the Rust backend. Includes configuration examples and dashboard
templates.
```

### Docs for API
```
docs(api): document all NFT endpoints

Add OpenAPI/Swagger documentation for:
- GET /nft/user/:walletAddress
- GET /nft/mint/:mintAddress
- GET /nft/statistics
```

---

## Configuration Commits

### Simple Config
```
chore: update dependencies
```

### Config with Details
```
chore(backend-rust): add rustls dependency for TLS

Add rustls and webpki-roots dependencies to support
PostgreSQL SSL connections with custom certificate verification.
```

### Config for Environment
```
chore: add .env.example with all required variables

Document all environment variables needed for:
- Database connection
- Solana RPC configuration
- Server settings
```

---

## Database Commits

### Simple DB
```
feat: add user_levels table
```

### DB with Migration
```
feat(database): add buyback_events table

Create migration to add buyback_events table with:
- transaction_signature (unique)
- amount_sol (bigint)
- token_amount (bigint)
- timestamp, slot, block_time

Migration: 20241211_add_buyback_events.sql
```

### DB Schema Change
```
refactor(database): normalize user data structure

Split user data into users and user_levels tables.
Add foreign key relationships and indexes.

BREAKING CHANGE: User data structure changed
```

---

## API/Endpoint Commits

### Simple Endpoint
```
feat(api): add user NFT endpoint
```

### Endpoint with Details
```
feat(api): add GET /nft/user/:walletAddress endpoint

Returns all NFTs owned by the specified wallet address.
Includes pagination support and filtering options.

Query params:
- limit: Number of results (default: 20)
- offset: Pagination offset (default: 0)
- sort: Sort order (default: createdAt)
```

### Endpoint with Auth
```
feat(api): add authenticated buyback endpoint

Add POST /nft/buyback endpoint that requires authentication.
Validates user ownership and processes buyback transaction.
```

---

## Real-World Examples

### Example 1: Metrics Endpoint (Your Recent Change)
```
feat(backend-rust): expose Prometheus metrics endpoint

Add /metrics route to expose indexer metrics in Prometheus format.
Metrics include indexing status, processed transactions, errors,
retries, cache utilization, and last processed timestamp.

This enables monitoring and alerting with Prometheus/Grafana.
```

### Example 2: Database TLS Fix
```
fix(backend-rust): configure TLS for PostgreSQL connections

- Add rustls support for Supabase SSL connections
- Implement custom NoVerifier for certificate validation
- Initialize aws_lc_rs crypto provider for rustls

Fixes database connection errors with Supabase.
```

### Example 3: Async Blocking Fix
```
fix(backend-rust): fix blocking RPC calls in async context

Wrap RpcClient calls in tokio::task::spawn_blocking to prevent
blocking the async runtime. Affects:
- get_signatures_for_address
- get_transaction_with_config

Fixes: "can call blocking only when running on multi-threaded runtime"
```

### Example 4: Performance Improvement
```
perf(backend-rust): optimize event parsing

- Use zero-copy deserialization for Borsh data
- Cache parsed event structures
- Reduce memory allocations

Improves parsing speed by 3-5x (2-3μs vs 10-15μs per event).
```

### Example 5: New Feature with Tests
```
feat(backend-rust): add NFT ownership verification

Add service to verify NFT ownership before indexing.
Checks token account existence and ownership status.

- Add check_ownership method to NftStorageService
- Skip burned/transferred NFTs during indexing
- Add tests for ownership verification logic
```

### Example 6: Refactor with Breaking Change
```
refactor(api): restructure NFT response format

Change NFT endpoint responses to include nested metadata object
instead of flat structure.

Before:
{
  "mint": "...",
  "name": "...",
  "uri": "..."
}

After:
{
  "mint": "...",
  "metadata": {
    "name": "...",
    "uri": "..."
  }
}

BREAKING CHANGE: Update client code to access nested metadata
```

### Example 7: Configuration Update
```
chore: update Solana RPC configuration

- Switch from mainnet to devnet for testing
- Update program ID to devnet program
- Add rate limiting configuration

Program ID: DvGwWxoj4k1BQfRoEL18CNYnZ8XYZp1xYHSgBZdvaCKT
```

### Example 8: Documentation Update
```
docs: add benchmarking guide

Document how to run performance benchmarks comparing Rust and
NestJS backends. Includes:
- Setup instructions
- Benchmark scripts
- Result interpretation
- Performance comparison methodology
```

### Example 9: Bug Fix with Root Cause
```
fix(backend-rust): fix chrono DateTime serialization error

Explicitly cast updated_at to timestamptz in SQL query to resolve
PostgreSQL serialization error with chrono::DateTime<Utc>.

Error: "cannot serialize chrono::DateTime<Utc> to PostgreSQL"
Fix: Use explicit type cast in SQL: $1::timestamptz

Fixes: #789
```

### Example 10: Feature with Dependencies
```
feat(backend-rust): add Prometheus metrics support

- Add prometheus crate dependency
- Implement metrics_handler function
- Register /metrics route
- Expose indexer metrics in Prometheus format

Dependencies:
- prometheus = "0.13"
- tokio = "1.0" (for async support)
```

---

## Multi-Line Examples

### Detailed Feature
```
feat(backend-rust): add comprehensive monitoring support

Add Prometheus metrics endpoint and improve observability:

Metrics Endpoint:
- GET /metrics returns Prometheus-formatted metrics
- Exposes indexer status, throughput, errors, and cache stats

Logging:
- Add structured logging with tracing
- Include request IDs for request tracing
- Add log levels configuration

Health Checks:
- Improve /health endpoint with component status
- Add /health/indexer for indexer-specific health

This enables production-grade monitoring and debugging.
```

### Comprehensive Fix
```
fix(backend-rust): resolve multiple async and database issues

Database Connectivity:
- Configure TLS for PostgreSQL (Supabase compatibility)
- Add custom certificate verifier (NoVerifier)
- Initialize rustls crypto provider

Async Runtime:
- Wrap blocking RpcClient calls in spawn_blocking
- Fix "multi-threaded runtime" errors
- Improve async/await usage

Serialization:
- Fix chrono DateTime serialization with explicit casts
- Resolve PostgreSQL type mismatches

All changes maintain backward compatibility.
```

---

## Commit Message Styles

### Style 1: Minimal
```
feat: add metrics endpoint
```

### Style 2: Standard
```
feat(backend-rust): add Prometheus metrics endpoint
```

### Style 3: Detailed
```
feat(backend-rust): add Prometheus metrics endpoint

Add /metrics route to expose indexer metrics.
```

### Style 4: Comprehensive
```
feat(backend-rust): add Prometheus metrics endpoint

Add /metrics route to expose indexer metrics in Prometheus format.
Metrics include indexing status, processed transactions, errors,
retries, cache utilization, and last processed timestamp.

This enables monitoring and alerting with Prometheus/Grafana.

Closes: #123
```

---

## Common Patterns

### Pattern 1: Feature Addition
```
feat(<scope>): add <feature>

<description of what was added and why>
```

### Pattern 2: Bug Fix
```
fix(<scope>): fix <issue>

<description of the problem and solution>

Fixes: #<issue-number>
```

### Pattern 3: Performance
```
perf(<scope>): improve <component> performance

<what was optimized>
<metrics showing improvement>
```

### Pattern 4: Refactor
```
refactor(<scope>): <what was refactored>

<why it was refactored>
<benefits of the change>
```

### Pattern 5: Breaking Change
```
feat(<scope>): <change>

<description>

BREAKING CHANGE: <what breaks and how to migrate>
```

---

## Tips for Good Commit Messages

1. **Use imperative mood**: "add" not "added" or "adding"
2. **Keep subject line under 50 characters** (if possible)
3. **Capitalize first letter** of subject
4. **No period** at end of subject line
5. **Use body** to explain what and why, not how
6. **Reference issues** when applicable
7. **Be specific** about scope and changes
8. **Mention breaking changes** explicitly

---

## Quick Reference

### For Your Recent Change (Metrics):
```
feat(backend-rust): expose Prometheus metrics endpoint

Add /metrics route to expose indexer metrics in Prometheus format.
Enables monitoring with Prometheus and Grafana dashboards.
```

### For Database Fixes:
```
fix(backend-rust): configure TLS for PostgreSQL connections

Add rustls support for Supabase SSL connections.
```

### For Performance:
```
perf(backend-rust): optimize transaction processing

Improve throughput by 2.5x through parallelization.
```

### For New Features:
```
feat(api): add user NFT listing endpoint

Add GET /nft/user/:walletAddress with pagination support.
```

---

## Best Practices

✅ **DO:**
- Write clear, descriptive messages
- Use conventional commit format
- Include scope when relevant
- Explain why, not just what
- Reference related issues

❌ **DON'T:**
- Write vague messages like "fix stuff"
- Use past tense ("fixed", "added")
- Write too long subject lines
- Forget to mention breaking changes
- Commit unrelated changes together

---

## Your Specific Case

Based on your recent change (adding Prometheus metrics route):

**Recommended:**
```
feat(backend-rust): expose Prometheus metrics endpoint

Add /metrics route to expose indexer metrics in Prometheus format.
Enables monitoring with Prometheus and Grafana dashboards.
```

**Alternative (if committing multiple changes):**
```
feat(backend-rust): add monitoring and improve connectivity

- Add Prometheus /metrics endpoint
- Configure TLS for PostgreSQL connections
- Fix async blocking issues in RPC calls
```

