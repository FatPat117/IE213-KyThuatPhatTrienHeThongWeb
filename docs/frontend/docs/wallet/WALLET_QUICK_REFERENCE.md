# Wallet Integration - Quick Reference

## 📂 File Structure

```
frontend/app/
├── components/
│   ├── WalletConnectButton.tsx     # Main connection button
│   ├── WalletStatus.tsx            # Display wallet info
│   └── WalletExampleComponent.tsx  # Example usage patterns
├── config/
│   └── wagmi.ts                    # Wagmi configuration
├── hooks/
│   └── useWallet.ts                # Custom wallet hooks
├── providers/
│   └── WagmiProvider.tsx           # Provider wrapper
├── layout.tsx                      # Updated with WagmiProvider
└── page.tsx                        # Updated home page
```

## 🎯 Key Components

### 1. WalletConnectButton

**Purpose**: Connect/disconnect wallet and show network status
**Props**: None
**Features**:

- MetaMask connection
- Network validation (Sepolia)
- Warning alerts

```tsx
import WalletConnectButton from "@/app/components/WalletConnectButton";

<WalletConnectButton />;
```

### 2. WalletStatus

**Purpose**: Display connected wallet info
**Props**: None
**Shows**:

- Shortened address
- ETH balance
- Network indicator

```tsx
import WalletStatus from "@/app/components/WalletStatus";

<WalletStatus />;
```

## 🪝 Custom Hooks

### useWalletStatus()

Get wallet connection status and info

```tsx
const {
    address, // Full wallet address
    shortenedAddress, // Formatted address (0x1234...5678)
    isConnected, // Boolean
    isSepoliaNetwork, // Boolean
    isValidNetwork, // isConnected && isSepoliaNetwork
} = useWalletStatus();
```

### useWalletValidation()

Check if wallet is properly set up

```tsx
const {
    isValid, // Ready for transactions
    errors, // Array of error messages
    isConnected, // Boolean
    isSepoliaNetwork, // Boolean
} = useWalletValidation();
```

### useShortenAddress()

Format long addresses

```tsx
const shortened = useShortenAddress("0x1234567890abcdef");
// Returns: '0x1234...cdef'
```

### useIsSepoliaNetwork()

Check network status

```tsx
const isOnSepolia = useIsSepoliaNetwork();
```

## 💻 Usage Examples

### Example 1: Simple Connection Status

```tsx
"use client";
import { useAccount } from "wagmi";

function MyComponent() {
    const { address, isConnected } = useAccount();

    if (!isConnected) return <p>Not connected</p>;

    return <p>Connected: {address}</p>;
}
```

### Example 2: Protected Component

```tsx
"use client";
import { useWalletValidation } from "@/app/hooks/useWallet";

function ProtectedFeature() {
    const { isValid, errors } = useWalletValidation();

    if (!isValid) {
        return <div className="alert">{errors.join(", ")}</div>;
    }

    return <div>Feature Content</div>;
}
```

### Example 3: Getting Balance

```tsx
"use client";
import { useBalance } from "wagmi";
import { useAccount } from "wagmi";

function Balance() {
    const { address } = useAccount();
    const { data: balance } = useBalance({ address });

    return (
        <p>
            {balance?.formatted} {balance?.symbol}
        </p>
    );
}
```

### Example 4: Check Network Before Action

```tsx
"use client";
import { useWalletStatus } from "@/app/hooks/useWallet";

function SendTransaction() {
    const { isValidNetwork } = useWalletStatus();

    const handleSend = () => {
        if (!isValidNetwork) {
            alert("Please switch to Sepolia network");
            return;
        }
        // Send transaction logic
    };

    return <button onClick={handleSend}>Send</button>;
}
```

## 🔧 Wagmi Hooks Reference

| Hook               | Purpose               | Returns                                            |
| ------------------ | --------------------- | -------------------------------------------------- |
| `useAccount()`     | Get wallet connection | `{ address, isConnected, ... }`                    |
| `useChainId()`     | Get network           | `number`                                           |
| `useBalance()`     | Get ETH balance       | `{ data: { value, decimals, symbol, formatted } }` |
| `useConnect()`     | Connect wallet        | `{ connect, connectors, ... }`                     |
| `useDisconnect()`  | Disconnect wallet     | `{ disconnect, ... }`                              |
| `useSignMessage()` | Sign messages         | `{ signMessage, ... }`                             |
| `useSwitchChain()` | Switch network        | `{ switchChain, ... }`                             |

## 🌐 Network Config

**Sepolia (Test Network)**

- Chain ID: `11155111`
- Name: `sepolia`
- Currency: `ETH`
- RPC: `https://eth-sepolia.g.alchemy.com/v2/demo`

## ⚙️ Installation

```bash
cd frontend
npm install
npm run dev
```

Then open: `http://localhost:3000`

## 🔐 Security Checklist

- ✅ No private keys stored anywhere
- ✅ All signing done in MetaMask
- ✅ Client-side only (no backend wallet exposure)
- ✅ Network validation enabled
- ✅ Read-only operations for balance fetch

## 🐛 Common Issues

| Issue                 | Fix                               |
| --------------------- | --------------------------------- |
| "Module not found"    | Run `npm install`                 |
| MetaMask not found    | Install from metamask.io          |
| Wrong network warning | Switch to Sepolia in MetaMask     |
| Balance shows 0       | Use Sepolia faucet to fund wallet |
| Provider error        | Check WagmiProvider in layout.tsx |

## 📚 Resources

- [Wagmi Docs](https://wagmi.sh/)
- [Viem Docs](https://viem.sh/)
- [MetaMask Docs](https://docs.metamask.io/)
- [Sepolia Faucet](https://sepoliafaucet.com)
- [Etherscan](https://sepolia.etherscan.io)

## 🚀 Next Steps

1. Add transaction signing (useSendTransaction)
2. Interact with smart contracts (useContractRead/Write)
3. Add ENS name resolution
4. Implement multi-wallet support
5. Add transaction history display

---

**Last Updated**: February 3, 2026
**Status**: ✅ Ready to Use
