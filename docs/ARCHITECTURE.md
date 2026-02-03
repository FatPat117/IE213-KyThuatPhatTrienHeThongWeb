# Smart Contract Architecture & Data Flow

## Tổng Quan

Hệ thống Gây Quỹ Minh Bạch là một dApp blockchain hoàn chỉnh tích hợp Ethereum Sepolia, với smart contract quản lý campaigns và donations on-chain, trong khi metadata và lịch sử được lưu off-chain.

---

## 1. Dữ Liệu On-Chain vs Off-Chain

### **On-Chain (Smart Contract)**

Dữ liệu critical, immutable, public:

- **Campaigns**: Tất cả thông tin campaign (title, description, goal, raised, deadline, creator)
- **Donations**: Mỗi donation được ghi lại qua events `DonationReceived`
- **Withdrawals**: Lịch sử rút tiền qua events `FundsWithdrawn`
- **User Contributions**: Mapping `contributions[campaignId][donor] = amount`
- **Campaign States**: Trạng thái campaign (active, completed, withdrawn)

**Lý do On-Chain:**

- ✅ Minh bạch hoàn toàn - ai cũng kiểm tra được
- ✅ Không thể giả mạo hay thay đổi
- ✅ Tự động enforce rules (deadline, goal, refund)
- ✅ Decentralized - không phụ thuộc vào server

### **Off-Chain (Backend Database)**

Dữ liệu metadata, performance, UX:

- Campaign metadata (ảnh, tags, category) - tùy chọn
- User profiles, preferences - nếu có user system
- Campaign activity feed
- Search & filter cache
- RPC call cache

**Lý do Off-Chain:**

- 📊 Không tốn gas để lưu trữ
- 🔍 Dễ search, filter, sort (Database queries nhanh)
- 📈 Dễ scale - DB có index, caching
- 🖼️ Lưu media files (images) không phải bytecode

---

## 2. Smart Contract Architecture

### **FundRaising.sol**

#### State Variables:

```solidity
mapping(uint256 => Campaign) public campaigns;              // id => Campaign data
mapping(uint256 => mapping(address => uint256)) contributions; // id => (donor => amount)
mapping(address => uint256[]) public userCampaigns;         // creator => [ids]
uint256 public campaignCount;                               // Total campaigns
uint256 public totalRaised;                                 // Total money raised
```

#### Core Structs:

```solidity
struct Campaign {
  uint256 id;              // Campaign ID
  string title;            // Campaign title
  string description;      // Campaign description
  address creator;         // Campaign creator
  uint256 goal;           // Goal amount (wei)
  uint256 raised;         // Amount raised so far
  uint256 deadline;       // Deadline timestamp
  bool completed;         // Goal reached or deadline passed
  bool withdrawn;         // Creator already withdrew
}
```

#### Key Functions:

| Function             | Role    | On-Chain Logic                                                                   |
| -------------------- | ------- | -------------------------------------------------------------------------------- |
| `createCampaign()`   | Creator | Validate goal/duration → Create Campaign struct → Store in mapping               |
| `donate()`           | Donor   | Validate campaign exists + active → Add to contributions → Check if goal reached |
| `withdrawFunds()`    | Creator | Verify deadline passed OR goal reached → Transfer balance → Mark withdrawn       |
| `refund()`           | Donor   | Verify deadline passed AND goal NOT reached → Return contribution                |
| `getCampaign()`      | Anyone  | Read campaign data (view only)                                                   |
| `getAllCampaigns()`  | Anyone  | Return all campaigns array                                                       |
| `isCampaignActive()` | Anyone  | Check if deadline still valid                                                    |

---

## 3. Data Flow Diagrams

### **Campaign Creation Flow**

```
User clicks "Create Campaign"
    ↓
Frontend form validates input
    ↓
Send createCampaign() to smart contract
    ↓
Smart Contract:
  - Validate goal > 0, duration > 0
  - Create Campaign struct
  - Store in campaigns[campaignId]
  - Emit CampaignCreated event
    ↓
Frontend listens to event
    ↓
Add campaign metadata to DB (optional)
    ↓
Show success + link to campaign
```

### **Donation Flow**

```
User selects campaign + amount
    ↓
Frontend validates (amount > 0, wallet connected, right chain)
    ↓
Send donate(campaignId) { value: amount } to contract
    ↓
Smart Contract:
  - Verify campaign exists + active (deadline not passed)
  - Record: contributions[id][donor] += amount
  - Record: campaign.raised += amount
  - Check if goal reached → mark completed
  - Emit DonationReceived event
    ↓
Frontend watches event
    ↓
Update UI (progress bar, status)
    ↓
Optional: Store donation record in DB for history
```

### **Withdrawal Flow (Success)**

```
Creator clicks "Withdraw" on completed campaign
    ↓
Frontend checks: deadline passed OR goal reached
    ↓
Send withdrawFunds(campaignId) to contract
    ↓
Smart Contract:
  - Verify caller is creator
  - Verify not already withdrawn
  - Verify funds exist
  - Transfer: payable(creator).call{value: balance}
  - Mark: campaign.withdrawn = true
  - Emit FundsWithdrawn event
    ↓
Frontend confirms withdrawal success
```

### **Refund Flow (Failed Campaign)**

```
After deadline, campaign didn't reach goal
    ↓
Donor clicks "Refund"
    ↓
Send refund(campaignId) to contract
    ↓
Smart Contract:
  - Verify deadline passed
  - Verify goal NOT reached
  - Verify creator didn't withdraw
  - Get: userAmount = contributions[id][donor]
  - Set: contributions[id][donor] = 0
  - Reduce: campaign.raised -= userAmount
  - Transfer: payable(donor).call{value: userAmount}
  - Emit refund event
    ↓
Update UI - show refund success
```

---

## 4. Event Log Reference

Events are emitted on-chain and can be queried by frontend:

| Event               | Parameters                                 | When Emitted                             |
| ------------------- | ------------------------------------------ | ---------------------------------------- |
| `CampaignCreated`   | campaignId, creator, title, goal, deadline | New campaign created                     |
| `DonationReceived`  | campaignId, donor, amount, totalRaised     | Donation received                        |
| `CampaignCompleted` | campaignId, totalRaised, goalReached       | Campaign reaches goal or deadline passes |
| `FundsWithdrawn`    | campaignId, creator, amount                | Creator withdraws funds                  |

**Frontend Usage:**

```typescript
// Listen for donations to a campaign
useWatchContractEvent({
    eventName: "DonationReceived",
    onLogs: (logs) => {
        // Update UI with new donations
    },
});

// Query historical donations
const logs = await publicClient.getLogs({
    address: contractAddress,
    event: "DonationReceived",
    fromBlock: "earliest",
});
```

---

## 5. Gas Optimization

### Strategy:

- **State reads**: Batched via `getAllCampaigns()`, `getCampaign()`
- **Events instead of storage**: Use events for donation history (cheaper than mapping)
- **Mapping for donations**: `contributions[campaignId][donor]` allows direct lookup O(1)

### RPC Call Optimization:

Frontend caches:

- Campaign data (staleTime: 30-60s)
- Balance info (refetch on interaction)
- Use `useWatchContractEvent` for real-time updates instead of polling

---

## 6. Security Measures

### Implemented:

- ✅ Custom errors (cheaper than string messages)
- ✅ Checks before effects: Validate before state changes
- ✅ Re-entrancy protection: Use `.call{value}` correctly (no nested calls)
- ✅ Access control: Creator-only withdrawals, donor-only refunds

### NOT Implemented (Out of Scope):

- Upgradeable proxy (fix bugs - new deploy needed)
- Emergency pause (halt contract in emergencies)
- Fee mechanism (take % of raised funds)
- Time-based restrictions (lock funds after withdrawal)

---

## 7. Testnet Deployment (Sepolia)

### Process:

1. **Compile**: `npm run compile`
2. **Test**: `npm run test` (runs full test suite)
3. **Deploy**: `npm run deploy:sepolia`
    - Requires `.env` with `SEPOLIA_RPC_URL` and `PRIVATE_KEY`
4. **Verify** (optional): Contract on Etherscan

### Environment Variables:

```env
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=0x... (deployer's private key)
ETHERSCAN_API_KEY=... (for verification)
```

**Never commit private keys to GitHub!**

---

## 8. Contract Interaction from Frontend

### Wagmi + Viem Stack:

```typescript
// Read function
const { data: campaign } = useReadContract({
    ...contractConfig,
    functionName: "getCampaign",
    args: [campaignId],
});

// Write function
const { write: donate } = useWriteContract({
    ...contractConfig,
    functionName: "donate",
    args: [campaignId],
});

// Send with value
donate({ value: parseEther("1.5") });

// Watch events
useWatchContractEvent({
    ...contractConfig,
    eventName: "DonationReceived",
    onLogs: (logs) => {},
});
```

---

## 9. Key Differences from Simple Version

**Old Contract:**

- Single global pool
- Simple contribute() + withdraw()
- No campaign isolation

**New Contract:**

- Multiple independent campaigns
- Each campaign has goal, deadline, status
- Donors can contribute to specific campaigns
- Auto-complete when goal reached
- Refund mechanism for failed campaigns
- Creator withdrawal logic
- Event-based tracking

---

## 10. Testing Coverage

Test suite (`FundRaising.test.js`) includes:

- ✅ Campaign creation (valid/invalid cases)
- ✅ Donations (tracking, multiple donors, auto-complete)
- ✅ Withdrawals (success, timing, creator check)
- ✅ Refunds (failed campaigns, deadline checks)
- ✅ View functions (all read-only functions)
- ✅ Edge cases (multiple campaigns, large amounts, small amounts)

**Run tests:**

```bash
cd smart_contracts
npm install   # Install @nomicfoundation/hardhat-network-helpers
npm run test
```

---

## Summary

This architecture balances:

- **Decentralization**: Core logic on blockchain
- **Efficiency**: Metadata off-chain, events for history
- **User Experience**: Fast queries, clear status updates
- **Security**: Custom errors, proper access control
- **Testability**: Comprehensive test suite with edge cases
