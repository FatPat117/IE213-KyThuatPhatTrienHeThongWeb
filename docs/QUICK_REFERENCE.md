# 🚀 Quick Reference Guide - IE213 FundRaising Platform v2.0

## 📍 Quick Links by Feature

### For Campaign Creators

| Want to...                 | Go to...               | See...                              |
| -------------------------- | ---------------------- | ----------------------------------- |
| **Start fundraising**      | `/campaigns/create`    | Campaign form                       |
| **View my campaigns**      | `/my-campaigns`        | Creator dashboard                   |
| **Edit campaign**          | `/campaigns/[id]/edit` | Edit form (appears in my-campaigns) |
| **Withdraw funds**         | `/campaigns/[id]`      | Purple "💰 Withdraw" button         |
| **Check campaign details** | `/campaigns/[id]`      | Full campaign info                  |

**Access Control:**

- Edit: Only while campaign is active
- Withdraw: Only when campaign ends + goal reached

---

### For Donors

| Want to...                 | Go to...          | See...                                |
| -------------------------- | ----------------- | ------------------------------------- |
| **Browse campaigns**       | `/campaigns`      | Campaign list with search/filter/sort |
| **Find specific campaign** | `/campaigns`      | Use search box                        |
| **Donate to campaign**     | `/campaigns/[id]` | Blue donation widget                  |
| **Check my donations**     | `/donations`      | Donation history                      |
| **Get refund**             | `/campaigns/[id]` | Orange "🔙 Refund" button             |

**Visibility:**

- Donate: Always (unless campaign ended)
- Refund: When campaign failed (goal not reached)

---

### For Everyone

| Want to...              | Go to...           |
| ----------------------- | ------------------ |
| Learn how it works      | `/` (home page)    |
| Check system status     | `/status`          |
| View featured campaigns | `/` (home page)    |
| Connect wallet          | Top navigation bar |

---

## 🔍 Search & Filter Guide

### Search Bar (`/campaigns`)

```
Enter keyword → Searches campaign titles & descriptions
Example: "Community" → Shows campaigns with "Community" in title/description
```

### Filter by Status

```
All Campaigns   → Shows all (default)
🔴 Active       → Shows campaigns still accepting donations
Ended           → Shows completed campaigns
```

### Sort By

```
Newest First    → Shows recently created first (default)
Most Funded     → Shows highest ETH raised first
Trending (%)    → Shows highest % funded first
```

---

## 💰 Transaction Flows

### Creating a Campaign

```
1. Fill form (title, desc, goal, deadline)
2. Click "Create Campaign"
3. MetaMask popup → Sign transaction
4. Wait for confirmation
5. Campaign appears on blockchain
6. Share campaign link
```

### Donating to Campaign

```
1. Open campaign page
2. Enter ETH amount (or click preset)
3. Click "Donate Now"
4. MetaMask popup → Sign & confirm
5. Wait for confirmation
6. Donation recorded on blockchain
7. Appears in donation history
```

### Withdrawing Funds (Creator)

```
1. Open campaign (must be completed)
2. Must be creator
3. Must have goal reached
4. See "💰 Withdraw Funds" button
5. Click withdraw
6. MetaMask popup → Sign
7. Wait for confirmation
8. Funds sent to wallet
9. Button shows "Already Withdrawn"
```

### Requesting Refund (Donor)

```
1. Open failed campaign (goal not reached)
2. Must have donated
3. See "🔙 Request Refund" button
4. Click refund
5. MetaMask popup → Sign
6. Wait for confirmation
7. Funds return to wallet
```

### Editing Campaign (Creator)

```
1. Open /my-campaigns
2. Find campaign (must be active)
3. Click "✏️ Edit" button
4. Update title/description
5. Click "Save Changes"
6. Confirmation message appears
7. Changes saved (metadata only)
```

---

## 🎯 Page Quick Reference

### `/` (Home)

- Hero section with platform intro
- "How it works" 4-step guide
- Featured campaigns
- Network info (Sepolia)
- Call-to-action buttons

### `/campaigns` (Browse)

- Search box: 🔍 Search by title/description
- Filter dropdown: All / Active / Ended
- Sort dropdown: Newest / Most Funded / Trending
- Campaign cards with progress bars
- Results counter

### `/campaigns/[id]` (Campaign Detail)

- Campaign info (title, creator, description)
- Progress bar (raised/goal)
- Time remaining (for active)
- Donor list
- **For creators:** 💰 Withdraw button (if eligible)
- **For donors:** 🔙 Refund button (if eligible)
- Blue donation widget
- Transaction history

### `/campaigns/create` (Create)

- Title input (1-100 chars)
- Description input (1-1000 chars)
- Goal amount (ETH)
- Deadline picker
- Form validation
- Submit button

### `/campaigns/[id]/edit` (Edit) ⭐ NEW

- Creator authorization check
- Campaign info display
- Title input (editable)
- Description input (editable)
- Immutable fields warning
- Save/Cancel buttons

### `/my-campaigns` (My Campaigns)

- Creator's campaign list
- Campaign cards
- Edit button (for active)
- Withdraw button (for completed)
- View details button
- Status badges

### `/donations` (My Donations)

- Donation history table
- Amount, date, campaign name
- Etherscan links
- Total donated stats
- Blockchain verification info

### `/status` (System Status)

- Network status (Sepolia)
- Contract health
- RPC connection
- Gas prices
- Last sync time

---

## 🔐 Authorization Rules

### Who Can Edit?

- ✅ Campaign creator (only)
- ✅ While campaign is active
- ❌ Not after campaign ends

### Who Can Withdraw?

- ✅ Campaign creator (only)
- ✅ When campaign is completed
- ✅ When goal is reached
- ❌ Not if funds already withdrawn

### Who Can Refund?

- ✅ Donors (who contributed)
- ✅ When campaign is completed
- ✅ When goal is NOT reached
- ❌ Not if goal was reached

### Who Can Donate?

- ✅ Anyone with MetaMask
- ✅ While campaign is active
- ❌ Not after campaign ends

---

## ⚙️ Settings & Configuration

### MetaMask Setup

1. Install MetaMask extension
2. Create/import wallet
3. Switch to Sepolia testnet
4. Get test ETH from faucet
5. Refresh browser
6. Click "Connect Wallet" button

### Contract Address

- **Network:** Ethereum Sepolia
- **Chain ID:** 11155111
- **Address:** See `.env.local`
- **Explorer:** sepolia.etherscan.io

### Required Gas

- Create campaign: ~150,000 gas
- Donate: ~80,000 gas
- Withdraw: ~50,000 gas
- Refund: ~50,000 gas

---

## 🐛 Troubleshooting

### "Wallet Not Connected"

- Click "Connect Wallet" button
- Select MetaMask
- Approve connection
- Refresh page

### "Wrong Network"

- Open MetaMask
- Switch to "Sepolia" network
- Refresh browser

### "Insufficient Gas"

- Go to Sepolia Faucet
- Get test ETH
- Wait for confirmation
- Retry transaction

### "Campaign Not Found"

- Check contract address is correct
- Verify campaign ID exists
- Try refreshing page
- Check campaign is on Sepolia

### "Edit Button Missing"

- Campaign must be active (not ended)
- Must be connected as creator
- Must be on campaign detail page

### "Withdraw Button Missing"

- Campaign must be completed
- Goal must be reached
- Must be connected as creator
- Funds must not be withdrawn

### "Refund Button Missing"

- Campaign must be completed
- Goal must NOT be reached
- Must have donated to campaign
- Must be connected as donor

---

## 📱 Mobile & Responsive

### Layouts

- **Mobile (<768px):** Single column
- **Tablet (768-1024px):** 2 columns
- **Desktop (>1024px):** 3+ columns

### Touch-Friendly

- ✅ Large buttons (48px minimum)
- ✅ Adequate spacing
- ✅ Clear typography
- ✅ Readable inputs

---

## 🔗 External Links

### Networks & Tools

- [Sepolia Faucet](https://faucet.sepolia.dev) - Get test ETH
- [Sepolia Etherscan](https://sepolia.etherscan.io) - View transactions
- [MetaMask](https://metamask.io) - Wallet

### Documentation

- [Solidity Docs](https://docs.soliditylang.org)
- [Wagmi Hooks](https://wagmi.sh)
- [Viem Library](https://viem.sh)
- [Ethereum Docs](https://ethereum.org/en/developers)

---

## 📊 Live Statistics

### On-Chain Data

- All data stored on blockchain
- Real-time event updates
- Verifiable on Etherscan
- Immutable records

### Cached Data

- Frontend caches for 5 minutes
- Reduces RPC calls
- Improves performance
- Auto-refreshes when stale

---

## 🎯 Common Workflows

### "I want to raise funds"

1. → Go to `/campaigns/create`
2. → Fill campaign details
3. → Create campaign
4. → Share link
5. → Monitor on `/my-campaigns`
6. → Withdraw funds when done

### "I want to support a campaign"

1. → Go to `/campaigns`
2. → Search/filter to find campaign
3. → Click campaign
4. → Enter donation amount
5. → Confirm in MetaMask
6. → Check `/donations` for history

### "I need a refund"

1. → Go to campaign page
2. → Check if campaign failed
3. → Click "Request Refund"
4. → Sign in MetaMask
5. → Funds returned to wallet

### "I want to update my campaign"

1. → Go to `/my-campaigns`
2. → Find active campaign
3. → Click "Edit"
4. → Update title/description
5. → Save changes

---

## ✨ Pro Tips

### Optimization

- Use filters to find campaigns quickly
- Sort by "Trending" to see hot campaigns
- Set multiple small donations to reduce gas
- Wait for off-peak hours for cheaper gas

### Safety

- Always verify contract address
- Check campaign details before donating
- Keep MetaMask updated
- Never share private keys
- Verify on Etherscan

### Community

- Share successful campaigns
- Leave campaign links in descriptions
- Verify donations on Etherscan
- Join discussion forums
- Report issues

---

## 📞 Getting Help

### Resources

1. Read `/docs/FEATURES.md` for detailed info
2. Check `/docs/IMPLEMENTATION_GUIDE.md` for architecture
3. See `/docs/ENHANCEMENTS_SUMMARY.md` for changes
4. Review code comments for implementation details

### Common Questions

- **Q:** Can I change campaign goal?
  **A:** No, it's immutable on blockchain

- **Q:** Can I withdraw before deadline?
  **A:** Only if goal is reached (via smart contract logic)

- **Q:** Are donations refundable?
  **A:** Only if campaign fails (goal not reached)

- **Q:** Which network?
  **A:** Ethereum Sepolia testnet

---

## 🎓 Learning Path

### Beginner

1. Read home page ("How it works")
2. Browse campaigns
3. Connect wallet
4. Make test donation
5. Check donation history

### Intermediate

1. Create test campaign
2. Donate to multiple campaigns
3. Edit your campaign
4. Withdraw funds
5. Monitor gas costs

### Advanced

1. Review smart contract code
2. Understand event logs
3. Verify on Etherscan
4. Study optimization strategies
5. Explore test scenarios

---

## 🚀 Next Steps

1. **Get Started:** Connect wallet and browse campaigns
2. **Create Campaign:** Start fundraising
3. **Make Donation:** Support a cause
4. **Manage Profile:** Track campaigns/donations
5. **Explore Features:** Try all functionality

---

**Last Updated:** December 20, 2024
**Version:** 2.0 - Complete Edition
**Status:** ✅ Production Ready

**Need help? Check the docs folder for comprehensive guides!**
