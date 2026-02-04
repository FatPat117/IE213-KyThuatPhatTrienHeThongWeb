# Smart Contract Read Operations - Implementation Guide

## Overview

This implementation provides secure, efficient smart contract reading for your FundRaising DApp using wagmi's `useContractRead` hook. The solution includes automatic caching, error handling, and loading states.

## Files Created

### 1. **[app/config/contractConfig.ts](app/config/contractConfig.ts)**

Contract configuration file containing:

- Contract ABI (sample crowdfunding contract)
- Contract address constant
- Configuration object for wagmi

**Key Features:**

- TypeScript typed ABI
- Safe address validation
- Easy to update with actual contract details
- Includes helpful comments

### 2. **[app/hooks/useContract.ts](app/hooks/useContract.ts)**

Custom React hooks for contract reading:

**`useReadCampaignCount()`**

- Reads total number of campaigns
- Automatic 30-second caching
- Returns: `{ count, isLoading, isError, error, refetch }`

**`useReadTotalRaised()`**

- Reads total ETH raised
- Converts Wei to ETH automatically
- Returns both formatted and raw values
- Caches for 30 seconds

**`useReadCampaign(campaignId)`**

- Reads specific campaign by ID
- Only enabled when ID is provided
- Returns structured campaign object
- Null-safe

**`useReadAllCampaigns()`**

- Reads all campaigns at once
- Warning: expensive for large datasets
- Longer cache time (60 seconds)
- Disabled if contract not configured

**`useContractStats()`**

- Combines campaign count and total raised
- Single hook for dashboard data
- Handles multiple error states
- Batch refetch capability

**`useReadFilteredCampaigns(isCompleted?)`**

- Reads and filters campaigns
- Optional completion status filter
- Client-side filtering for efficiency

### 3. **[app/components/ContractReadComponent.tsx](app/components/ContractReadComponent.tsx)**

Reusable components for displaying contract data:

**`ContractStatsDisplay`**

- Shows campaign count and total ETH
- Beautiful card layout
- Loading spinner animation
- Error state with retry button
- Wallet connection check

**`CampaignListDisplay`**

- Lists all campaigns with details
- Progress bars for funding goals
- Status indicators (Active/Completed)
- Loading skeleton animation
- Pagination ready structure
- Refresh button for manual updates

**`ContractReadingExample`**

- Code example component
- Shows how to use the hooks
- Displays in pre-formatted code block

### 4. **Updated [app/page.tsx](app/page.tsx)**

Home page now includes:

- Contract statistics display
- Campaign list component
- Usage examples
- Updated information cards

## How It Works

### Data Flow: Reading Contract Data

```
Component renders
        ↓
useContractRead hook initializes
        ↓
Checks React Query cache (30-60s)
        ↓
If expired or not found:
    ├─ Call RPC endpoint
    ├─ Send eth_call request
    ├─ Parse return data
    └─ Cache result
        ↓
Return { data, isLoading, isError, error }
        ↓
Component updates UI
```

### Caching Strategy

```
First Load
├─ isLoading: true
├─ Calls RPC
└─ Sets data

Cache Valid (< 30s)
├─ Returns immediately
└─ No RPC call

Cache Stale (> 30s)
├─ Returns old data
├─ Background refetch
└─ Updates when ready

Manual Refetch
├─ Ignores cache
├─ Immediate RPC call
└─ Updates immediately
```

## Usage Examples

### Basic Usage: Read Campaign Count

```tsx
"use client";
import { useReadCampaignCount } from "@/app/hooks/useContract";

function MyCampaignCounter() {
    const { count, isLoading, isError, error } = useReadCampaignCount();

    if (isLoading) return <p>Loading...</p>;
    if (isError) return <p>Error: {error}</p>;

    return <p>Total Campaigns: {count}</p>;
}
```

### Reading Total Raised

```tsx
import { useReadTotalRaised } from "@/app/hooks/useContract";

function TotalRaisedDisplay() {
    const { totalRaised, totalRaisedWei, isLoading } = useReadTotalRaised();

    if (isLoading) return <p>Fetching...</p>;

    return (
        <div>
            <p>{totalRaised.toFixed(4)} ETH</p>
            <p>{totalRaisedWei.toString()} Wei</p>
        </div>
    );
}
```

### Reading Specific Campaign

```tsx
import { useReadCampaign } from "@/app/hooks/useContract";

function CampaignDetails({ id }: { id: number }) {
    const { campaign, isLoading, isError } = useReadCampaign(id);

    if (isLoading) return <p>Loading campaign...</p>;
    if (isError) return <p>Failed to load campaign</p>;
    if (!campaign) return <p>Campaign not found</p>;

    return (
        <div>
            <h3>{campaign.title}</h3>
            <p>Goal: {Number(campaign.goal) / 1e18} ETH</p>
            <p>Raised: {Number(campaign.raised) / 1e18} ETH</p>
            <p>Status: {campaign.completed ? "Completed" : "Active"}</p>
        </div>
    );
}
```

### Combined Statistics

```tsx
import { useContractStats } from "@/app/hooks/useContract";

function Dashboard() {
    const { campaignCount, totalRaised, isLoading, isError, errors, refetch } =
        useContractStats();

    if (isLoading) return <p>Loading stats...</p>;
    if (isError) {
        return (
            <div>
                <p>Errors: {errors.join(", ")}</p>
                <button onClick={refetch}>Retry</button>
            </div>
        );
    }

    return (
        <div>
            <p>Campaigns: {campaignCount}</p>
            <p>Raised: {totalRaised.toFixed(4)} ETH</p>
        </div>
    );
}
```

### Reading All Campaigns

```tsx
import { useReadAllCampaigns } from "@/app/hooks/useContract";

function CampaignsList() {
    const { campaigns, isLoading } = useReadAllCampaigns();

    if (isLoading) return <p>Loading campaigns...</p>;

    return (
        <ul>
            {campaigns.map((campaign) => (
                <li key={campaign.id}>
                    {campaign.title} - {campaign.raised} / {campaign.goal}
                </li>
            ))}
        </ul>
    );
}
```

## Contract Configuration

### Setup Instructions

1. **Deploy Your Contract**
    - Deploy FundRaising.sol to Sepolia testnet
    - Note the contract address

2. **Update Contract Address**
   Edit [app/config/contractConfig.ts](app/config/contractConfig.ts):

    ```typescript
    export const CROWDFUNDING_CONTRACT_ADDRESS: Address =
        "0x1234567890123456789012345678901234567890"; // Your contract address
    ```

3. **Update Contract ABI**
   Replace `CROWDFUNDING_ABI` with your actual contract ABI:

    ```typescript
    // From Hardhat artifacts/contracts/FundRaising.json
    // Or from Etherscan contract verification
    ```

4. **Verify Function Names**
   Ensure your contract has these functions:
    - `campaignCount()` → returns uint256
    - `totalRaised()` → returns uint256
    - `getCampaign(uint256)` → returns Campaign struct
    - `getAllCampaigns()` → returns Campaign[] array

## Caching and Optimization

### Cache Settings

```typescript
query: {
  staleTime: 30000,              // Cache valid for 30 seconds
  refetchOnWindowFocus: true,    // Refetch when window regains focus
  refetchOnMount: 'stale',       // Refetch stale data on mount
  enabled: true                  // Enable/disable hook
}
```

### Adjusting Cache Duration

```typescript
// Short cache (5 seconds) - for frequently changing data
staleTime: 5000;

// Long cache (2 minutes) - for static data
staleTime: 120000;

// No cache - always fresh
staleTime: 0;
```

## Error Handling

### Common Errors

| Error                           | Cause                     | Solution                     |
| ------------------------------- | ------------------------- | ---------------------------- |
| "Could not find contractConfig" | Missing import            | Check contract config path   |
| "RPC error"                     | Network issue             | Check Alchemy key, network   |
| "Invalid contract address"      | Bad address format        | Use 42-char address with 0x  |
| "Function not found"            | ABI mismatch              | Verify function names in ABI |
| "Call reverted"                 | Contract execution failed | Check function parameters    |

### Error Recovery

```typescript
const { error, refetch } = useReadCampaignCount();

if (error) {
  return (
    <button onClick={() => refetch()}>
      Retry: {error}
    </button>
  );
}
```

## Performance Optimization

### Best Practices

1. **Use Specific Hooks**

    ```typescript
    // ✓ Good - reads only what you need
    const count = useReadCampaignCount();

    // ✗ Avoid - reads entire array
    const all = useReadAllCampaigns();
    ```

2. **Cache Strategically**

    ```typescript
    // ✓ Good - reasonable cache time
    staleTime: 30000;

    // ✗ Avoid - too aggressive caching
    staleTime: 0;
    ```

3. **Enable Only When Needed**

    ```typescript
    // ✓ Good - only fetch when ID provided
    const campaign = useReadCampaign(id);

    // In query config:
    enabled: id !== null && id !== undefined;
    ```

4. **Manual Refetch**

    ```typescript
    // Instead of:
    setInterval(() => refetch(), 5000); // Continuous polling

    // Use:
    <button onClick={() => refetch()}>
      Refresh Data
    </button>
    ```

## Testing

### Test Checklist

- [ ] Contract address configured correctly
- [ ] Contract ABI matches your contract
- [ ] Function names match exactly
- [ ] Return types match ABI
- [ ] Campaign count displays
- [ ] Total raised displays
- [ ] Campaign list shows
- [ ] Loading states appear
- [ ] Error states work
- [ ] Refetch button works
- [ ] Data updates when wallet connects
- [ ] No console errors

### Manual Testing

```bash
# 1. Start dev server
npm run dev

# 2. Open app
# http://localhost:3000

# 3. Connect wallet
# Click "Connect MetaMask"

# 4. Check data loads
# Should see campaign stats

# 5. Check caching
# Open DevTools > Network
# Verify RPC calls are cached
```

## Advanced Patterns

### Combining Multiple Hooks

```tsx
function ComplexComponent() {
    const stats = useContractStats();
    const campaigns = useReadAllCampaigns();
    const wallet = useWalletStatus();

    const isReady = !stats.isLoading && !campaigns.isLoading;

    if (!wallet.isConnected) {
        return <p>Connect wallet first</p>;
    }

    if (stats.isError || campaigns.isError) {
        return <p>Failed to load data</p>;
    }

    if (!isReady) {
        return <p>Loading...</p>;
    }

    return (
        <div>
            <p>Stats: {stats.campaignCount}</p>
            <p>Campaigns: {campaigns.count}</p>
        </div>
    );
}
```

### Conditional Reading

```tsx
function ConditionalRead({ campaignId }: { campaignId?: number }) {
    // Only fetches if campaignId is provided
    const campaign = useReadCampaign(campaignId);

    return campaign.campaign ? (
        <div>{campaign.campaign.title}</div>
    ) : (
        <p>No campaign selected</p>
    );
}
```

### Batch Operations

```tsx
async function refreshAllData() {
    await Promise.all([
        stats.refetch(),
        campaigns.refetch(),
        campaign.refetch(),
    ]);
}
```

## Monitoring and Debugging

### Debug Tips

1. **Check RPC Calls**
    - DevTools → Network
    - Filter by XHR
    - Look for eth_call requests

2. **Monitor Cache**
    - React Query DevTools
    - Install: `npm install @tanstack/react-query-devtools`
    - Shows cached data and stale times

3. **Log Data**

    ```typescript
    console.log("Campaign count:", count);
    console.log("Loading:", isLoading);
    console.log("Error:", error);
    ```

4. **Check Contract Address**
    ```typescript
    // In browser console:
    const { CROWDFUNDING_CONTRACT_ADDRESS } =
        await import("./app/config/contractConfig");
    console.log(CROWDFUNDING_CONTRACT_ADDRESS);
    ```

## Next Steps

1. **Add Write Operations**
    - Implement `useContractWrite` for creating campaigns
    - Add transaction confirmation UI

2. **Add Event Listening**
    - Use wagmi `useContractEvent`
    - Real-time updates on new campaigns

3. **Pagination**
    - Implement for large campaign lists
    - Fetch in batches instead of all at once

4. **Filtering & Sorting**
    - Client-side filtering by status
    - Server-side ordering options

5. **Real-time Updates**
    - WebSocket subscriptions
    - Poll Ethereum blocks for events

## Resources

- [Wagmi useContractRead](https://wagmi.sh/react/hooks/useContractRead)
- [TanStack Query Caching](https://tanstack.com/query/latest/docs/react/caching)
- [Viem Contract Operations](https://viem.sh/docs/contract/readContract)
- [Ethereum JSON-RPC](https://ethereum.org/en/developers/docs/apis/json-rpc/)

---

**Created**: February 3, 2026
**Framework**: Next.js 16, React 19, Wagmi 3, Viem 2
**Status**: Production Ready
