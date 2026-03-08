#!/bin/bash
# Script to copy the latest Smart Contract ABI to the Backend and Frontend

# 1. Update Backend
echo "Updating Backend ABI..."
node -e "const fs = require('fs'); const data = JSON.parse(fs.readFileSync('smart-contracts/out/FundingPlatform.sol/FundingPlatform.json', 'utf8')); fs.writeFileSync('backend/listener-service/config/FundingPlatform.abi.json', JSON.stringify(data.abi, null, 2));"
echo "Backend ABI updated at backend/listener-service/config/FundingPlatform.abi.json"

echo "Done!"
