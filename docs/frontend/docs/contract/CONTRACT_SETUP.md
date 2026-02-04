# Smart Contract Reading - Setup & Troubleshooting Guide

## 🚀 Quick Start

### Step 1: Deploy Contract to Sepolia

```bash
# In smart_contracts directory
npx hardhat run scripts/deploy.js --network sepolia
```

Output will show:

```
Deploying FundRaising...
FundRaising deployed to: 0x1234567890123456789012345678901234567890
```

### Step 2: Update Contract Address

Edit **[app/config/contractConfig.ts](app/config/contractConfig.ts)**:

```typescript
// Change this:
export const CROWDFUNDING_CONTRACT_ADDRESS: Address =
    "0x0000000000000000000000000000000000000000";

// To your contract address:
export const CROWDFUNDING_CONTRACT_ADDRESS: Address =
    "0x1234567890123456789012345678901234567890";
```

### Step 3: Update Contract ABI

Replace the `CROWDFUNDING_ABI` in the same file with your contract ABI:

```typescript
// Option 1: From Hardhat artifacts
// Copy from: smart_contracts/artifacts/contracts/FundRaising.json

// Option 2: From Etherscan
// 1. Go to https://sepolia.etherscan.io
// 2. Search your contract address
// 3. Click "Contract" tab
// 4. Copy ABI from Code section

export const CROWDFUNDING_ABI = [
    // Paste your ABI here
];
```

### Step 4: Test the Connection

```bash
# Start dev server
npm run dev

# Open http://localhost:3000
# Connect wallet
# Should see campaign statistics and list
```

---

## 🔧 Getting Your Contract ABI

### From Hardhat Project

```bash
# After deploying with Hardhat
cat artifacts/contracts/FundRaising.json | jq '.abi'
```

Or in Python:

```python
import json
with open('artifacts/contracts/FundRaising.json') as f:
    abi = json.load(f)['abi']
    print(json.dumps(abi, indent=2))
```

### From Etherscan

1. Go to **https://sepolia.etherscan.io**
2. Paste your contract address
3. Go to **Contract** tab
4. Click **Code** section
5. Scroll to **Contract ABI**
6. Copy the entire JSON array

### ABI Structure

```typescript
const ABI = [
    {
        name: "campaignCount",
        type: "function",
        stateMutability: "view", // read-only
        inputs: [],
        outputs: [{ type: "uint256" }],
    },
    // ... more functions
];
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: "Could not find contractConfig"

**Error Message:**

```
Module not found: Can't resolve '@/app/config/contractConfig'
```

**Solutions:**

- [ ] File exists at `app/config/contractConfig.ts`
- [ ] Check filename spelling (case-sensitive on Linux)
- [ ] Restart dev server: `npm run dev`
- [ ] Clear `.next` folder: `rm -rf .next`

---

### Issue 2: "No data displayed, no errors"

**Symptoms:**

- App loads
- Wallet connects
- But stats show as empty

**Causes & Solutions:**

1. **Contract address not set**

    ```typescript
    // Check this in contractConfig.ts
    if (
        CROWDFUNDING_CONTRACT_ADDRESS ===
        "0x0000000000000000000000000000000000000000"
    ) {
        console.error("❌ Contract address not configured!");
    }
    ```

2. **Wrong contract address**
    - Verify on Etherscan: https://sepolia.etherscan.io
    - Check if address is checksum correct

3. **Wrong network**
    - MetaMask should show "Sepolia" in top-right
    - App won't read from mainnet

4. **Contract not deployed yet**
    - Run: `npx hardhat run scripts/deploy.js --network sepolia`
    - Confirm in Etherscan

---

### Issue 3: RPC Error Messages

**Error: "Reverted"**

```
Call failed: reverted
```

**Cause:** Function doesn't exist or wrong parameters
**Solution:** Verify function names match ABI exactly

**Error: "Invalid opcode"**

```
Call failed: invalid opcode
```

**Cause:** Function not implemented in contract
**Solution:** Check contract code has implementations

**Error: "Timeout"**

```
Error: Timeout waiting for RPC
```

**Cause:** RPC endpoint slow or down
**Solution:**

- Check Alchemy status
- Try different RPC endpoint
- Wait a few minutes

---

### Issue 4: ABI Mismatch

**Error: "Unknown function"**

```
Error: Function getCampaign not found
```

**Solution:**

```typescript
// Check your contract has these functions:
// 1. campaignCount() → uint256
// 2. totalRaised() → uint256
// 3. getCampaign(uint256) → Campaign
// 4. getAllCampaigns() → Campaign[]

// If missing, update ABI or contract code
```

---

### Issue 5: Loading Never Completes

**Symptoms:**

- Spinner keeps spinning
- Data never loads
- No error messages

**Debugging Steps:**

```typescript
// Add logging to ContractReadComponent.tsx
function ContractStatsDisplay() {
    const stats = useContractStats();

    console.log("Stats:", {
        campaignCount: stats.campaignCount,
        totalRaised: stats.totalRaised,
        isLoading: stats.isLoading,
        isError: stats.isError,
        errors: stats.errors,
    });

    // ... rest of component
}
```

**Common Causes:**

- [ ] `enabled: false` in query config
- [ ] Wrong contract address format
- [ ] Network mismatch
- [ ] RPC endpoint not responding
- [ ] Browser cache issue

**Solution:**

```bash
# Clear cache and rebuild
rm -rf .next node_modules/.cache
npm run dev
```

---

### Issue 6: Gas Price Errors

**Error: "ERC20: insufficient allowance"**

- This is for write operations, not reads
- Reads never fail for gas reasons

**Error: "Execution reverted: insufficient balance"**

- This is for transactions, not reads
- Reads are free and don't require ETH

---

## 🔍 Debugging Checklist

### Before Reporting Issues

- [ ] Run: `npm install` (update dependencies)
- [ ] Verify contract address is set
- [ ] Contract deployed to Sepolia
- [ ] Wallet connected to Sepolia
- [ ] Check browser console for errors
- [ ] Inspect Network tab for RPC calls
- [ ] Try in incognito window (clear cache)
- [ ] Restart dev server
- [ ] Check contract ABI is valid JSON

### Debug Commands

```bash
# Check Node version
node --version
# Should be 18+

# Check npm version
npm --version
# Should be 9+

# Verify dependencies
npm list wagmi viem @tanstack/react-query

# Clear everything and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## 📋 Verification Checklist

### Contract Setup

- [ ] Contract deployed to Sepolia testnet
- [ ] Contract verified on Etherscan (optional but helpful)
- [ ] Contract has `campaignCount()` function
- [ ] Contract has `totalRaised()` function
- [ ] Contract has `getCampaign(uint256)` function
- [ ] Contract has `getAllCampaigns()` function

### Code Configuration

- [ ] Contract address updated in contractConfig.ts
- [ ] Contract ABI updated with actual contract ABI
- [ ] ABI is valid JSON (no syntax errors)
- [ ] Function names match contract exactly
- [ ] Return types match ABI specification

### App Setup

- [ ] `npm install` completed successfully
- [ ] `npm run dev` running without errors
- [ ] No console errors in browser DevTools
- [ ] WalletConnectButton component visible
- [ ] Can connect MetaMask wallet
- [ ] Wallet shows Sepolia network

### Functionality

- [ ] Campaign count displays after wallet connect
- [ ] Total ETH raised displays
- [ ] Campaign list shows (if data exists)
- [ ] Loading spinner appears briefly
- [ ] Refresh button works
- [ ] No frozen UI or hanging state

---

## 🧪 Testing Contract Reading

### Test 1: Verify Contract Exists

```bash
# Open browser console and run:
fetch('https://eth-sepolia.g.alchemy.com/v2/demo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_code',
    params: ['0x1234567890123456789012345678901234567890', 'latest']
  })
}).then(r => r.json()).then(console.log);

// Should show code, not 0x0000...
```

### Test 2: Direct RPC Call

```bash
# Test if contract function works
curl -X POST https://eth-sepolia.g.alchemy.com/v2/demo \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"0x1234567890123456789012345678901234567890",
      "data":"0x05eb8fd6"
    },"latest"],
    "id":1
  }'

# Should return hex encoded result
```

### Test 3: React Component Test

```typescript
// In a test component
import { useContractStats } from '@/app/hooks/useContract';

export function TestComponent() {
  const stats = useContractStats();

  return (
    <div>
      <p>Count: {stats.campaignCount}</p>
      <p>Raised: {stats.totalRaised}</p>
      <p>Loading: {stats.isLoading ? 'Yes' : 'No'}</p>
      <p>Error: {stats.errors.join(', ') || 'None'}</p>
      <button onClick={() => stats.refetch()}>Test Refetch</button>
    </div>
  );
}
```

---

## 🔐 Security Considerations

✅ **Safe Operations:**

- Reading contract data
- Getting balances
- Reading state variables

❌ **Not Implemented Yet:**

- Writing to contract (requires transaction)
- Sending ETH (requires transaction)
- Approving tokens (requires transaction)

---

## 📈 Performance Tips

### Optimize RPC Usage

```typescript
// Good: Specific queries
useReadCampaignCount(); // 1 RPC call
useReadTotalRaised(); // 1 RPC call

// Avoid: Fetching all data
useReadAllCampaigns(); // 1 RPC call but large response
```

### Cache Optimization

```typescript
// Short cache for frequently changing data
staleTime: 10000; // 10 seconds

// Long cache for stable data
staleTime: 120000; // 2 minutes

// No cache if real-time needed
staleTime: 0; // Always fresh
```

### Monitor RPC Usage

```bash
# In browser Network tab:
# 1. Filter by "eth_" in DevTools
# 2. Look for eth_call requests
# 3. Check frequency of calls
# 4. Verify caching is working
```

---

## 📞 Getting Help

### Check These First

1. **[CONTRACT_READING.md](CONTRACT_READING.md)** - Full documentation
2. **Browser Console** - Error messages
3. **Network Tab** - RPC requests
4. **Etherscan** - Contract verification

### Minimal Reproduction

If still stuck, create a test:

```typescript
// Test reading directly
async function testContractRead() {
    try {
        const count = await readContract({
            address: CROWDFUNDING_CONTRACT_ADDRESS,
            abi: CROWDFUNDING_ABI,
            functionName: "campaignCount",
        });
        console.log("Count:", count);
    } catch (error) {
        console.error("Error:", error);
    }
}
```

---

## Resources

| Resource           | Link                                         |
| ------------------ | -------------------------------------------- |
| Wagmi Read Hook    | https://wagmi.sh/react/hooks/useContractRead |
| Sepolia Faucet     | https://sepoliafaucet.com                    |
| Etherscan          | https://sepolia.etherscan.io                 |
| Hardhat Docs       | https://hardhat.org/docs                     |
| Viem Contract Docs | https://viem.sh/docs/contract/               |

---

**Last Updated**: February 3, 2026
**Status**: ✅ Complete
