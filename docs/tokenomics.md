# OCX Tokenomics

This document describes the OCX token economics and recommended treasury / emission policies for OceanX. It is intentionally conservative and designed to be implemented without modifying the existing contracts in the repository.

## High level
- Token: OCX (OceanX Token)
- Blockchain: target deployment: Base (EVM-compatible L2)
- Total supply: 1,000,000,000 OCX (fixed in `OCXToken.sol`)
- Initial on-chain distribution (from token contract):
  - Development: 20% (minted to `DEVELOPMENT_WALLET`)
  - Liquidity (LP): 30% (minted to `LP_WALLET`)
  - Marketing: 10% (minted to `MARKETING_WALLET`)
  - Contract reserve / claimable: remainder (40%) minted to the token contract for backend-authorized claims

## Goals
1. Align token utility with the game: players should want to buy/hold OCX because it unlocks gameplay value.
2. Reduce immediate sell pressure by locking/vesting large allocations and creating token sinks (burns, spend mechanics).
3. Use treasury responsibly to fund growth while supporting price floor via buybacks and liquidity.
4. Bootstrap liquidity on Base and maintain healthy pools to prevent manipulation and high slippage.

## Recommended policies (non-invasive)
These can all be executed off-chain or by using existing contract flows (UpgradeManager pays treasury; OCXToken.claim is used for controlled distribution).

1) Claims & Backend distribution
- Use the existing `OCXToken.claim` flow to distribute tokens to players/participants. The backend signer (`authorizedSigner`) should only sign claims when the action has economic value (e.g., earned rewards, purchases converted to OCX rewards).
- Rate-limit claims per player and require meaningful on-chain or off-chain action (e.g. purchase, milestone, staking reward) to reduce sybil/mint abuse.

2) Vesting & release schedule (off-chain enforcement / public schedule)
- Development wallet (20%): implement an off-chain vesting schedule and publish it. Suggested schedule: 4-year linear vesting with 6-month cliff for founders/devs. Monthly or weekly releases from the wallet.
- Marketing wallet (10%): use dedicated multisig and tranche-based release for campaigns, community incentives, and partnerships.
- LP wallet (30%): do not dump; use for initial liquidity provisioning only. Lock a portion in a timelock or LP staking program.
- Contract reserve (40%): used for player rewards, grants, and ecosystem incentives via `claim`. Control release cadence tightly.

3) Treasury policy (on-chain treasury as a multisig off-chain-managed fund)
- The `treasury` address used by `UpgradeManager` should be a multisig controlled by core team + independent signers (e.g., Gnosis Safe or similar).
- Treasury uses: growth (marketing, partnerships), buybacks, development, grants.
- Policy: dedicate a percentage of revenue to buybacks (example: 20% of net revenue to buybacks for the first 12-24 months). Convert fees to OCX on Base DEX and send to a burn address or hold for community-governed buyback decisions.

4) Buybacks & burns
- On revenue events (NFT sales, fees from upgrade purchases, subscription revenue), treasury buys OCX on open market (on Base) and either:
  - burns the tokens (reduces circulating supply) or
  - holds them in treasury for future protocol uses (buy-and-burn yields immediate supply reduction; buy-and-treasury supports future initiatives).
- Start with partial burns (e.g., 50% of buybacks burned, 50% reserved) until community governance is established.

5) Token sinks inside the game
- Upgrades: `UpgradeManager` already charges OCX → treasury. Ensure upgrade flows are visible and desirable.
- Limited consumables: create scarce in-game items purchasable with OCX that are intentionally consumed (burned or transferred to treasury).
- Fees: add small transaction fees in OCX for specialized actions that route to buybacks or burns.

6) Staking / Locking incentives (off-chain coordination + on-chain where possible)
- Offer time-locked staking (off-chain multisig-managed vault initially) that rewards stakers with early access, governance or extra in-game benefits. Eventually implement an on-chain staking contract for yield and vote-escrow (ve) model for serious lockups.
- Incentivize LP staking: provide OCX rewards for LPs on Base to bootstrap liquidity. Use marketing wallet or contract reserve to fund LP incentives for a limited period (e.g., 6 months).

7) Liquidity provisioning & listing strategy on Base
- Initial DEX listing: provide OCX/ETH (or OCX/USDC) liquidity on a reputable DEX deployed on Base (e.g., Uniswap or equivalent that supports Base).
- Create a liquidity vesting plan: lock LP tokens for a minimum duration (e.g., 6-12 months) to increase buyer confidence.
- Provide incentives: use `LP_WALLET` allocation partly for LP incentives (yield farming) with defined emission schedules.

8) Governance & transparency
- Publish a clear, auditable vesting schedule for all team/marketing/LP allocations.
- Use a multisig for treasury with KYC/identity of signers or reputable third parties to build trust.
- After TGE maturity, move to token-holder governance for buyback/burn policies.

## Sample allocation & schedule (example)
- Total: 1,000,000,000 OCX
  - Development: 200,000,000 (20%) — vest 4 years, 6-month cliff, monthly linear release
  - LP: 300,000,000 (30%) — 50% used to bootstrap liquidity, 50% locked for incentives (release over 12 months)
  - Marketing: 100,000,000 (10%) — tranche releases for campaigns
  - Contract reserve: 400,000,000 (40%) — controlled by authorized signer for claims/rewards

## Metrics to publish & track
- Circulating supply (on-chain and off-chain locked amounts)
- Daily active wallets and transaction volume using OCX
- Treasury balance and buyback spend (USD + OCX)
- Liquidity depth (pool reserves, price impact at different trade sizes)
- Vesting unlock schedule and remaining locked tokens

## Risks
- Centralization: team-controlled signer and transferAgents are central points. Publish clear governance and multisig controls to reduce risk perception.
- Dump pressure from LP and development allocations — mitigate with locks and staggered vesting.
- Low demand: without meaningful utility or token sinks, supply will outpace demand and price will not appreciate.

## Quick actionable checklist (first 90 days)
1. Set `treasury` to a multisig (Gnosis Safe) and publish signer list.
2. Publish a public vesting schedule and timeline on your website & repo.
3. Use `OCXToken.claim` for controlled player distributions; ensure backend signer rotates/has safe key management.
4. Provide initial liquidity on Base and lock a portion of LP tokens.
5. Announce buyback policy and commit to 12-month buyback plan funded from upgrade fees/market revenue.
6. Launch a 3-month LP incentive program using `LP_WALLET` funds.

---

Appendix: A note about transfers
- `OCXToken` disables wallet-to-wallet transfers by default: only `transferAgents` (allowlisted) can move tokens between wallets. This is a feature that reduces abuse but requires that any DEX or bridge operator be added as a `transferAgent` by the token owner. Plan to add trusted DEX routers and bridge contracts to `transferAgents` before listing or bridging.


