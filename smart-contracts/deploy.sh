#!/bin/bash
source .env

forge script ./script/FundingPlatform.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast
