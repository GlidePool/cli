# @glide-pool/cli

Terminal CLI for GlidePool — autonomous DLMM agent platform on Base Mainnet.

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
glidepool config set-api <url>   # save API URL
glidepool config show            # show current config
```

### `glidepool pools`

```bash
# list all supported Maverick V2 pools
glidepool pools list

# TOKEN A  TOKEN B  TVL USD    PRICE   FEE     ADDRESS
# -------  -------  ---------  ------  ------  ----------
# WETH     USDC     21311.00   0.0004  0.0015  0x3d70...
# DAI      USDC     64203.00   0.9998  0.0000  0x1a2b...

# get a specific pool
glidepool pools get 0x3d70b2f31f75dc84acdd5e1588695221959b2d37

# all commands accept --json for raw JSON output
glidepool pools list --json
```

### `glidepool agent`

```bash
# deploy a new autonomous agent
glidepool agent create \
  --wallet 0xYourWallet \
  --pool 0x3d70b2f31f75dc84acdd5e1588695221959b2d37 \
  --strategy balanced \
  --budget 100 \
  --interval 60

# Agent deployed
#   ID:       4df9a63d-30eb-4885-87fc-f44f98baadbe
#   Pool:     0x3d70b2f31f75dc84acdd5e1588695221959b2d37
#   Strategy: balanced
#   Budget:   100 USDC
#   Status:   active

# list agents for a wallet
glidepool agent list --wallet 0xYourWallet

# get a single agent
glidepool agent get <agentId>

# control lifecycle
glidepool agent pause  <agentId>
glidepool agent resume <agentId>
glidepool agent stop   <agentId>

# view LLM decisions (last 10 by default)
glidepool agent actions <agentId>
glidepool agent actions <agentId> --limit 20

# [03:31:28] HOLD  status=completed
#   Risk:    high
#   Reason:  Pool reserves are low, price is volatile. Holding current position.
#
# [03:32:00] REBALANCE  status=pending_signature
#   Risk:    medium
#   Bins:    lower=-5  upper=5
```

### `glidepool positions`

```bash
glidepool positions 0xYourWallet

# NFT ID  TOKEN A  TOKEN B  VALUE USD  AMOUNT A  AMOUNT B  BINS
# ------  -------  -------  ---------  --------  --------  ----
# 1234    WETH     USDC     523.40     0.150000  285.2200  3
```

### `glidepool advisor`

```bash
# get Claude Opus 4 analysis for a pool
glidepool advisor \
  --pool 0x3d70b2f31f75dc84acdd5e1588695221959b2d37 \
  --goal "maximize fee income with minimal impermanent loss"

# analyze an existing position
glidepool advisor \
  --pool 0x3d70b2f31f75dc84acdd5e1588695221959b2d37 \
  --goal "should I rebalance or hold?" \
  --nft 1234

# output:
# AI Advisor
#   Action:   HOLD
#   Risk:     low
#   Summary:  Pool is healthy. Current price is centered in your bin range.
#
#   Reasoning:
#   The active tick is within the optimal range. Fee generation is consistent.
#   No rebalance needed. Monitor for price drift above tick 150.
```

**x402 payments:** If the server requires a micropayment (`X402_ENABLED=true`), the CLI shows the payment details and stops. Send the USDC on Base, then retry with a proof:

```bash
PROOF=$(echo '{"txHash":"0x...","from":"0xYour...","amount":"0.05"}' | base64)
glidepool advisor --pool 0x3d70... --goal "..." --payment-proof "$PROOF"
```

## Global Options

| Flag | Description |
|---|---|
| `--api <url>` | Override API URL for this command |
| `--json` | Output raw JSON (useful for scripting) |
| `--version` | Show CLI version |
| `--help` | Show help |

## Agent Strategies

| Strategy | Mode | Description |
|---|---|---|
| `conservative` | Static bins | Tight fixed range, low risk |
| `balanced` | Both (follows price) | Medium risk, adapts to price movement |
| `aggressive` | Right or Left (trend) | Higher exposure, follows price direction |

The agent server runs Claude Opus 4 on each cycle. It analyzes pool state against your goal and produces one of these actions:

- **hold** — position is optimal, no action needed
- **rebalance** — shift bin range, requires your wallet signature
- **withdraw** — remove liquidity, requires your wallet signature
- **add_liquidity** — add more liquidity, requires your wallet signature
- **switch_mode** — change bin mode, requires your wallet signature

All on-chain actions require your explicit wallet signature. GlidePool never holds private keys.

## Requirements

- Node.js 18 or later
- A running GlidePool API server

## License

MIT
