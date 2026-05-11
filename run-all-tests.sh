#!/bin/bash

# run-all-tests.sh
# Script to run all stable tests (Smart Contract, Backend, Frontend Unit)
# Excludes E2E tests as requested.

set -e # Exit on error

ROOT=$(pwd)
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${CYAN}====================================================${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}====================================================${NC}"
}

declare -A RESULTS

# 1. Smart Contract Tests
print_header "1/3 Running Smart Contract Tests (Foundry)"
cd "$ROOT/smart-contracts"
if command -v forge &> /dev/null; then
    forge test && RESULTS["Smart Contracts"]="PASS" || RESULTS["Smart Contracts"]="FAIL"
elif [ -f "$HOME/.foundry/bin/forge" ]; then
    "$HOME/.foundry/bin/forge" test && RESULTS["Smart Contracts"]="PASS" || RESULTS["Smart Contracts"]="FAIL"
else
    echo -e "${RED}Forge not found in PATH or ~/.foundry/bin/${NC}"
    RESULTS["Smart Contracts"]="FAIL"
fi

# 2. Backend Campaign Service Tests
print_header "2/3 Running Backend Campaign Service Tests (Jest)"
cd "$ROOT/backend/campaign-service"
npm run test && RESULTS["Backend (Campaign)"]="PASS" || RESULTS["Backend (Campaign)"]="FAIL"

# 3. Frontend Unit Tests
print_header "3/3 Running Frontend Unit Tests (Vitest/Jest)"
cd "$ROOT/frontend"
npm run test && RESULTS["Frontend (Unit)"]="PASS" || RESULTS["Frontend (Unit)"]="FAIL"

# Final Summary
print_header "TEST SUMMARY"
cd "$ROOT"

ALL_PASSED=true
for key in "Smart Contracts" "Backend (Campaign)" "Frontend (Unit)"; do
    status=${RESULTS[$key]}
    if [ "$status" == "PASS" ]; then
        echo -e "  ${GREEN}[√] $key : $status${NC}"
    else
        echo -e "  ${RED}[X] $key : $status${NC}"
        ALL_PASSED=false
    fi
done

echo -e "\n${YELLOW}E2E Tests were skipped as requested.${NC}"

if [ "$ALL_PASSED" = true ]; then
    echo -e "\n${GREEN}All stable tests passed! Ready to push.${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed. Please check the logs above.${NC}"
    exit 1
fi
