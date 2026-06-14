# @glide-pool/cli

CLI for [GlidePool](https://github.com/GlidePool/glidepool) — autonomous DLMM agent platform on Base Mainnet.

Manage agents, browse pools, inspect positions, and get Claude Opus 4 AI advice directly from your terminal.

## Installation

```bash
npm install -g @glide-pool/cli
```

## Setup

Point the CLI at your GlidePool API server:

```bash
# Save API URL to ~/.glidepool/config.json
glidepool config set-api https://api.glidepool.xyz

# Or use the --api flag on every command
glidepool --api https://api.glidepool.xyz pools list

# Or set the environment variable
export GLIDEPOOL_API_URL=https://api.glidepool.xyz
```

## Commands

### `glidepool config`

```bash
glidepool config set-api <url>   # Save API URL
glidepool config show            # Show current config
```

---

### `glidepool pools`

```bash
# List all supported Maverick V2 pools (live TVL, price, fee)
glidepool pools list

# Output:
# TOKEN A  TOKEN B  TVL (USD)  PRICE   FEE    ADDRESS
# -------  -------  ---------  ------  -----  ----------
# WETH     USDC     21311      0.0004  0.0015  0x3d70...
# DAI      USDC     64203      0.9998  0.00002 0x1a2b...

# Get details for a specific pool
glidepool pools get 0x3d70b2f31f75dc84acdd5e1588695221959b2d37

# Raw JSON output (all commands support --json)
glidepool pools list --json
```

---

### `glidepool agent`

```bash
# Deploy a new autonomous agent
glidepool agent create \
  --wallet 0xYourWallet \
  --pool 0x3d70b2f31f75dc84acdd5e1588695221959b2d37 \
  --strategy balanced \
  --budget 100 \
  --interval 60

# Output:
# Agent deployed
#   ID:       4df9a63d-30eb-4885-87fc-f44f98baadbe
#   Pool:     0x3d70b2f31f75dc84acdd5e1588695221959b2d37
#   Strategy: balanced
#   Budget:   100 USDC
#   Status:   active

# List all agents for a wallet
glidepool agent list --wallet 0xYourWallet

# Get a single agent
glidepool agent get <agentId>

# Pause / resume / stop
glidepool agent pause  <agentId>
glidepool agent resume <agentId>
glidepool agent stop   <agentId>

# View LLM decisions (last 10 by default)
glidepool agent actions <agentId>
glidepool agent actions <agentId> --limit 20

# Output:
# [03:31:28] HOLD — completed
#   Risk:    high
#   Reason:  Pool reserves are low, price is volatile. Holding current position...
#
# [03:32:00] REBALANCE — pending_signature
#   Risk:    medium
#   Bins:    lower=-5 upper=5
```

---

### `glidepool positions`

```bash
# List Maverick V2 LP positions for a wallet
glidepool positions 0xYourWallet

# Output:
# NFT ID  TOKEN A  TOKEN B  VALUE USD  AMOUNT A  AMOUNT B  BINS
# ------  -------  -------  ---------  --------  --------  ----
# 1234    WETH     USDC     523.40     0.150000  285.2200  3
```

---

### `glidepool advisor`

```bash
# Get Claude Opus 4 analysis for a pool
glidepool advisor \
  --pool 0x3d70b2f31f75dc84acdd5e1588695221959b2d37 \
  --goal "maximize fee income with minimal impermanent loss"

# Analyze an existing position
glidepool advisor \
  --pool 0x3d70b2f31f75dc84acdd5e1588695221959b2d37 \
  --goal "should I rebalance or hold?" \
  --nft 1234

# Output:
# ── AI Advisor ──────────────────────────
#   Action:   HOLD
#   Risk:     low
#   Summary:  Pool is in a healthy state. Current price is centered in your bin range.
#
#   Reasoning:
#   The active tick is within the optimal range. Fee generation is consistent.
#   No rebalance needed at this time. Monitor for price drift above tick 150.
```

**x402 payments:** If the server requires payment (`X402_ENABLED=true`), the CLI shows:
```
[402] Payment Required
  Send 0.05 USDC on Base to:
  0xTreasuryAddress...
  Token: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

  Then retry with: --payment-proof <base64(JSON{txHash,from,amount})>
```

Once you've sent the USDC:
```bash
PROOF=$(echo '{"txHash":"0x...","from":"0xYour...","amount":"0.05"}' | base64)
glidepool advisor --pool 0x3d70... --goal "..." --payment-proof "$PROOF"
```

---

## Global Options

| Flag | Description |
|---|---|
| `--api <url>` | Override API URL for this command |
| `--json` | Output raw JSON (useful for scripting) |
| `--version` | Show CLI version |
| `--help` | Show help |

---

## Agent Strategies

| Strategy | Mode | Description |
|---|---|---|
| `conservative` | Static bins | Tight fixed range, low risk |
| `balanced` | Both (follows price) | Medium risk, adapts to price movement |
| `aggressive` | Right/Left (trend) | Higher exposure, follows price direction |

The agent server runs Claude Opus 4 on each cycle. It analyzes pool state (activeTick, TVL, reserves, price) against your goal and produces one of:
- **hold** — current position is optimal, no action needed
- **rebalance** — shift bin range, requires wallet signature
- **withdraw** — remove liquidity, requires wallet signature
- **add_liquidity** — add more liquidity, requires wallet signature
- **switch_mode** — change bin mode, requires wallet signature

All on-chain actions require your explicit wallet signature — the GlidePool server never holds your private keys.

## Requirements

- Node.js >= 18
- A running GlidePool API server

## License

MIT
