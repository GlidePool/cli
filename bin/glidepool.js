#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { homedir } = require('os');
const { join } = require('path');

const pkg = require('../package.json');

// ─────────────────────────────────────────
// Config
// ─────────────────────────────────────────
const CONFIG_DIR = join(homedir(), '.glidepool');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return {};
  try { return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}

function saveConfig(data) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

function getApiUrl(opts) {
  const url = opts.api || process.env.GLIDEPOOL_API_URL || loadConfig().apiUrl;
  if (!url) {
    console.error('Error: API URL not set.\n  Run: glidepool config set-api <url>\n  Or:  export GLIDEPOOL_API_URL=https://api.glidepool.xyz');
    process.exit(1);
  }
  return url.replace(/\/$/, '');
}

// ─────────────────────────────────────────
// HTTP helper (native fetch, Node 18+)
// ─────────────────────────────────────────
async function apiFetch(apiUrl, path, options = {}) {
  const url = `${apiUrl}${path}`;
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch (e) {
    console.error(`Network error: ${e.message}`);
    process.exit(1);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 402) {
      console.error('\n[402] Payment Required');
      console.error(`  Amount:    ${data.amount || '0.05'} ${data.currency || 'USDC'}`);
      console.error(`  Recipient: ${data.recipient}`);
      console.error(`  Token:     ${data.token}`);
      console.error(`  Network:   Base Mainnet\n`);
      console.error('  Send USDC to recipient on Base, then retry with:');
      console.error('  --payment-proof <base64(JSON{txHash,from,amount})>');
      process.exit(2);
    }
    console.error(`API error (${res.status}): ${data.message || data.error || 'Unknown error'}`);
    process.exit(1);
  }
  return data;
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

function printTable(rows, columns) {
  if (!rows.length) return;
  const widths = columns.map(c =>
    Math.max(c.label.length, ...rows.map(r => String(r[c.key] ?? '').length))
  );
  console.log(columns.map((c, i) => c.label.padEnd(widths[i])).join('  '));
  console.log(widths.map(w => '-'.repeat(w)).join('  '));
  rows.forEach(row =>
    console.log(columns.map((c, i) => String(row[c.key] ?? '').padEnd(widths[i])).join('  '))
  );
}

// ─────────────────────────────────────────
// CLI
// ─────────────────────────────────────────
const program = new Command();

program
  .name('glidepool')
  .description('CLI for GlidePool — autonomous DLMM agent platform on Base Mainnet')
  .version(pkg.version)
  .option('--api <url>', 'GlidePool API URL (or set GLIDEPOOL_API_URL)')
  .option('--json', 'Output raw JSON');

// ── config ──────────────────────────────
const configCmd = program.command('config').description('Manage CLI configuration');

configCmd
  .command('set-api <url>')
  .description('Save API URL to ~/.glidepool/config.json')
  .action((url) => {
    const cfg = loadConfig();
    cfg.apiUrl = url.replace(/\/$/, '');
    saveConfig(cfg);
    console.log(`Saved: ${cfg.apiUrl}`);
  });

configCmd
  .command('show')
  .description('Show current config (~/.glidepool/config.json)')
  .action(() => { printJson({ configFile: CONFIG_FILE, ...loadConfig() }); });

// ── pools ───────────────────────────────
const poolsCmd = program.command('pools').description('List and inspect Maverick V2 pools');

poolsCmd
  .command('list')
  .description('List all supported pools with live TVL, price, and fee rate')
  .action(async () => {
    const api = getApiUrl(program.opts());
    const data = await apiFetch(api, '/api/pools');
    if (program.opts().json) { printJson(data); return; }
    printTable(data, [
      { key: 'tokenASymbol', label: 'A' },
      { key: 'tokenBSymbol', label: 'B' },
      { key: 'tvlUsd',       label: 'TVL USD' },
      { key: 'currentPrice', label: 'PRICE' },
      { key: 'feeRate',      label: 'FEE' },
      { key: 'poolAddress',  label: 'ADDRESS' },
    ]);
  });

poolsCmd
  .command('get <address>')
  .description('Get details for a specific pool')
  .action(async (address) => {
    const api = getApiUrl(program.opts());
    printJson(await apiFetch(api, `/api/pools/${address}`));
  });

// ── agent ────────────────────────────────
const agentCmd = program.command('agent').description('Create and manage autonomous agents');

agentCmd
  .command('create')
  .description('Deploy a new autonomous DLMM agent')
  .requiredOption('--wallet <address>', 'Wallet address (0x...)')
  .requiredOption('--pool <address>', 'Maverick V2 pool address')
  .option('--strategy <s>', 'conservative | balanced | aggressive', 'balanced')
  .option('--budget <usdc>', 'Max USDC budget', '100')
  .option('--interval <sec>', 'Analysis interval in seconds (min 30)', '60')
  .action(async (opts) => {
    const api = getApiUrl(program.opts());
    const data = await apiFetch(api, '/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        userAddress: opts.wallet,
        poolAddress: opts.pool,
        strategy: opts.strategy,
        budgetUsdc: Number(opts.budget),
        analysisIntervalSec: Number(opts.interval),
      }),
    });
    if (program.opts().json) { printJson(data); return; }
    console.log('\nAgent deployed');
    console.log(`  ID:       ${data.id}`);
    console.log(`  Pool:     ${data.poolAddress}`);
    console.log(`  Strategy: ${data.strategy}`);
    console.log(`  Budget:   ${data.budgetUsdc} USDC`);
    console.log(`  Status:   ${data.status}`);
    console.log(`\nView actions: glidepool agent actions ${data.id}`);
  });

agentCmd
  .command('list')
  .description('List all agents for a wallet')
  .requiredOption('--wallet <address>', 'Wallet address (0x...)')
  .action(async (opts) => {
    const api = getApiUrl(program.opts());
    const data = await apiFetch(api, `/api/agents?userAddress=${encodeURIComponent(opts.wallet)}`);
    if (program.opts().json) { printJson(data); return; }
    if (!data.length) { console.log('No agents found.'); return; }
    printTable(data, [
      { key: 'id',             label: 'AGENT ID' },
      { key: 'poolAddress',    label: 'POOL' },
      { key: 'strategy',       label: 'STRATEGY' },
      { key: 'budgetUsdc',     label: 'BUDGET' },
      { key: 'status',         label: 'STATUS' },
      { key: 'lastAnalysisAt', label: 'LAST ANALYSIS' },
    ]);
  });

agentCmd
  .command('get <agentId>')
  .description('Get details for a specific agent')
  .action(async (agentId) => {
    const api = getApiUrl(program.opts());
    printJson(await apiFetch(api, `/api/agents/${agentId}`));
  });

agentCmd
  .command('pause <agentId>')
  .description('Pause a running agent')
  .action(async (agentId) => {
    const api = getApiUrl(program.opts());
    await apiFetch(api, `/api/agents/${agentId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'paused' }) });
    console.log(`Agent ${agentId} paused.`);
  });

agentCmd
  .command('resume <agentId>')
  .description('Resume a paused agent')
  .action(async (agentId) => {
    const api = getApiUrl(program.opts());
    await apiFetch(api, `/api/agents/${agentId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'active' }) });
    console.log(`Agent ${agentId} resumed.`);
  });

agentCmd
  .command('stop <agentId>')
  .description('Stop an agent permanently')
  .action(async (agentId) => {
    const api = getApiUrl(program.opts());
    await apiFetch(api, `/api/agents/${agentId}/status`, { method: 'PUT', body: JSON.stringify({ status: 'stopped' }) });
    console.log(`Agent ${agentId} stopped.`);
  });

agentCmd
  .command('actions <agentId>')
  .description('Show LLM decisions stored in the database')
  .option('--limit <n>', 'Number of actions', '10')
  .action(async (agentId, opts) => {
    const api = getApiUrl(program.opts());
    const data = await apiFetch(api, `/api/agents/${agentId}/actions?limit=${opts.limit}`);
    if (program.opts().json) { printJson(data); return; }
    if (!data.length) { console.log('No actions yet. Agent analyzes on its next cycle.'); return; }
    data.forEach((a) => {
      const ts = new Date(a.createdAt).toLocaleTimeString();
      const rec = a.llmRecommendation;
      console.log(`\n[${ts}] ${a.actionType.toUpperCase()}  status=${a.status}`);
      if (rec && rec.riskLevel) console.log(`  Risk:    ${rec.riskLevel}`);
      if (a.llmReasoning) console.log(`  Reason:  ${String(a.llmReasoning).slice(0, 180)}...`);
      if (rec && rec.recommendation && rec.recommendation.suggestedBinRange) {
        const r = rec.recommendation.suggestedBinRange;
        console.log(`  Bins:    lower=${r.lowerTick}  upper=${r.upperTick}`);
      }
      if (a.txHash) console.log(`  TX:      ${a.txHash}`);
    });
  });

// ── positions ────────────────────────────
program
  .command('positions <walletAddress>')
  .description('List Maverick V2 LP positions for a wallet on Base Mainnet')
  .action(async (walletAddress) => {
    const api = getApiUrl(program.opts());
    const data = await apiFetch(api, `/api/positions/${walletAddress}`);
    if (program.opts().json) { printJson(data); return; }
    if (!data.length) { console.log('No Maverick V2 positions found.'); return; }
    printTable(data, [
      { key: 'nftId',        label: 'NFT ID' },
      { key: 'tokenASymbol', label: 'TOKEN A' },
      { key: 'tokenBSymbol', label: 'TOKEN B' },
      { key: 'valueUsd',     label: 'VALUE USD' },
      { key: 'amountA',      label: 'AMOUNT A' },
      { key: 'amountB',      label: 'AMOUNT B' },
      { key: 'binCount',     label: 'BINS' },
    ]);
  });

// ── advisor ──────────────────────────────
program
  .command('advisor')
  .description('Get Claude Opus 4 AI recommendation for a pool position')
  .requiredOption('--pool <address>', 'Pool address')
  .requiredOption('--goal <text>', 'Your liquidity goal')
  .option('--nft <id>', 'NFT ID for existing position analysis')
  .option('--payment-proof <base64>', 'x402 payment proof (if server requires payment)')
  .action(async (opts) => {
    const api = getApiUrl(program.opts());
    const qs = new URLSearchParams({ poolAddress: opts.pool, userGoal: opts.goal });
    if (opts.nft) qs.set('nftId', opts.nft);
    const headers = {};
    if (opts.paymentProof) headers['x-payment-proof'] = opts.paymentProof;
    const data = await apiFetch(api, `/api/advisor?${qs}`, { headers });
    if (program.opts().json) { printJson(data); return; }
    const rec = data.recommendation || {};
    console.log('\n── AI Advisor ──────────────────────────');
    console.log(`  Action:   ${(rec.action || '').toUpperCase()}`);
    console.log(`  Risk:     ${data.riskLevel}`);
    console.log(`  Summary:  ${data.summary}`);
    if (rec.suggestedBinRange) {
      console.log(`  Bins:     lower=${rec.suggestedBinRange.lowerTick}  upper=${rec.suggestedBinRange.upperTick}`);
    }
    if (rec.suggestedWithdrawPercent) {
      console.log(`  Withdraw: ${rec.suggestedWithdrawPercent}%`);
    }
    if (rec.reasoning) {
      console.log(`\n  Reasoning:\n  ${rec.reasoning}`);
    }
  });

program.parse(process.argv);
