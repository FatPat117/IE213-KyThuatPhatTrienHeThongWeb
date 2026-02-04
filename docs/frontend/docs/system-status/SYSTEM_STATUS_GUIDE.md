# System Status & Network Monitoring Guide

## Overview

The system status handler provides a global, centralized way to manage and display system notifications in your dApp, including:

- **Wallet Connection Status**: Warns users when wallet is not connected
- **Network Detection**: Alerts users if they're on the wrong network
- **RPC Errors**: Handles blockchain RPC failures gracefully
- **Gas Issues**: Warns about insufficient gas for transactions

## Architecture

### Components

1. **StatusContext** (`app/context/StatusContext.tsx`)
    - Manages global status state
    - Provides methods to set/clear status messages
    - Stores all status message information

2. **StatusProvider** (`app/context/StatusContext.tsx`)
    - React context provider
    - Wraps the application in `app/layout.tsx`

3. **SystemStatusDisplay** (`app/components/SystemStatusDisplay.tsx`)
    - Renders status messages as top banner
    - Auto-selects styling based on status type
    - Supports dismissible alerts

4. **NetworkStatusMonitor** (`app/providers/NetworkStatusMonitor.tsx`)
    - Automatically detects wallet connection changes
    - Automatically detects network changes
    - Updates status display in real-time

5. **useSystemStatus Hook** (`app/hooks/useSystemStatus.ts`)
    - Access status context from any component
    - Call methods to trigger status messages

6. **useRpcErrorHandler Hook** (`app/hooks/useRpcErrorHandler.ts`)
    - Parse and handle RPC errors
    - Show appropriate error messages

## Usage

### Basic Usage in Components

```tsx
"use client";

import { useSystemStatus } from "@/app/hooks/useSystemStatus";

export function MyComponent() {
    const { showSuccess, showRpcError, showInsufficientGas } =
        useSystemStatus();

    const handleTransaction = async () => {
        try {
            // Do transaction
            showSuccess("Transaction completed!");
        } catch (error) {
            if (error instanceof Error) {
                showRpcError(error.message);
            }
        }
    };

    return <button onClick={handleTransaction}>Send Transaction</button>;
}
```

### Using RPC Error Handler

```tsx
"use client";

import { useRpcErrorHandler } from "@/app/hooks/useRpcErrorHandler";

export function MyComponent() {
    const { handleError } = useRpcErrorHandler();

    const handleTransaction = async () => {
        try {
            // Do transaction
        } catch (error) {
            handleError(error); // Automatically detects error type and shows appropriate message
        }
    };

    return null;
}
```

### Status Types

The following status types are automatically handled:

#### 1. Wallet Disconnected

```tsx
const { showWalletDisconnected } = useSystemStatus();
showWalletDisconnected();
```

- **UI**: Yellow banner with warning icon
- **Message**: "Please connect your wallet to interact with the dApp."
- **Auto-triggered**: When wallet disconnects

#### 2. Wrong Network

```tsx
const { showWrongNetwork } = useSystemStatus();
showWrongNetwork("Mainnet", "Sepolia");
```

- **UI**: Red banner with alert icon
- **Message**: Shows current and required network
- **Auto-triggered**: When connected to wrong network

#### 3. RPC Error

```tsx
const { showRpcError } = useSystemStatus();
showRpcError("Failed to connect to RPC endpoint");
```

- **UI**: Orange banner with network icon
- **Message**: RPC error details
- **When to use**: Blockchain call failures, connection issues

#### 4. Insufficient Gas

```tsx
const { showInsufficientGas } = useSystemStatus();
showInsufficientGas("0.05 ETH");
```

- **UI**: Amber banner with warning icon
- **Message**: Required gas amount
- **When to use**: Transaction would fail due to low balance

#### 5. Success

```tsx
const { showSuccess } = useSystemStatus();
showSuccess("Campaign created successfully!");
```

- **UI**: Green banner with checkmark
- **Message**: Success message
- **Auto-dismisses**: After 3 seconds

### Advanced: Custom Status with Actions

```tsx
const { setStatus } = useSystemStatus();

setStatus({
    type: "wrong-network",
    title: "Wrong Network",
    message: "Please switch to Sepolia testnet.",
    action: {
        label: "Switch Network",
        onClick: () => {
            // Trigger wallet to switch network
        },
    },
    dismissible: true,
});
```

## Implementation Examples

### Example 1: Create Campaign Page

```tsx
"use client";

import { useCreateCampaign } from "@/app/hooks/useContract";
import { useRpcErrorHandler } from "@/app/hooks/useRpcErrorHandler";
import { useSystemStatus } from "@/app/hooks/useSystemStatus";

export default function CreateCampaignPage() {
    const { createCampaign, isPending, error } = useCreateCampaign();
    const { handleError } = useRpcErrorHandler();
    const { showSuccess } = useSystemStatus();

    const handleSubmit = async (formData: any) => {
        try {
            await createCampaign(
                formData.title,
                formData.description,
                formData.goalEth,
                formData.deadline,
            );
            showSuccess("Campaign created successfully!");
        } catch (error) {
            handleError(error);
        }
    };

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(new FormData(e.currentTarget));
            }}
        >
            {/* Form fields */}
            <button type="submit" disabled={isPending}>
                Create Campaign
            </button>
        </form>
    );
}
```

### Example 2: Donation Component

```tsx
"use client";

import { useDonateToCampaign } from "@/app/hooks/useContract";
import { useSystemStatus } from "@/app/hooks/useSystemStatus";

export function DonationForm({ campaignId }: { campaignId: number }) {
    const { donate, isPending, error } = useDonateToCampaign();
    const { showSuccess, showInsufficientGas } = useSystemStatus();

    const handleDonate = async (amount: string) => {
        try {
            if (error?.message.includes("insufficient")) {
                showInsufficientGas(amount);
                return;
            }

            await donate(campaignId, amount);
            showSuccess(`Successfully donated ${amount} ETH!`);
        } catch (err) {
            if (err instanceof Error) {
                if (err.message.includes("insufficient")) {
                    showInsufficientGas();
                }
            }
        }
    };

    return (
        <input
            type="number"
            placeholder="Amount in ETH"
            onChange={(e) => handleDonate(e.target.value)}
        />
    );
}
```

## Network Configuration

### Supported Network

The dApp is currently configured for **Sepolia Testnet**:

- **Chain ID**: 11155111
- **Name**: Sepolia
- **Network**: Ethereum testnet
- **Explorer**: https://sepolia.etherscan.io

To change the network, modify `app/providers/NetworkStatusMonitor.tsx`:

```tsx
const REQUIRED_NETWORK: NetworkConfig = {
    chainId: 11155111, // Change this
    name: "Sepolia", // And this
};
```

## Error Message Guidelines

### When to Show Each Error Type

| Error Type          | Trigger Condition              | User Action               |
| ------------------- | ------------------------------ | ------------------------- |
| Wallet Disconnected | `!isConnected`                 | Connect wallet via button |
| Wrong Network       | `chain.id !== expectedChainId` | Switch network in wallet  |
| RPC Error           | Network/blockchain call fails  | Retry or check connection |
| Insufficient Gas    | Not enough ETH for gas         | Add funds to wallet       |

### Common Error Messages

```tsx
// Network switch needed
showWrongNetwork("Ethereum Mainnet", "Sepolia Testnet");

// No test ETH
showInsufficientGas("0.05 ETH for gas");

// Connection issue
showRpcError("Failed to connect to Ethereum RPC endpoint");

// Success confirmation
showSuccess("Transaction confirmed: 0x1234...");
```

## Styling

The banner automatically selects colors based on status type:

- **Wallet Disconnected**: Yellow background (`bg-yellow-50`)
- **Wrong Network**: Red background (`bg-red-50`)
- **RPC Error**: Orange background (`bg-orange-50`)
- **Insufficient Gas**: Amber background (`bg-amber-50`)
- **Success**: Green background (`bg-green-50`)

All banners include:

- Icon that matches the status type
- Title (optional)
- Message text
- Dismiss button (if `dismissible: true`)
- Action button (if `action` provided)

## Troubleshooting

### Hook Error: "useSystemStatus must be used within a StatusProvider"

**Cause**: Component using `useSystemStatus` is not wrapped by `StatusProvider`.

**Fix**: Make sure `StatusProvider` wraps the entire app in `app/layout.tsx`:

```tsx
<WagmiProviderWrapper>
    <StatusProvider>{children}</StatusProvider>
</WagmiProviderWrapper>
```

### Status Not Showing

**Cause 1**: Component not wrapped by `StatusProvider`
**Cause 2**: `SystemStatusDisplay` not in layout

**Fix**: Check both the provider wrapper and that `SystemStatusDisplay` is rendered in `layout.tsx`.

### Wrong Network Not Detected

**Cause**: `NetworkStatusMonitor` not mounted or not watching chain changes

**Fix**: Ensure `NetworkStatusMonitor` is rendered in layout and `useAccount` hook is properly set up.

## Best Practices

1. **Always check wallet connection** before sensitive operations
2. **Use error handler** for try-catch blocks
3. **Show success messages** after important transactions
4. **Keep messages concise** - users should understand at a glance
5. **Auto-dismiss success** alerts after a few seconds
6. **Keep error alerts visible** until user dismisses
7. **Use proper status types** - don't overuse generic messages

## Related Files

- Layout integration: [app/layout.tsx](app/layout.tsx)
- Context definition: [app/context/StatusContext.tsx](app/context/StatusContext.tsx)
- Display component: [app/components/SystemStatusDisplay.tsx](app/components/SystemStatusDisplay.tsx)
- Network monitoring: [app/providers/NetworkStatusMonitor.tsx](app/providers/NetworkStatusMonitor.tsx)
- Hooks: [app/hooks/useSystemStatus.ts](app/hooks/useSystemStatus.ts), [app/hooks/useRpcErrorHandler.ts](app/hooks/useRpcErrorHandler.ts)
