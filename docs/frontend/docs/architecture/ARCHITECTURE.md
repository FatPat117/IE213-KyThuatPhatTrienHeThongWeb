# Wallet Integration Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser / Next.js App                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              RootLayout (layout.tsx)                     │  │
│  │         ↓ Wraps with WagmiProviderWrapper ↓              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            │                                     │
│  ┌─────────────────────────▼──────────────────────────────────┐ │
│  │            WagmiProviderWrapper Component                 │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │  ├─ WagmiProvider (from wagmi)                      │ │ │
│  │  │  │   └─ config: createConfig({chains, transports}) │ │ │
│  │  │  │                                                   │ │ │
│  │  │  ├─ QueryClientProvider (from @tanstack/react-query)│ │ │
│  │  │  │   └─ Caches RPC responses                        │ │ │
│  │  │  │                                                   │ │ │
│  │  │  └─ {children} ← All app components               │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                            │                                      │
│  ┌─────────────────────────▼──────────────────────────────────┐  │
│  │              Page Component (page.tsx)                    │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ ├─ WalletConnectButton Component                   │ │  │
│  │  │ │   └─ Uses: useAccount, useConnect, etc.         │ │  │
│  │  │ │                                                   │ │  │
│  │  │ ├─ WalletStatus Component                          │ │  │
│  │  │ │   └─ Uses: useBalance, useChainId, etc.         │ │  │
│  │  │ │                                                   │ │  │
│  │  │ └─ WalletExampleComponent (for reference)         │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Communicates
                              │ with
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              MetaMask Browser Extension                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Handles:                                               │ │
│  │  • Private key management                              │ │
│  │  • Transaction signing                                 │ │
│  │  • Message signing                                     │ │
│  │  • User approval prompts                               │ │
│  │  • Network switching                                   │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ JSON-RPC
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           Ethereum Network (Sepolia Testnet)                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  RPC Endpoints:                                         │ │
│  │  • Alchemy: eth-sepolia.g.alchemy.com                  │ │
│  │  • Infura: sepolia.infura.io                           │ │
│  │  • Public: rpc.sepolia.org                             │ │
│  │                                                         │ │
│  │  Provides:                                              │ │
│  │  • Balance queries                                      │ │
│  │  • Transaction status                                  │ │
│  │  • Block information                                   │ │
│  │  • Contract state                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Connection

```
User clicks "Connect MetaMask"
        │
        ▼
┌─────────────────────────┐
│ handleConnect() function │
│ connect({ connector })  │
└────────────┬────────────┘
             │
             ▼
┌────────────────────────────┐
│ injected() connector       │
│ (MetaMask extension)       │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│ MetaMask popup appears     │
│ User approves connection   │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ Wallet connected                   │
│ useAccount hook updates:           │
│  • address: 0x...                  │
│  • isConnected: true               │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│ UI Updates:                        │
│ • Show address (shortened)         │
│ • Show balance (via useBalance)    │
│ • Show network (via useChainId)    │
│ • Display "Connected" state        │
└────────────────────────────────────┘
```

## Component Hierarchy

```
RootLayout
  └─ WagmiProviderWrapper
      ├─ WagmiProvider
      ├─ QueryClientProvider
      └─ {children}
          └─ Page
              ├─ WalletConnectButton
              │   ├─ useAccount()
              │   ├─ useConnect()
              │   └─ useDisconnect()
              │
              └─ WalletStatus
                  ├─ useAccount()
                  ├─ useChainId()
                  └─ useBalance()
```

## Hook Hierarchy

```
wagmi Hooks
├─ useAccount()           ← Get wallet address & status
├─ useChainId()           ← Get current network
├─ useBalance()           ← Fetch ETH balance
├─ useConnect()           ← Connect wallet
├─ useDisconnect()        ← Disconnect wallet
├─ useSignMessage()       ← Sign messages
└─ useSwitchChain()       ← Switch networks

Custom Hooks (useWallet.ts)
├─ useWalletStatus()      ← Combines multiple hooks
├─ useWalletValidation()  ← Validates setup
├─ useShortenAddress()    ← Format addresses
└─ useIsSepoliaNetwork()  ← Check network
```

## File Dependencies

```
page.tsx
├─ imports → WalletConnectButton.tsx
├─ imports → WalletStatus.tsx
└─ uses → wagmi hooks directly

WalletConnectButton.tsx
├─ imports → wagmi hooks
└─ uses → useAccount, useConnect, useDisconnect, useChainId

WalletStatus.tsx
├─ imports → wagmi hooks
├─ imports → useWallet custom hooks
└─ uses → useAccount, useBalance, useChainId

layout.tsx
└─ imports → WagmiProviderWrapper

WagmiProviderWrapper.tsx
├─ imports → wagmi
├─ imports → react-query
├─ imports → config from wagmi.ts
└─ provides → all wagmi functionality

useWallet.ts
└─ imports → wagmi hooks directly
```

## State Management Flow

```
MetaMask                 Wagmi              React Component
   │                       │                      │
   │  User approves        │                      │
   ├──────connection──────►│                      │
   │                       │  Updates hooks       │
   │                       ├─────────────────────►│
   │                       │                      │
   │  Balance changes      │                      │
   ├──────────event───────►│                      │
   │                       │  Refetches data      │
   │                       ├─────────────────────►│
   │                       │                      │  State: {
   │                       │                      │    address,
   │                       │                      │    balance,
   │                       │                      │    chainId
   │                       │                      │  }
```

## Security Model

```
User's Private Keys
        │ (stays in MetaMask)
        ▼
    MetaMask
        │ (signs transactions)
        ▼
    Transaction Hash
        │ (sent to network)
        ▼
Ethereum Network
        │
        ├─────────────────────┐
        │                     │
    Valid ← Verify Signature ─┘
        │
        ▼
Transaction Confirmed
```

## Wagmi Config Flow

```
wagmi.ts (createConfig)
    │
    ├─ chains: [mainnet, sepolia]
    │
    ├─ transports: {
    │   [mainnet.id]: http(),
    │   [sepolia.id]: http('rpc-endpoint')
    │ }
    │
    └─ Used by WagmiProvider
        │
        ├─ Initializes hooks
        ├─ Manages state
        └─ Handles RPC calls
```

## Network Switching Logic

```
useChainId()  ──┐
                │
                ├─ Compare with SEPOLIA_CHAIN_ID (11155111)
                │
                ├─ If match   ──► Show ✓ Sepolia Network
                │
                └─ If no match ──► Show ✗ Wrong Network
                                   Show warning message
```

## Balance Fetching Flow

```
useBalance({ address })
        │
        ▼
Query stored in React Query cache
        │
        ▼
Call RPC: eth_getBalance
        │
        ▼
RPC Response:
  {
    value: BigInt,
    decimals: 18,
    symbol: 'ETH',
    formatted: '0.5000'
  }
        │
        ▼
Display in UI
```

## Component Interaction Matrix

```
              │ Connect │ Status │ Example │
──────────────┼─────────┼────────┼─────────
useAccount    │    ✓    │   ✓    │    ✓
useChainId    │    ✓    │   ✓    │    ✓
useBalance    │         │   ✓    │    ✓
useConnect    │    ✓    │        │
useDisconnect │    ✓    │        │
Wagmi Config  │    ✓    │   ✓    │    ✓
Custom Hooks  │    ✓    │   ✓    │    ✓
```

---

**Diagram Created**: February 3, 2026
**Purpose**: Visual understanding of wallet architecture
**Scope**: Complete system design and data flow
