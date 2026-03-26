#!/bin/bash
source .env

# 1. Deploy
forge script script/FundingPlatform.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  -vvv

# 2. Lấy địa chỉ contract từ broadcast artifact mới nhất
CONTRACT_ADDRESS=$(cat broadcast/FundingPlatform.s.sol/11155111/run-latest.json \
  | python3 -c "import json,sys; data=json.load(sys.stdin); print(data['transactions'][0]['contractAddress'])")

echo ""
echo "Contract deployed at: $CONTRACT_ADDRESS"
echo "Explorer: https://sepolia.etherscan.io/address/$CONTRACT_ADDRESS"

# 3. Verify lên Etherscan (chỉ chạy nếu có ETHERSCAN_API_KEY trong .env)
if [ -n "$ETHERSCAN_API_KEY" ]; then
  echo ""
  echo "📋 Verifying on Etherscan..."
  forge verify-contract $CONTRACT_ADDRESS \
    src/FundingPlatform.sol:FundingPlatform \
    --chain sepolia \
    --etherscan-api-key $ETHERSCAN_API_KEY \
    --watch
  echo "Verified!"
else
  echo "ETHERSCAN_API_KEY not set — skipping verification"
fi

# 4. Export ABI ra thư mục shared để backend/frontend dùng
mkdir -p shared/abi
cat out/FundingPlatform.sol/FundingPlatform.json \
  | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['abi'], indent=2))" \
  > shared/abi/FundingPlatform.abi.json
echo "ABI exported to shared/abi/FundingPlatform.abi.json"

# 5. Ghi deployment log
mkdir -p deployments
cat > deployments/sepolia-latest.json << EOF
{
  "contract": "FundingPlatform",
  "network": "sepolia",
  "address": "$CONTRACT_ADDRESS",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "explorer": "https://sepolia.etherscan.io/address/$CONTRACT_ADDRESS"
}
EOF
echo "Deployment log saved to deployments/sepolia-latest.json"

# 6. Ghi địa chỉ vào .env để backend đọc
if grep -q "^FUNDING_PLATFORM_ADDRESS=" .env; then
  sed -i "s|^FUNDING_PLATFORM_ADDRESS=.*|FUNDING_PLATFORM_ADDRESS=$CONTRACT_ADDRESS|" .env
else
  echo "" >> .env
  echo "FUNDING_PLATFORM_ADDRESS=$CONTRACT_ADDRESS" >> .env
fi
echo ".env updated: FUNDING_PLATFORM_ADDRESS=$CONTRACT_ADDRESS"

echo ""
echo "=============================================="
echo "Done!"
echo "   Contract : $CONTRACT_ADDRESS"
echo "   ABI      : shared/abi/FundingPlatform.abi.json"
echo "   Log      : deployments/sepolia-latest.json"
echo "=============================================="
