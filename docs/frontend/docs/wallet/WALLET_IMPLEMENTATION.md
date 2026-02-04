# Ethereum Wallet Connection - Implementation Guide

## Overview

This implementation provides Ethereum wallet connection for the FundRaising DApp using **wagmi** and **viem** libraries. The solution enables secure MetaMask wallet connection without storing private keys.

## Files Created

### 1. **[app/config/wagmi.ts](app/config/wagmi.ts)**

Wagmi configuration file that sets up:

- Chain configuration (Sepolia test network)
- Transport configuration for RPC endpoints
- WalletConnect project ID for multi-chain support

**Key Features:**

- Uses public Alchemy RPC endpoints for demo
- Configured for Sepolia test network (11155111)
- Supports MetaMask via injected connector

### 2. **[app/components/WalletConnectButton.tsx](app/components/WalletConnectButton.tsx)**

Main button component for wallet connection with:

- **Connect Button**: Connects MetaMask wallet using injected connector
- **Disconnection**: Safely disconnects wallet
- **Address Display**: Shows shortened wallet address (first 6 + last 4 characters)
- **Network Validation**: Detects if user is on Sepolia network
- **Warning Message**: Displays warning if not on Sepolia

**Hooks Used:**

- `useAccount()` - Get connected wallet address and connection status
- `useConnect()` - Connect wallet with injected MetaMask
- `useDisconnect()` - Disconnect wallet
- `useChainId()` - Get current network chain ID

### 3. **[app/components/WalletStatus.tsx](app/components/WalletStatus.tsx)**

Component displaying wallet information:

- Shortened wallet address with full address visible
- ETH balance fetched from blockchain
- Network status indicator (Sepolia or Wrong Network)
- Grid-based responsive layout

**Features:**

- Uses `useBalance()` hook to fetch wallet balance
- Formats balance to 4 decimal places
- Shows network status with visual indicators (✓ or ✗)

### 4. **[app/providers/WagmiProvider.tsx](app/providers/WagmiProvider.tsx)**

Provider wrapper component that:

- Wraps application with `WagmiProvider`
- Initializes `QueryClientProvider` for data caching
- Must be used at root layout level

**Why Needed:**

- Enables wagmi hooks throughout the app
- Manages wallet state and RPC calls
- Handles async queries with TanStack React Query

### 5. **Updated [app/layout.tsx](app/layout.tsx)**

Root layout updated to:

- Import `WagmiProviderWrapper`
- Wrap all children with the provider
- Update metadata for DApp

### 6. **Updated [app/page.tsx](app/page.tsx)**

Home page redesigned with:

- `'use client'` directive for client-side rendering
- Wallet connection UI
- Wallet status display
- Information card with usage instructions
- Responsive layout with Tailwind CSS

## How It Works

### Connection Flow

```
User clicks "Connect MetaMask"
           ↓
wagmi connects via injected connector
           ↓
MetaMask prompts user to approve connection
           ↓
Wallet address and chain ID retrieved
           ↓
useAccount and useChainId hooks update component
           ↓
UI displays address, balance, and network status
```

### Security Features

✓ **No Private Keys Stored**: Connection is browser-based through MetaMask
✓ **No Password Required**: MetaMask handles authentication
✓ **Network Validation**: Warns if user is on wrong network
✓ **Read-Only Balance**: Only displays account balance, no transaction initiation here

## Dependencies

```json
{
    "viem": "^2.45.1",
    "wagmi": "^3.4.2",
    "@tanstack/react-query": "^5"
}
```

### Install Command

```bash
npm install wagmi viem @tanstack/react-query
```

## Usage

### In Components

```tsx
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";

function MyComponent() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { connect } = useConnect();
    const { disconnect } = useDisconnect();

    // Use in component...
}
```

### Available Hooks

| Hook              | Returns                           | Purpose                                  |
| ----------------- | --------------------------------- | ---------------------------------------- |
| `useAccount()`    | `{ address, isConnected, ... }`   | Get wallet connection status and address |
| `useChainId()`    | `number`                          | Get current network chain ID             |
| `useBalance()`    | `{ data: { formatted, symbol } }` | Fetch wallet balance                     |
| `useConnect()`    | `{ connect, connectors, ... }`    | Connect wallet                           |
| `useDisconnect()` | `{ disconnect }`                  | Disconnect wallet                        |

## Network Configuration

### Sepolia Test Network

- **Chain ID**: 11155111
- **Currency**: SepoliaETH
- **RPC Endpoint**: https://eth-sepolia.g.alchemy.com/v2/demo
- **Faucet**: https://sepoliafaucet.com

### To Add Sepolia to MetaMask

1. Open MetaMask
2. Click network dropdown → Add Network
3. Use https://chainlist.org/ to find Sepolia details
4. Or manually add:
    - Network Name: Sepolia
    - RPC URL: https://eth-sepolia.g.alchemy.com/v2/demo
    - Chain ID: 11155111
    - Currency Symbol: ETH

## Environment Variables (Optional)

For production, create `.env.local`:

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=your_api_key
```

Update wagmi config to use these variables instead of hardcoded values.

## Styling

- **Framework**: Tailwind CSS (already configured)
- **Colors**: Blue/Indigo gradient for primary actions
- **Responsive**: Mobile-first approach with `sm:` breakpoints
- **Status Indicators**: Green (connected), Yellow (warning), Red (error)

## Testing Checklist

- [ ] Install MetaMask extension in browser
- [ ] Visit the app
- [ ] Click "Connect MetaMask"
- [ ] Approve connection in MetaMask popup
- [ ] See wallet address displayed
- [ ] Verify balance is fetched
- [ ] Check if on Sepolia network
- [ ] Click "Disconnect Wallet"
- [ ] Verify UI returns to initial state

## Common Issues & Solutions

**Problem**: "Could not find wagmi config"

- **Solution**: Ensure `WagmiProviderWrapper` is in layout.tsx

**Problem**: "MetaMask not found"

- **Solution**: Install MetaMask extension from https://metamask.io

**Problem**: "Wrong Network" warning

- **Solution**: Switch to Sepolia network in MetaMask dropdown

**Problem**: Balance shows as 0

- **Solution**: Fund wallet with Sepolia testnet ETH from https://sepoliafaucet.com

## Next Steps

To extend this implementation:

1. **Add Transaction Signing**

    ```tsx
    const { signMessage } = useSignMessage();
    ```

2. **Interact with Smart Contracts**

    ```tsx
    const { data } = useContractRead({ address, abi, functionName });
    ```

3. **Send Transactions**

    ```tsx
    const { sendTransaction } = useSendTransaction();
    ```

4. **ENS Resolution**
    ```tsx
    const { data: ensName } = useEnsName({ address });
    ```

## Resources

- **Wagmi Docs**: https://wagmi.sh/
- **Viem Docs**: https://viem.sh/
- **MetaMask RPC Methods**: https://docs.metamask.io/guide/rpc-api.html
- **Sepolia Faucet**: https://sepoliafaucet.com
- **Chain Registry**: https://chainlist.org/

---

**Implementation Date**: February 3, 2026
**Framework**: Next.js 16, React 19, Wagmi 3, Viem 2
