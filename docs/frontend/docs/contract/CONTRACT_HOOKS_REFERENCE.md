# Contract Reading Hooks - Complete Reference

## Hook Overview

```
useReadCampaignCount()       → Total campaigns
useReadTotalRaised()         → Total ETH raised
useReadCampaign(id)          → Specific campaign
useReadAllCampaigns()        → All campaigns array
useContractStats()           → Combined stats
useReadFilteredCampaigns()   → Filtered campaigns
```

---

## Hook Details

### useReadCampaignCount()

Reads the total number of campaigns from the contract.

**Returns:**

```typescript
{
    count: number; // Campaign count (0, 1, 2, ...)
    isLoading: boolean; // Data is loading
    isError: boolean; // Error occurred
    error: string | null; // Error message
    refetch: () => Promise; // Manual refetch
}
```

**Usage:**

```tsx
function CampaignCounter() {
    const { count, isLoading, isError, error } = useReadCampaignCount();

    if (isLoading) return <p>Counting campaigns...</p>;
    if (isError) return <p>Error: {error}</p>;

    return <p>Total: {count} campaigns</p>;
}
```

**Features:**

- ✓ Auto 30-second cache
- ✓ Refetch on window focus
- ✓ Lightweight single-value read
- ✓ Always enabled

---

### useReadTotalRaised()

Reads total ETH raised across all campaigns. Automatically converts from Wei to ETH.

**Returns:**

```typescript
{
    totalRaised: number; // Formatted as ETH (e.g., 1.5)
    totalRaisedWei: bigint; // Raw Wei value
    isLoading: boolean;
    isError: boolean;
    error: string | null;
    refetch: () => Promise;
}
```

**Usage:**

```tsx
function TotalRaisedDisplay() {
    const { totalRaised, totalRaisedWei } = useReadTotalRaised();

    return (
        <div>
            <p>Raised: {totalRaised.toFixed(4)} ETH</p>
            <p>Wei: {totalRaisedWei.toString()}</p>
        </div>
    );
}
```

**Features:**

- ✓ Automatic Wei to ETH conversion
- ✓ Returns both formatted and raw values
- ✓ 30-second cache
- ✓ Safe number formatting

---

### useReadCampaign(campaignId)

Reads a specific campaign by ID. Only fetches when ID is provided.

**Parameters:**

```typescript
campaignId: number | null | undefined;
```

**Returns:**

```typescript
{
  campaign: {
    id: number;
    title: string;
    creator: string;        // Address: 0x...
    goal: bigint;           // In Wei
    raised: bigint;         // In Wei
    completed: boolean;
  } | null;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => Promise;
}
```

**Usage:**

```tsx
function CampaignDetails({ campaignId }: { campaignId: number }) {
    const { campaign, isLoading, isError } = useReadCampaign(campaignId);

    if (isLoading) return <p>Loading...</p>;
    if (isError) return <p>Not found</p>;
    if (!campaign) return null;

    const progress = (Number(campaign.raised) / Number(campaign.goal)) * 100;

    return (
        <div>
            <h3>{campaign.title}</h3>
            <p>Creator: {campaign.creator}</p>
            <p>Goal: {(Number(campaign.goal) / 1e18).toFixed(2)} ETH</p>
            <p>Raised: {(Number(campaign.raised) / 1e18).toFixed(2)} ETH</p>
            <p>Progress: {progress.toFixed(1)}%</p>
            <p>Status: {campaign.completed ? "✓ Completed" : "● Active"}</p>
        </div>
    );
}
```

**Features:**

- ✓ Only enabled when ID provided
- ✓ Returns null when disabled
- ✓ Structured campaign object
- ✓ Type-safe return value

**Important:**

- Pass `null` or `undefined` to disable fetching
- Returns `null` when `campaign` prop is missing

---

### useReadAllCampaigns()

Reads all campaigns at once. Use with caution for large arrays.

**Returns:**

```typescript
{
  campaigns: Campaign[];    // Array of campaigns
  count: number;            // Length of array
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => Promise;
}
```

**Usage:**

```tsx
function AllCampaigns() {
    const { campaigns, count, isLoading } = useReadAllCampaigns();

    if (isLoading) return <p>Loading all campaigns...</p>;

    return (
        <div>
            <h3>All Campaigns ({count})</h3>
            {campaigns.map((campaign) => (
                <div key={campaign.id}>
                    <h4>{campaign.title}</h4>
                    <p>
                        Raised: {(Number(campaign.raised) / 1e18).toFixed(2)}{" "}
                        ETH
                    </p>
                </div>
            ))}
        </div>
    );
}
```

**Features:**

- ✓ 60-second cache (longer than single reads)
- ✓ Client-side array operations
- ✓ Disabled if address not set
- ✓ Warning: expensive for large datasets

**Performance Notes:**

- Large arrays: consider pagination
- Many campaigns: filter server-side
- Slow connection: increase cache time

---

### useContractStats()

Combines campaign count and total raised into one hook. Perfect for dashboards.

**Returns:**

```typescript
{
  campaignCount: number;       // Total campaigns
  totalRaised: number;         // Total ETH
  totalRaisedWei: bigint;      // Total Wei
  isLoading: boolean;          // Any hook loading
  isError: boolean;            // Any hook errored
  errors: (string | null)[];   // All error messages
  refetch: () => Promise;      // Refetch all
}
```

**Usage:**

```tsx
function Dashboard() {
    const stats = useContractStats();

    if (stats.isLoading) {
        return <div>Loading stats...</div>;
    }

    if (stats.isError) {
        return (
            <div>
                <p>Errors: {stats.errors.join(", ")}</p>
                <button onClick={() => stats.refetch()}>Retry</button>
            </div>
        );
    }

    return (
        <div>
            <div className="stat">
                <p>Campaigns: {stats.campaignCount}</p>
            </div>
            <div className="stat">
                <p>Raised: {stats.totalRaised.toFixed(4)} ETH</p>
            </div>
        </div>
    );
}
```

**Features:**

- ✓ Combines two independent reads
- ✓ Single isLoading/isError state
- ✓ Batch refetch capability
- ✓ Cleaner component code

**Advantages:**

- Reduces hook usage
- Cleaner error handling
- Single loading state
- Synchronized refetch

---

### useReadFilteredCampaigns(isCompleted?)

Filters campaigns by completion status.

**Parameters:**

```typescript
isCompleted?: boolean  // true = completed, false = active, undefined = all
```

**Returns:**

```typescript
{
  campaigns: Campaign[];    // Filtered array
  count: number;            // Count after filter
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => Promise;
}
```

**Usage:**

```tsx
// All campaigns
const all = useReadFilteredCampaigns();

// Active campaigns
const active = useReadFilteredCampaigns(false);

// Completed campaigns
const completed = useReadFilteredCampaigns(true);

function CampaignTabs() {
    const active = useReadFilteredCampaigns(false);
    const completed = useReadFilteredCampaigns(true);

    return (
        <div>
            <div>
                <h3>Active ({active.count})</h3>
                {active.campaigns.map((c) => (
                    <div key={c.id}>{c.title}</div>
                ))}
            </div>

            <div>
                <h3>Completed ({completed.count})</h3>
                {completed.campaigns.map((c) => (
                    <div key={c.id}>{c.title}</div>
                ))}
            </div>
        </div>
    );
}
```

**Features:**

- ✓ Client-side filtering
- ✓ Filters after fetch
- ✓ Updates count automatically
- ✓ Flexible filtering

---

## Helper Function

### calculateCampaignsTotalRaised(campaigns)

Calculates total raised from an array of campaigns.

**Parameters:**

```typescript
campaigns: Campaign[]
```

**Returns:**

```typescript
string; // Formatted ETH (e.g., "2.5")
```

**Usage:**

```tsx
import { calculateCampaignsTotalRaised } from "@/app/hooks/useContract";

function CampaignStats({ campaignIds }: { campaignIds: number[] }) {
    const { campaigns } = useReadAllCampaigns();

    const selected = campaigns.filter((c) => campaignIds.includes(c.id));
    const total = calculateCampaignsTotalRaised(selected);

    return <p>Selected Total: {total} ETH</p>;
}
```

---

## Caching Behavior

### Default Cache Settings

```typescript
// Single value reads (count, total)
staleTime: 30000              // 30 seconds
refetchOnWindowFocus: true    // Refetch when tab regains focus
refetchOnMount: 'stale'       // Refetch if data is stale
enabled: true                 // Always enabled

// Array reads (all campaigns)
staleTime: 60000              // 60 seconds (longer)
refetchOnWindowFocus: false   // Don't refetch on focus
refetchOnMount: 'stale'       // Refetch if stale
enabled: [depends on address] // Only if configured
```

### Cache Timeline

```
0s    - Data fetched from RPC
       - Marked as fresh

30s   - Data becomes stale
       - User refocuses tab
       - Background refetch starts

60s+  - Data marked as inactive
       - Ready for garbage collection
```

### Customize Cache

```typescript
// In your component
const { data } = useContractRead({
    ...contractConfig,
    functionName: "campaignCount",
    query: {
        staleTime: 5000, // 5 seconds
        gcTime: 300000, // 5 minutes (garbage collect)
        refetchInterval: 10000, // Poll every 10 seconds
        refetchOnWindowFocus: true, // Always refetch on focus
    },
});
```

---

## Error Handling Patterns

### Pattern 1: Simple Error Display

```tsx
const { data, isError, error } = useReadCampaignCount();

if (isError) {
    return <div className="error">Error: {error}</div>;
}
```

### Pattern 2: Error with Retry

```tsx
const { data, isError, error, refetch } = useReadCampaignCount();

if (isError) {
    return (
        <div>
            <p>Failed to load: {error}</p>
            <button onClick={() => refetch()}>Try again</button>
        </div>
    );
}
```

### Pattern 3: Multiple Hook Errors

```tsx
const stats = useContractStats();

if (stats.isError) {
    return (
        <div>
            <ul>
                {stats.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                ))}
            </ul>
        </div>
    );
}
```

### Pattern 4: Fallback Values

```tsx
const { totalRaised, isError } = useReadTotalRaised();

const displayValue = isError ? 0 : totalRaised;

return <p>{displayValue.toFixed(4)} ETH</p>;
```

---

## Loading State Patterns

### Pattern 1: Skeleton Loader

```tsx
function CampaignSkeleton() {
    return (
        <div className="animate-pulse">
            <div className="h-4 bg-gray-200 w-full mb-2" />
            <div className="h-4 bg-gray-200 w-3/4" />
        </div>
    );
}

function CampaignList() {
    const { campaigns, isLoading } = useReadAllCampaigns();

    if (isLoading) {
        return <CampaignSkeleton />;
    }

    return /* render campaigns */;
}
```

### Pattern 2: Spinner

```tsx
function CampaignStats() {
    const { campaignCount, isLoading } = useContractStats();

    if (isLoading) {
        return <div className="animate-spin">Loading...</div>;
    }

    return <p>{campaignCount} campaigns</p>;
}
```

### Pattern 3: Disable Button While Loading

```tsx
function RefreshButton() {
    const { refetch, isLoading } = useReadCampaignCount();

    return (
        <button onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
        </button>
    );
}
```

---

## Best Practices

### ✓ Do

```typescript
// Specific reads
useReadCampaignCount();

// Only when needed
const campaign = useReadCampaign(id);

// Type-safe
const { count } = useReadCampaignCount();

// Handle loading
if (isLoading) return <Spinner />;

// Handle errors
if (isError) return <Error />;

// Batch refetch
await Promise.all([ref1(), ref2()]);
```

### ✗ Don't

```typescript
// Unnecessary reads
useReadAllCampaigns(); // When you only need count

// Polling in loops
setInterval(() => refetch(), 1000); // Too frequent

// Ignoring states
data.length; // Might be undefined

// Unnecessary rerenders
useEffect(() => refetch(), [refetch]);

// Missing error handling
const count = data || 0; // Silent failures
```

---

## Type Definitions

```typescript
interface Campaign {
    id: number;
    title: string;
    creator: Address;
    goal: bigint; // Wei
    raised: bigint; // Wei
    completed: boolean;
}

interface CampaignReadResult {
    campaign: Campaign | null;
    isLoading: boolean;
    isError: boolean;
    error: string | null;
    refetch: () => Promise<unknown>;
}

interface StatsResult {
    campaignCount: number;
    totalRaised: number;
    totalRaisedWei: bigint;
    isLoading: boolean;
    isError: boolean;
    errors: (string | null)[];
    refetch: () => Promise<void>;
}
```

---

## Performance Comparison

```
Operation        │ Cost    │ Cache │ Use When
─────────────────┼─────────┼───────┼──────────────────
campaignCount    │ 1 RPC   │ 30s   │ Dashboard
totalRaised      │ 1 RPC   │ 30s   │ Dashboard
getCampaign      │ 1 RPC   │ 30s   │ Detail page
getAllCampaigns  │ 1 RPC   │ 60s   │ List (small)
```

---

**Last Updated**: February 3, 2026
**Framework**: Wagmi 3.4.2, Viem 2.45.1
**Status**: ✅ Complete Reference
