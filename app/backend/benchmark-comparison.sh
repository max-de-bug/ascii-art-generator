#!/bin/bash

# ============================================================================
# Benchmark Comparison Script: Rust Backend vs NestJS Backend
# ============================================================================
# This script measures and compares indexing performance between the
# Rust and NestJS implementations of the ASCII Art Generator backend.
#
# Prerequisites:
#   - Both backends must be built and ready to run
#   - PostgreSQL/Supabase must be accessible
#   - wrk or bombardier installed for load testing
#   - hyperfine installed for timing comparisons (optional)
#
# Usage:
#   ./benchmark-comparison.sh [OPTIONS]
#
# Options:
#   --rust-only      Only benchmark Rust backend
#   --nestjs-only    Only benchmark NestJS backend
#   --backfill-only  Only run backfill benchmarks (skip API tests)
#   --api-only       Only run API benchmarks (skip backfill)
#   --duration       API test duration in seconds (default: 30)
#   --connections    Number of concurrent connections (default: 64)
#   --threads        Number of threads for load testing (default: 4)
# ============================================================================

set -eo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default configuration
RUST_PORT=3001
NESTJS_PORT=3002
DURATION=30
CONNECTIONS=64
THREADS=4
BACKFILL_LIMIT=1000
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/benchmark-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Paths
RUST_DIR="$SCRIPT_DIR/backend-rust"
NESTJS_DIR="$SCRIPT_DIR/ascii-art-generator-backend"

# Flags
RUN_RUST=true
RUN_NESTJS=true
RUN_BACKFILL=true
RUN_API=true

# Initialize result variables with defaults
RUST_BACKFILL_DURATION="N/A"
RUST_BACKFILL_THROUGHPUT="N/A"
NESTJS_BACKFILL_DURATION="N/A"
NESTJS_BACKFILL_THROUGHPUT="N/A"
RUST_MEM_BEFORE="N/A"
RUST_MEM_AFTER="N/A"
RUST_CPU="N/A"
NESTJS_MEM_BEFORE="N/A"
NESTJS_MEM_AFTER="N/A"
NESTJS_CPU="N/A"

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC} $1"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_subheader() {
    echo ""
    echo -e "${BLUE}──────────────────────────────────────────────────────────────────${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}──────────────────────────────────────────────────────────────────${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_warning "$1 is not installed. Some benchmarks may be skipped."
        return 1
    fi
    return 0
}

wait_for_server() {
    local port=$1
    local name=$2
    local max_attempts=30
    local attempt=0

    print_info "Waiting for $name to start on port $port..."

    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
            print_success "$name is ready"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    print_error "$name failed to start within ${max_attempts}s"
    return 1
}

kill_server_on_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        print_info "Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
        sleep 2
    fi
}

get_memory_usage() {
    local pid=$1
    if [ -n "$pid" ] && [ -d "/proc/$pid" ]; then
        # Get RSS in KB, convert to MB
        local rss=$(cat /proc/$pid/status 2>/dev/null | grep VmRSS | awk '{print $2}')
        if [ -n "$rss" ]; then
            echo $((rss / 1024))
        else
            echo "N/A"
        fi
    else
        echo "N/A"
    fi
}

get_cpu_usage() {
    local pid=$1
    if [ -n "$pid" ]; then
        ps -p $pid -o %cpu --no-headers 2>/dev/null | tr -d ' ' || echo "N/A"
    else
        echo "N/A"
    fi
}

# ============================================================================
# Parse Arguments
# ============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --rust-only)
            RUN_NESTJS=false
            shift
            ;;
        --nestjs-only)
            RUN_RUST=false
            shift
            ;;
        --backfill-only)
            RUN_API=false
            shift
            ;;
        --api-only)
            RUN_BACKFILL=false
            shift
            ;;
        --duration)
            DURATION="$2"
            shift 2
            ;;
        --connections)
            CONNECTIONS="$2"
            shift 2
            ;;
        --threads)
            THREADS="$2"
            shift 2
            ;;
        --backfill-limit)
            BACKFILL_LIMIT="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --rust-only        Only benchmark Rust backend"
            echo "  --nestjs-only      Only benchmark NestJS backend"
            echo "  --backfill-only    Only run backfill benchmarks"
            echo "  --api-only         Only run API benchmarks"
            echo "  --duration N       API test duration in seconds (default: 30)"
            echo "  --connections N    Number of concurrent connections (default: 64)"
            echo "  --threads N        Number of threads (default: 4)"
            echo "  --backfill-limit N Number of transactions to backfill (default: 1000)"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ============================================================================
# Setup
# ============================================================================

print_header "Backend Performance Benchmark: Rust vs NestJS"

# Create results directory
mkdir -p "$RESULTS_DIR" || { print_error "Failed to create results directory"; exit 1; }

# Check for required tools
print_subheader "Checking Prerequisites"

HAS_WRK=false
HAS_BOMBARDIER=false
HAS_HYPERFINE=false

check_command "wrk" && HAS_WRK=true
check_command "bombardier" && HAS_BOMBARDIER=true
check_command "hyperfine" && HAS_HYPERFINE=true
check_command "curl" || { print_error "curl is required"; exit 1; }
check_command "jq" || print_warning "jq not found, some metrics may not display properly"

if [ "$RUN_API" = true ] && [ "$HAS_WRK" = false ] && [ "$HAS_BOMBARDIER" = false ]; then
    print_warning "Neither wrk nor bombardier found. API benchmarks will use simple curl timing."
    print_info "Install wrk: apt-get install wrk / brew install wrk"
    print_info "Install bombardier: go install github.com/codesenberg/bombardier@latest"
fi

# Check for bc command (used for floating point math)
HAS_BC=false
check_command "bc" && HAS_BC=true
if [ "$HAS_BC" = false ]; then
    print_warning "bc not found. Using awk for calculations instead."
fi

# Results file
RESULTS_FILE="$RESULTS_DIR/benchmark_${TIMESTAMP}.json"
touch "$RESULTS_FILE" 2>/dev/null || { print_error "Cannot write to results directory"; exit 1; }
echo '{"timestamp": "'$TIMESTAMP'", "config": {}, "results": {}}' > "$RESULTS_FILE"

print_success "Results will be saved to: $RESULTS_FILE"

# ============================================================================
# Benchmark Functions
# ============================================================================

benchmark_backfill_rust() {
    print_subheader "Benchmarking Rust Backend - Backfill"

    cd "$RUST_DIR"

    # Clean any existing process
    kill_server_on_port $RUST_PORT

    # Set environment
    export PORT=$RUST_PORT

    print_info "Starting Rust backend for backfill benchmark (limit: $BACKFILL_LIMIT)"

    # Create log file
    local log_file="$RESULTS_DIR/rust_backfill_${TIMESTAMP}.log"
    touch "$log_file"

    # Time the backfill
    local start_time=$(date +%s.%N)

    # Run in release mode in background
    cargo run --release 2>&1 | tee "$log_file" &
    local rust_pid=$!

    print_info "Waiting for Rust backfill to complete (monitoring logs)..."
    print_info "Rust PID: $rust_pid"

    # Wait for backfill completion by monitoring logs
    # Rust logs "Backfill complete" when done
    local max_wait=300  # 5 minutes max
    local waited=0
    local backfill_complete=false

    while [ $waited -lt $max_wait ]; do
        # Check if process is still running
        if ! kill -0 $rust_pid 2>/dev/null; then
            print_warning "Rust process exited unexpectedly"
            break
        fi

        # Check for backfill completion message in logs
        if grep -qi "Backfill complete\|backfill.*processed\|Backfilled.*transactions" "$log_file" 2>/dev/null; then
            backfill_complete=true
            print_success "Backfill completion detected in logs"
            break
        fi

        # Also check for polling started (indicates backfill finished)
        if grep -qi "Started polling\|start.*polling\|polling.*started" "$log_file" 2>/dev/null; then
            backfill_complete=true
            print_success "Polling started - backfill must be complete"
            break
        fi

        sleep 1
        waited=$((waited + 1))

        # Show progress every 10 seconds
        if [ $((waited % 10)) -eq 0 ]; then
            print_info "Still waiting... ${waited}s elapsed"
            # Show last few log lines
            tail -2 "$log_file" 2>/dev/null | sed 's/^/    /'
        fi
    done

    local end_time=$(date +%s.%N)

    # Kill the Rust process
    if kill -0 $rust_pid 2>/dev/null; then
        print_info "Stopping Rust backend..."
        kill $rust_pid 2>/dev/null || true
        sleep 2
        kill -9 $rust_pid 2>/dev/null || true
    fi

    local duration
    local throughput

    if [ "$backfill_complete" = true ]; then
        # Calculate duration and throughput (use awk if bc not available)
        if [ "$HAS_BC" = true ]; then
            duration=$(echo "$end_time - $start_time" | bc)
            throughput=$(echo "scale=2; $BACKFILL_LIMIT / $duration" | bc 2>/dev/null || echo "N/A")
        else
            duration=$(awk "BEGIN {printf \"%.2f\", $end_time - $start_time}")
            throughput=$(awk "BEGIN {printf \"%.2f\", $BACKFILL_LIMIT / ($end_time - $start_time)}" 2>/dev/null || echo "N/A")
        fi

        print_success "Rust Backfill Complete"
        echo "  Duration: ${duration}s"
        echo "  Transactions: $BACKFILL_LIMIT"
        echo "  Throughput: ${throughput} tx/s"

        # Save results
        RUST_BACKFILL_DURATION=$duration
        RUST_BACKFILL_THROUGHPUT=$throughput
    else
        print_error "Rust backfill did not complete within ${max_wait}s timeout"
        RUST_BACKFILL_DURATION="timeout"
        RUST_BACKFILL_THROUGHPUT="N/A"
    fi
}

benchmark_backfill_nestjs() {
    print_subheader "Benchmarking NestJS Backend - Backfill"

    cd "$NESTJS_DIR"

    # Clean any existing process
    kill_server_on_port $NESTJS_PORT

    # Set environment
    export PORT=$NESTJS_PORT

    print_info "Starting NestJS backend for backfill benchmark (limit: $BACKFILL_LIMIT)"

    # Build if needed
    if [ ! -d "dist" ]; then
        print_info "Building NestJS backend..."
        npm run build
    fi

    # Create log file
    local log_file="$RESULTS_DIR/nestjs_backfill_${TIMESTAMP}.log"
    touch "$log_file"

    # Time the backfill
    local start_time=$(date +%s.%N)

    # Run production build in background
    npm run start:prod 2>&1 | tee "$log_file" &
    local nestjs_pid=$!

    print_info "Waiting for NestJS backfill to complete (monitoring logs)..."
    print_info "NestJS PID: $nestjs_pid"

    # Wait for backfill completion by monitoring logs
    # NestJS logs "Backfilled X transactions" when done
    local max_wait=300  # 5 minutes max
    local waited=0
    local backfill_complete=false

    while [ $waited -lt $max_wait ]; do
        # Check if process is still running
        if ! kill -0 $nestjs_pid 2>/dev/null; then
            print_warning "NestJS process exited unexpectedly"
            break
        fi

        # Check for backfill completion message in logs
        if grep -q "Backfilled.*transactions" "$log_file" 2>/dev/null; then
            backfill_complete=true
            print_success "Backfill completion detected in logs"
            break
        fi

        # Also check for "backfill complete" or similar messages
        if grep -qi "backfill.*complete\|finished.*backfill" "$log_file" 2>/dev/null; then
            backfill_complete=true
            print_success "Backfill completion detected in logs"
            break
        fi

        sleep 1
        waited=$((waited + 1))

        # Show progress every 10 seconds
        if [ $((waited % 10)) -eq 0 ]; then
            print_info "Still waiting... ${waited}s elapsed"
            # Show last few log lines
            tail -2 "$log_file" 2>/dev/null | sed 's/^/    /'
        fi
    done

    local end_time=$(date +%s.%N)

    # Kill the NestJS process
    if kill -0 $nestjs_pid 2>/dev/null; then
        print_info "Stopping NestJS backend..."
        kill $nestjs_pid 2>/dev/null || true
        sleep 2
        kill -9 $nestjs_pid 2>/dev/null || true
    fi

    local duration
    local throughput

    if [ "$backfill_complete" = true ]; then
        # Calculate duration and throughput (use awk if bc not available)
        if [ "$HAS_BC" = true ]; then
            duration=$(echo "$end_time - $start_time" | bc)
            throughput=$(echo "scale=2; $BACKFILL_LIMIT / $duration" | bc 2>/dev/null || echo "N/A")
        else
            duration=$(awk "BEGIN {printf \"%.2f\", $end_time - $start_time}")
            throughput=$(awk "BEGIN {printf \"%.2f\", $BACKFILL_LIMIT / ($end_time - $start_time)}" 2>/dev/null || echo "N/A")
        fi

        print_success "NestJS Backfill Complete"
        echo "  Duration: ${duration}s"
        echo "  Transactions: $BACKFILL_LIMIT"
        echo "  Throughput: ${throughput} tx/s"

        # Save results
        NESTJS_BACKFILL_DURATION=$duration
        NESTJS_BACKFILL_THROUGHPUT=$throughput
    else
        print_error "NestJS backfill did not complete within ${max_wait}s timeout"
        NESTJS_BACKFILL_DURATION="timeout"
        NESTJS_BACKFILL_THROUGHPUT="N/A"
    fi
}

benchmark_api_rust() {
    print_subheader "Benchmarking Rust Backend - API Performance"

    cd "$RUST_DIR"

    # Clean and start server
    kill_server_on_port $RUST_PORT
    export PORT=$RUST_PORT

    print_info "Starting Rust backend for API benchmarks..."

    cargo run --release 2>&1 >> "$RESULTS_DIR/rust_api_server_${TIMESTAMP}.log" &
    local rust_pid=$!

    if ! wait_for_server $RUST_PORT "Rust backend"; then
        kill $rust_pid 2>/dev/null || true
        return 1
    fi

    # Warmup
    print_info "Warming up (10 requests)..."
    for i in {1..10}; do
        curl -s "http://localhost:$RUST_PORT/health" > /dev/null
        curl -s "http://localhost:$RUST_PORT/nft/statistics" > /dev/null 2>&1 || true
    done

    # Record initial memory
    local mem_before=$(get_memory_usage $rust_pid)

    # Run load test
    local api_results_file="$RESULTS_DIR/rust_api_${TIMESTAMP}.txt"

    if [ "$HAS_WRK" = true ]; then
        print_info "Running wrk load test (${DURATION}s, ${CONNECTIONS} connections)..."

        # Test /health endpoint
        echo "=== /health endpoint ===" > "$api_results_file"
        wrk -t$THREADS -c$CONNECTIONS -d${DURATION}s \
            "http://localhost:$RUST_PORT/health" >> "$api_results_file" 2>&1

        # Test /nft/statistics endpoint
        echo -e "\n=== /nft/statistics endpoint ===" >> "$api_results_file"
        wrk -t$THREADS -c$CONNECTIONS -d${DURATION}s \
            "http://localhost:$RUST_PORT/nft/statistics" >> "$api_results_file" 2>&1

    elif [ "$HAS_BOMBARDIER" = true ]; then
        print_info "Running bombardier load test (${DURATION}s, ${CONNECTIONS} connections)..."

        echo "=== /health endpoint ===" > "$api_results_file"
        bombardier -c $CONNECTIONS -d ${DURATION}s \
            "http://localhost:$RUST_PORT/health" >> "$api_results_file" 2>&1

        echo -e "\n=== /nft/statistics endpoint ===" >> "$api_results_file"
        bombardier -c $CONNECTIONS -d ${DURATION}s \
            "http://localhost:$RUST_PORT/nft/statistics" >> "$api_results_file" 2>&1
    fi

    # Record final memory and CPU
    local mem_after=$(get_memory_usage $rust_pid)
    local cpu_usage=$(get_cpu_usage $rust_pid)

    # Try to get metrics from /metrics endpoint
    local metrics_output=$(curl -s "http://localhost:$RUST_PORT/metrics" 2>/dev/null || echo "N/A")

    # Cleanup
    kill $rust_pid 2>/dev/null || true

    print_success "Rust API Benchmark Complete"
    echo "  Memory (before): ${mem_before} MB"
    echo "  Memory (after): ${mem_after} MB"
    echo "  CPU Usage: ${cpu_usage}%"
    echo "  Results saved to: $api_results_file"

    # Parse and display key metrics
    if [ -f "$api_results_file" ]; then
        echo ""
        echo "  Key Metrics:"
        grep -E "(Requests/sec|Latency|Transfer/sec)" "$api_results_file" | head -10 | sed 's/^/    /'
    fi

    RUST_MEM_BEFORE=$mem_before
    RUST_MEM_AFTER=$mem_after
    RUST_CPU=$cpu_usage
}

benchmark_api_nestjs() {
    print_subheader "Benchmarking NestJS Backend - API Performance"

    cd "$NESTJS_DIR"

    # Clean and start server
    kill_server_on_port $NESTJS_PORT
    export PORT=$NESTJS_PORT

    print_info "Starting NestJS backend for API benchmarks..."

    # Build if needed
    if [ ! -d "dist" ]; then
        npm run build
    fi

    node dist/main.js 2>&1 >> "$RESULTS_DIR/nestjs_api_server_${TIMESTAMP}.log" &
    local nestjs_pid=$!

    if ! wait_for_server $NESTJS_PORT "NestJS backend"; then
        kill $nestjs_pid 2>/dev/null || true
        return 1
    fi

    # Warmup
    print_info "Warming up (10 requests)..."
    for i in {1..10}; do
        curl -s "http://localhost:$NESTJS_PORT/health" > /dev/null
        curl -s "http://localhost:$NESTJS_PORT/nft/statistics" > /dev/null 2>&1 || true
    done

    # Record initial memory
    local mem_before=$(get_memory_usage $nestjs_pid)

    # Run load test
    local api_results_file="$RESULTS_DIR/nestjs_api_${TIMESTAMP}.txt"

    if [ "$HAS_WRK" = true ]; then
        print_info "Running wrk load test (${DURATION}s, ${CONNECTIONS} connections)..."

        echo "=== /health endpoint ===" > "$api_results_file"
        wrk -t$THREADS -c$CONNECTIONS -d${DURATION}s \
            "http://localhost:$NESTJS_PORT/health" >> "$api_results_file" 2>&1

        echo -e "\n=== /nft/statistics endpoint ===" >> "$api_results_file"
        wrk -t$THREADS -c$CONNECTIONS -d${DURATION}s \
            "http://localhost:$NESTJS_PORT/nft/statistics" >> "$api_results_file" 2>&1

    elif [ "$HAS_BOMBARDIER" = true ]; then
        print_info "Running bombardier load test (${DURATION}s, ${CONNECTIONS} connections)..."

        echo "=== /health endpoint ===" > "$api_results_file"
        bombardier -c $CONNECTIONS -d ${DURATION}s \
            "http://localhost:$NESTJS_PORT/health" >> "$api_results_file" 2>&1

        echo -e "\n=== /nft/statistics endpoint ===" >> "$api_results_file"
        bombardier -c $CONNECTIONS -d ${DURATION}s \
            "http://localhost:$NESTJS_PORT/nft/statistics" >> "$api_results_file" 2>&1
    fi

    # Record final memory and CPU
    local mem_after=$(get_memory_usage $nestjs_pid)
    local cpu_usage=$(get_cpu_usage $nestjs_pid)

    # Cleanup
    kill $nestjs_pid 2>/dev/null || true

    print_success "NestJS API Benchmark Complete"
    echo "  Memory (before): ${mem_before} MB"
    echo "  Memory (after): ${mem_after} MB"
    echo "  CPU Usage: ${cpu_usage}%"
    echo "  Results saved to: $api_results_file"

    # Parse and display key metrics
    if [ -f "$api_results_file" ]; then
        echo ""
        echo "  Key Metrics:"
        grep -E "(Requests/sec|Latency|Transfer/sec)" "$api_results_file" | head -10 | sed 's/^/    /'
    fi

    NESTJS_MEM_BEFORE=$mem_before
    NESTJS_MEM_AFTER=$mem_after
    NESTJS_CPU=$cpu_usage
}

# ============================================================================
# Simple Latency Test (no external tools required)
# ============================================================================

simple_latency_test() {
    local port=$1
    local endpoint=$2
    local name=$3
    local iterations=100

    print_info "Running simple latency test for $name ($iterations requests)..."

    local total_time=0
    local min_time=999999
    local max_time=0
    local success=0

    for i in $(seq 1 $iterations); do
        local start=$(date +%s%N)
        if curl -s -o /dev/null -w "" "http://localhost:$port$endpoint" 2>/dev/null; then
            local end=$(date +%s%N)
            local duration=$(( (end - start) / 1000000 )) # Convert to ms

            total_time=$((total_time + duration))
            success=$((success + 1))

            if [ $duration -lt $min_time ]; then min_time=$duration; fi
            if [ $duration -gt $max_time ]; then max_time=$duration; fi
        fi
    done

    if [ $success -gt 0 ]; then
        local avg_time=$((total_time / success))
        echo "  $name $endpoint:"
        echo "    Avg: ${avg_time}ms, Min: ${min_time}ms, Max: ${max_time}ms"
        echo "    Success: $success/$iterations"
    else
        echo "  $name $endpoint: All requests failed"
    fi
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Backfill Benchmarks
    if [ "$RUN_BACKFILL" = true ]; then
        print_header "Backfill Performance Benchmarks"

        if [ "$RUN_RUST" = true ]; then
            benchmark_backfill_rust || print_warning "Rust backfill benchmark failed"
        fi

        if [ "$RUN_NESTJS" = true ]; then
            benchmark_backfill_nestjs || print_warning "NestJS backfill benchmark failed"
        fi
    fi

    # API Benchmarks
    if [ "$RUN_API" = true ]; then
        print_header "API Performance Benchmarks"

        if [ "$RUN_RUST" = true ]; then
            benchmark_api_rust || print_warning "Rust API benchmark failed"
        fi

        if [ "$RUN_NESTJS" = true ]; then
            benchmark_api_nestjs || print_warning "NestJS API benchmark failed"
        fi
    fi

    # Generate Summary
    print_header "Benchmark Summary"

    echo ""
    echo "┌─────────────────────────────────────────────────────────────────┐"
    echo "│                    PERFORMANCE COMPARISON                       │"
    echo "├─────────────────────────────────────────────────────────────────┤"

    if [ "$RUN_BACKFILL" = true ]; then
        echo "│ BACKFILL PERFORMANCE                                            │"
        echo "├───────────────────┬──────────────────┬────────────────────────┤"
        echo "│ Metric            │ Rust             │ NestJS                 │"
        echo "├───────────────────┼──────────────────┼────────────────────────┤"
        printf "│ Duration          │ %-16s │ %-22s │\n" "${RUST_BACKFILL_DURATION:-N/A}s" "${NESTJS_BACKFILL_DURATION:-N/A}s"
        printf "│ Throughput        │ %-16s │ %-22s │\n" "${RUST_BACKFILL_THROUGHPUT:-N/A} tx/s" "${NESTJS_BACKFILL_THROUGHPUT:-N/A} tx/s"
        echo "├───────────────────┴──────────────────┴────────────────────────┤"
    fi

    if [ "$RUN_API" = true ]; then
        echo "│ RESOURCE USAGE (API Load Test)                                  │"
        echo "├───────────────────┬──────────────────┬────────────────────────┤"
        echo "│ Metric            │ Rust             │ NestJS                 │"
        echo "├───────────────────┼──────────────────┼────────────────────────┤"
        printf "│ Memory (before)   │ %-16s │ %-22s │\n" "${RUST_MEM_BEFORE:-N/A} MB" "${NESTJS_MEM_BEFORE:-N/A} MB"
        printf "│ Memory (after)    │ %-16s │ %-22s │\n" "${RUST_MEM_AFTER:-N/A} MB" "${NESTJS_MEM_AFTER:-N/A} MB"
        printf "│ CPU Usage         │ %-16s │ %-22s │\n" "${RUST_CPU:-N/A}%" "${NESTJS_CPU:-N/A}%"
        echo "├───────────────────┴──────────────────┴────────────────────────┤"
    fi

    echo "│                                                                 │"
    echo "│ Detailed results saved to: $RESULTS_DIR"
    echo "└─────────────────────────────────────────────────────────────────┘"

    # Calculate and display speedup if both ran successfully
    if [ "$RUN_BACKFILL" = true ] && [ "$RUST_BACKFILL_THROUGHPUT" != "N/A" ] && [ "$NESTJS_BACKFILL_THROUGHPUT" != "N/A" ]; then
        local speedup
        if [ "$HAS_BC" = true ]; then
            speedup=$(echo "scale=2; $RUST_BACKFILL_THROUGHPUT / $NESTJS_BACKFILL_THROUGHPUT" | bc 2>/dev/null || echo "N/A")
        else
            speedup=$(awk "BEGIN {printf \"%.2f\", $RUST_BACKFILL_THROUGHPUT / $NESTJS_BACKFILL_THROUGHPUT}" 2>/dev/null || echo "N/A")
        fi
        echo ""
        echo -e "${GREEN}Rust is approximately ${speedup}x faster than NestJS for backfill operations${NC}"
    elif [ "$RUN_BACKFILL" = true ]; then
        echo ""
        if [ "$RUST_BACKFILL_THROUGHPUT" != "N/A" ] && [ "$NESTJS_BACKFILL_THROUGHPUT" = "N/A" ]; then
            echo -e "${YELLOW}Note: Only Rust benchmark completed successfully. NestJS benchmark failed or was skipped.${NC}"
        elif [ "$RUST_BACKFILL_THROUGHPUT" = "N/A" ] && [ "$NESTJS_BACKFILL_THROUGHPUT" != "N/A" ]; then
            echo -e "${YELLOW}Note: Only NestJS benchmark completed successfully. Rust benchmark failed or was skipped.${NC}"
        fi
    fi

    # Save final JSON results
    cat > "$RESULTS_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "config": {
    "backfill_limit": $BACKFILL_LIMIT,
    "api_duration_seconds": $DURATION,
    "api_connections": $CONNECTIONS,
    "api_threads": $THREADS
  },
  "results": {
    "rust": {
      "backfill": {
        "duration_seconds": "${RUST_BACKFILL_DURATION}",
        "throughput_tx_per_second": "${RUST_BACKFILL_THROUGHPUT}"
      },
      "api": {
        "memory_before_mb": "${RUST_MEM_BEFORE}",
        "memory_after_mb": "${RUST_MEM_AFTER}",
        "cpu_percent": "${RUST_CPU}"
      }
    },
    "nestjs": {
      "backfill": {
        "duration_seconds": "${NESTJS_BACKFILL_DURATION}",
        "throughput_tx_per_second": "${NESTJS_BACKFILL_THROUGHPUT}"
      },
      "api": {
        "memory_before_mb": "${NESTJS_MEM_BEFORE}",
        "memory_after_mb": "${NESTJS_MEM_AFTER}",
        "cpu_percent": "${NESTJS_CPU}"
      }
    }
  }
}
EOF

    print_success "Benchmark complete! Results saved to $RESULTS_FILE"
}

# Run main function
main
