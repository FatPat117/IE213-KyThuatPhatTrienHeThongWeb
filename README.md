# Funding Platform (Foundry)

## Project Overview

The Funding Platform is a community fundraising system that lets users create campaigns, accept donations, withdraw funds on success, issue NFT certificates to donors, and enable refunds when a campaign fails.

## Prerequisites

Install Foundry:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Setup

From the `smart-contracts` folder, install dependencies:

```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
```

## Environment Variables

Create a `.env` file in `smart-contracts/` using the template below:

```bash
# .env.example
PRIVATE_KEY=
SEPOLIA_RPC_URL=
ETHERSCAN_API_KEY=
```

## Testing

Run the full test suite:

```bash
forge test -vv
```

## Deployment

Deploy to Sepolia:

```bash
forge script script/DeployFundingPlatformSepolia.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
```

## Current Deployment (Sepolia)

The contract is live on the Sepolia Testnet at:

`0xCF6eBe1D6aD4d7d097B1cfB8d1eBB195b5710F78`
