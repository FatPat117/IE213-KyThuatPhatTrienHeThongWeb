# System Status - Quick Reference

## Installation ✅ (Already integrated)

The system is wrapped in `app/layout.tsx`:

```tsx
<WagmiProviderWrapper>
    <StatusProvider>
        <SystemStatusDisplay />
        <NetworkStatusMonitor />
        {children}
    </StatusProvider>
</WagmiProviderWrapper>
```

## Quick Start (3 lines)

```tsx
import { useSystemStatus } from "@/app/hooks/useSystemStatus";

const { showSuccess, showRpcError } = useSystemStatus();
showSuccess("Done!"); // Show success
showRpcError("Network error"); // Show error
```

## Status Types

| Method                     | Color     | When to Use          |
| -------------------------- | --------- | -------------------- |
| `showWalletDisconnected()` | 🟨 Yellow | Wallet not connected |
| `showWrongNetwork()`       | 🟥 Red    | Wrong testnet        |
| `showRpcError()`           | 🟧 Orange | Network/RPC error    |
| `showInsufficientGas()`    | 🟨 Amber  | Not enough ETH       |
| `showSuccess()`            | 🟩 Green  | Success message      |
| `clearStatus()`            | -         | Remove alert         |

## Auto-Monitored (No code needed)

✅ Wallet connection status
✅ Network detection (Sepolia)
✅ Auto-shows appropriate banners

## Common Patterns

### Pattern 1: Transaction with Error Handling

```tsx
const { showSuccess } = useSystemStatus();
const { handleError } = useRpcErrorHandler();

try {
    await transaction();
    showSuccess("Complete!");
} catch (error) {
    handleError(error); // Auto-detects error type
}
```

### Pattern 2: With Try-Catch

```tsx
const { showRpcError, showSuccess } = useSystemStatus();

try {
    await doSomething();
    showSuccess("Done");
} catch (err) {
    showRpcError(String(err));
}
```

### Pattern 3: Conditional Check

```tsx
const { address, isConnected } = useAccount();
const { showWalletDisconnected } = useSystemStatus();

if (!isConnected) {
    showWalletDisconnected();
    return null;
}
```

## Error Detection (useRpcErrorHandler)

Automatically detects and shows:

- **Insufficient gas** → Shows gas warning
- **Network error** → Shows RPC error
- **Other errors** → Shows error message

```tsx
const { handleError } = useRpcErrorHandler();
catch(err) { handleError(err); } // Auto-categorizes
```

## Available Hooks

```tsx
// Main hook - all methods
useSystemStatus();

// Check if any status is active
useHasStatus(); // Returns boolean

// Get current status type
useStatusType(); // Returns 'wallet-disconnected' | 'wrong-network' | etc

// Auto-error categorization
useRpcErrorHandler();
```

## Styling

All banners are:

- 🎨 Color-coded by type
- 📱 Responsive (mobile-friendly)
- ♿ Accessible (ARIA labels)
- ✨ Animated (smooth transitions)
- ❌ Dismissible (user control)
- 🔄 Auto-dismiss success (3 seconds)

## Status Object (Advanced)

```tsx
const { setStatus } = useSystemStatus();

setStatus({
    type: "wrong-network", // Required
    title: "Network Error", // Optional
    message: "Please switch network", // Required
    action: {
        // Optional
        label: "Switch",
        onClick: () => {
            /* ... */
        },
    },
    dismissible: true, // Optional (default: true)
});
```

## Network Configuration

**Current**: Sepolia (Chain ID: 11155111)

To change, edit `app/providers/NetworkStatusMonitor.tsx`:

```tsx
const REQUIRED_NETWORK = {
    chainId: 11155111, // ← Change here
    name: "Sepolia", // ← And here
};
```

## Common Use Cases

### After Creating Campaign

```tsx
showSuccess("Campaign created! Redirecting...");
// Then redirect
```

### When Donation Fails

```tsx
if (error) {
    handleError(error); // Shows appropriate message
}
```

### Check Before Transaction

```tsx
if (!isConnected) {
    showWalletDisconnected();
    return;
}
if (chain?.id !== 11155111) {
    showWrongNetwork(chain?.name, "Sepolia");
    return;
}
// Safe to proceed
```

### For Manual Testing

```tsx
// In any component, test status displays:
const { showWalletDisconnected, showWrongNetwork, showRpcError, showInsufficientGas, showSuccess } = useSystemStatus();

// Click button to test each
<button onClick={() => showWalletDisconnected()}>Test Wallet Alert</button>
<button onClick={() => showWrongNetwork('Mainnet')}>Test Network Alert</button>
<button onClick={() => showRpcError('Connection failed')}>Test RPC Alert</button>
<button onClick={() => showInsufficientGas('0.5 ETH')}>Test Gas Alert</button>
<button onClick={() => showSuccess('Perfect!')}>Test Success</button>
```

## Files Reference

| File                 | Import From                            | Use For                            |
| -------------------- | -------------------------------------- | ---------------------------------- |
| StatusContext        | `@/app/context/StatusContext`          | Types only (context auto-provided) |
| useSystemStatus      | `@/app/hooks/useSystemStatus`          | Main hook in components            |
| useRpcErrorHandler   | `@/app/hooks/useRpcErrorHandler`       | Auto error detection               |
| SystemStatusDisplay  | `@/app/components/SystemStatusDisplay` | UI (already in layout)             |
| NetworkStatusMonitor | `@/app/providers/NetworkStatusMonitor` | Monitoring (already in layout)     |

## Error Messages

```tsx
// Standard error messages (recommended)
showWalletDisconnected();
// → "Please connect your wallet to interact with the dApp."

showWrongNetwork("Mainnet", "Sepolia");
// → "You are on Mainnet. Please switch to Sepolia testnet."

showRpcError("Connection timeout");
// → "An RPC error occurred: Connection timeout"

showInsufficientGas("0.05 ETH");
// → "You need at least 0.05 ETH for this transaction..."

showSuccess("Campaign created successfully!");
// → Success alert auto-dismisses after 3 seconds
```

## Troubleshooting

**Status not showing?**
→ Check: Is `StatusProvider` in layout.tsx?
→ Check: Is `SystemStatusDisplay` rendered?
→ Check: Is component inside `StatusProvider`?

**Wrong network not detected?**
→ Check: Is `NetworkStatusMonitor` in layout?
→ Check: Is `useAccount()` hook set up?
→ Check: Chain ID correct (11155111 for Sepolia)?

**Error: "useSystemStatus must be used within a StatusProvider"**
→ Component not wrapped by StatusProvider
→ Add `'use client'` directive to component
→ Verify StatusProvider wraps component tree

---

**Status System Ready! ✅**
All files created and integrated. Ready to use in any component.
