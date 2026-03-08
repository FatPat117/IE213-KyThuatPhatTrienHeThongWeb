#!/bin/sh

# Chờ node Anvil sẵn sàng
echo "Waiting for Anvil to start at $SEPOLIA_RPC_URL..."
while ! cast chain-id --rpc-url $SEPOLIA_RPC_URL > /dev/null 2>&1; do
  sleep 1
done

echo "Anvil is up. Cleaning and deploying contracts..."

# Xóa các bản build cũ để đảm bảo sạch sẽ
forge clean

# Thực hiện deploy bằng forge script
# Cần gán PRIVATE_KEY vì script Deploy.s.sol đọc trực tiếp từ biến này
export PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY

forge script ./script/FundingPlatform.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --priority-gas-price 1 \
  --non-interactive \
  | tee /tmp/deploy_out.txt

# Extract địa chỉ contract từ logs (Assuming FundingPlatform was deployed)
ADDRESS=$(grep -oE "FundingPlatform deployed at: 0x[a-fA-F0-9]{40}" /tmp/deploy_out.txt | head -1 | cut -d: -f2 | tr -d ' ')

if [ -z "$ADDRESS" ]; then
    echo "FAILED to extract contract address!"
    exit 1
fi

echo "CONTRACT_ADDRESS_DEPLOYED=$ADDRESS"

# Lưu vào shared volume để các service khác đọc
mkdir -p /shared
echo "$ADDRESS" > /shared/contract-address.txt

echo "Deployment complete. Contract address: $ADDRESS"
# Giữ container chạy hoặc thoát (thường là thoát để các service khác biết là xong)
exit 0
