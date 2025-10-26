OCX Token Model README

This is a tiny simulation to help reason about how buybacks and burns can affect price directionally.

Files
- `scripts/simulate_token_model.js` — Node.js script. Simple scenarios configured at top of file.

How to run
1. Ensure you have Node.js installed (v14+).
2. From the repo root run:

```bash
node scripts/simulate_token_model.js
```

What it does
- Runs a couple of preset scenarios over a 24-month period.
- Each month: campaign revenue -> buybacks (USD -> OCX using current price) -> partial burn.
- Naive market-cap update uses buy pressure and a small price impact factor.

Caveats
- This is a toy model for intuition only. It does not simulate orderbooks, liquidity depth, slippage properly, nor external market sentiment.
- For any financial or investor-facing materials, use a professional financial model.

How to adapt
- Edit scenarios in `scripts/simulate_token_model.js` to try different revenue, burn %, and growth rates.
