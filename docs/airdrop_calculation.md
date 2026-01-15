# Airdrop Calculation Guide

This document explains how the airdrop calculation pipeline works, from snapshot collection to the final `airdrop_results.json` output. It covers the three rules (CRAB group, CKTON group, Evolution Land), the exclusion rules, LP virtual balances, and how allocations are derived.

## 1) Snapshot Data Pipeline

The airdrop calculation depends on a set of snapshot files in `data/`. These are produced by the snapshot CLI commands. The standard workflow is:

```bash
npm run snapshot
```

This command calls the individual fetchers listed below and writes the JSON snapshots used by the rules.

### Core Snapshot Sources

- Token holder snapshots (Crab network): `data/<SYMBOL>_<ADDRESS>.json` via `bin/fetch-crab` and `src/crab/fetch-token.js`.
- Token holder snapshots (Darwinia network): `data/<SYMBOL>_<ADDRESS>.json` via `bin/fetch-darwinia` and `src/darwinia/fetch-token.js`.
- Native CRAB holders: `data/CRAB_native.json` via `bin/fetch-native` and `src/special/native-holders.js`.
- Evolution Land snapshot: `data/evolution_land_snapshot.json` via `bin/fetch-evolution-land` and `src/special/evolution-land.js`.
- Snow LP snapshot: `data/snow_lps_crab.json` and `data/snow_lps_darwinia.json` via `bin/fetch-snow-lps` and `src/special/snow-lps.js`.

### Snapshot Contents

Each snapshot file has a common structure:

- `eoa_holders`: map of EOA address → balance (string)
- `contract_holders`: map of contract address → balance (string)
- Summary fields like `total_supply`, `holders_count`, and `decimals`

The airdrop rules always **use EOAs only** (contracts are excluded using address caches).

## 2) Treasury Balance and Distribution

The main entry point is `src/special/airdrop-calculation.js`.

1. The on-chain RING treasury balance is fetched from Darwinia using `DARWINIA_RPC_URL` and `TREASURY_ADDRESS`.
2. Allocation percentages are applied:
   - CRAB group: 60%
   - CKTON group: 20%
   - Evolution Land: 15%
   - Reserve: 5% (assigned to the treasury address)
3. These allocations are used as per-rule budgets for proportional distribution.

## 3) Exclusions and Address Normalization

Before aggregation, the following addresses are excluded globally (`EXCLUDED_RECIPIENTS` plus all Snow LP contract addresses):

- `0xb633ad1142941ca2eb9c350579cf88bbe266660d` (CKTON treasury)
- `0x6d6f646c64612f74727372790000000000000000` (treasury placeholder)
- All LP token addresses from `data/snow_lps_crab.json`

All addresses are normalized to lowercase. Annotated addresses such as `0x... (Snow LP)` are stripped and normalized.

## 4) Base Proportional Calculation

All rules extend `src/special/rules/base-rule.js`. The key helper is:

- `calculateProportionalAirdrop(balances, allocation)`
  - Computes `totalSupply = sum(balances)`
  - For each address:
    - `proportion = balance / totalSupply` (decimal string)
    - `amount = floor(balance * allocation / totalSupply)`

This `amount` is the **raw token unit** (18 decimals). All rounding is floor division.

## 5) CRAB Group Rule (60%)

Implemented in `src/special/rules/crab-group-rule.js`.

### Inputs (EOA Only)

The CRAB group aggregates the following sources:

- `CRAB_native.json` (native CRAB holders)
- `WCRAB` snapshot
- `gCRAB` snapshot
- `WCRING` snapshot
- `xWCRAB` snapshot (Darwinia)
- LP virtual balances from `snow_lps_crab.json`
  - `virtual_crab`, `virtual_wcrab`, `virtual_gcrab`, `virtual_xwcrab`, `virtual_wcring`
- Rewards and extras
  - `CRAB_staking_rewards.json`
  - `CKTON_staking_rewards.json`
  - `CRAB_deposit_balance.json`
- CKTON treasury add-on
  - Uses the CKTON group balance distribution as weights to distribute the CKTON treasury CRAB balance back into CRAB group totals.

### CKTON Treasury Add-on

The CKTON treasury address holds a CRAB balance on-chain. That balance is distributed proportionally to CKTON group holders and **added to their CRAB group balance**. This creates a bridge between CKTON holders and CRAB allocation.

### Output Breakdown Fields

Each recipient breakdown includes:

- `group_balance`: sum of all CRAB group components
- Each component balance (e.g. `crab_balance`, `virtual_crab_from_lp`, `crab_staking_rewards`)
- `virtual_from_ckton_treasury` containing the treasury CRAB portion

The CRAB rule uses the aggregated balances to calculate `airdrop_amount` via the base proportional helper.

## 6) CKTON Group Rule (20%)

Implemented in `src/special/rules/ckton-group-rule.js`.

### Inputs (EOA Only)

The CKTON group aggregates:

- `CKTON` snapshot
- `WCKTON` snapshot
- `gCKTON` snapshot
- LP virtual balances from `snow_lps_crab.json`
  - `virtual_ckton`, `virtual_wckton`, `virtual_gckton`

CKTON treasury addresses are excluded from this rule.

### Output Breakdown Fields

Each recipient breakdown includes:

- `group_balance`: sum of CKTON + WCKTON + gCKTON + virtual balances
- Per-token balances and virtual balances

The CKTON rule then distributes its allocation proportionally.

## 7) Evolution Land Rule (15%)

Implemented in `src/special/rules/evolution-land-rule.js`.

### Inputs

- `data/evolution_land_snapshot.json` containing the 5 land tokens: `FIRE`, `GOLD`, `WOOD`, `SIOO`, `HHO`.

### Allocation Strategy

- The 15% allocation is split evenly across the five lands.
- If there is a remainder from division by 5, it is added to the first land (`FIRE`).

### Per-Land Distribution

Each land performs a proportional distribution against its own EOA balances.
Per-recipient land details are stored under:

```
breakdown.evolution_land.land_breakdown.<LAND>
```

Each land entry includes:

- `balance`
- `proportion`
- `amount`

The total evolution land amount for a recipient is the sum of the five land allocations.

## 8) Output Structure

The final output is written to `data/airdrop_results.json`:

- `distribution`: treasury split per group
- `rules_applied`: rule metadata + total supplies
- `statistics`:
  - total recipients
  - total airdrop distributed
  - top 20 recipients
  - `airdrop_amount_ranges` (log-scale buckets)
  - per-rule supply metadata
- `recipients`: map of address → airdrop breakdown

Each recipient includes:

- `total_airdrop` (raw)
- `total_airdrop_decimal` (human units)
- `breakdown` per rule

## 9) Rounding and Decimals

- All balances and allocations are stored as **raw integers** (18 decimals).
- Proportions are stored as decimal strings for readability.
- Airdrop amounts are computed using integer division (`floor`).

## 10) Validation and Tests

The Jest test suite (`npm run airdrop:test`) validates:

- Recipients are EOAs (not contracts)
- Group total supplies match snapshot sums + virtual balances
- Per-recipient breakdowns match expected proportional allocations
- Rounding tolerances for aggregation totals
- Funding coverage for xRING + xWRING airdrops
- Airdrop range summaries cover all recipients

This ensures the output is consistent with the input snapshots and rule definitions.
