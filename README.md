# Crab Sunset

Crab Sunset calculates RING airdrop distributions from on-chain holder snapshots across the Crab and Darwinia ecosystems. It fetches token holder data, applies group allocation rules, and writes a final `airdrop_results.json` for distribution.

For calculation details, see [`docs/airdrop_calculation.md`](docs/airdrop_calculation.md).

## Install and Run

Install dependencies and run the full snapshot + airdrop pipeline:

```bash
npm install
npm run airdrop:all
```

## Data Outputs

The pipeline writes the following JSON outputs under `data/`:

| File | Description |
|------|-------------|
| [`data/airdrop_results.json`](data/airdrop_results.json) | Final airdrop output with per-rule breakdowns and statistics. |
| [`data/CRAB_native.json`](data/CRAB_native.json) | Native CRAB holder snapshot (EOA + contract holders). |
| [`data/WCRAB_0x2D2b97EA380b0185e9fDF8271d1AFB5d2Bf18329.json`](data/WCRAB_0x2D2b97EA380b0185e9fDF8271d1AFB5d2Bf18329.json) | WCRAB holder snapshot. |
| [`data/gCRAB_0xdafa555e2785DC8834F4Ea9D1ED88B6049142999.json`](data/gCRAB_0xdafa555e2785DC8834F4Ea9D1ED88B6049142999.json) | gCRAB holder snapshot. |
| [`data/CKTON_0x0000000000000000000000000000000000000402.json`](data/CKTON_0x0000000000000000000000000000000000000402.json) | CKTON holder snapshot. |
| [`data/WCKTON_0x159933C635570D5042723359fbD1619dFe83D3f3.json`](data/WCKTON_0x159933C635570D5042723359fbD1619dFe83D3f3.json) | WCKTON holder snapshot. |
| [`data/gCKTON_0xB633Ad1142941CA2Eb9C350579cF88BbE266660D.json`](data/gCKTON_0xB633Ad1142941CA2Eb9C350579cF88BbE266660D.json) | gCKTON holder snapshot. |
| [`data/xRING_0x7399Ea6C9d35124d893B8d9808930e9d3F211501.json`](data/xRING_0x7399Ea6C9d35124d893B8d9808930e9d3F211501.json) | xRING holder snapshot (Crab). |
| [`data/xWRING_0x273131F7CB50ac002BDd08cA721988731F7e1092.json`](data/xWRING_0x273131F7CB50ac002BDd08cA721988731F7e1092.json) | xWRING holder snapshot (Crab). |
| [`data/xRING_xWRING_lp_providers.json`](data/xRING_xWRING_lp_providers.json) | xRING/xWRING Snow LP EOA providers with per-LP breakdowns (Crab). |
| [`data/WCRING_0xA3eE184ed6eA8fa276AfA282980f83A7091b1E8C.json`](data/WCRING_0xA3eE184ed6eA8fa276AfA282980f83A7091b1E8C.json) | WCRING holder snapshot. |
| [`data/xWCRAB_0x656567Eb75b765FC320783cc6EDd86bD854b2305.json`](data/xWCRAB_0x656567Eb75b765FC320783cc6EDd86bD854b2305.json) | xWCRAB holder snapshot (Darwinia). |
| [`data/CRAB_staking_rewards.json`](data/CRAB_staking_rewards.json) | CRAB staking reward balances. |
| [`data/CKTON_staking_rewards.json`](data/CKTON_staking_rewards.json) | CKTON staking reward balances. |
| [`data/CRAB_deposit_balance.json`](data/CRAB_deposit_balance.json) | CRAB deposit balances. |
| [`data/snow_lps_crab.json`](data/snow_lps_crab.json) | Crab Snow LP metadata + holders. |
| [`data/snow_lps_darwinia.json`](data/snow_lps_darwinia.json) | Darwinia Snow LP metadata + holders. |
| [`data/evolution_land_snapshot.json`](data/evolution_land_snapshot.json) | Evolution Land snapshot (FIRE/GOLD/WOOD/SIOO/HHO). |
| [`data/crab-cache.json`](data/crab-cache.json) | Crab address cache (contract vs EOA). |
| [`data/darwinia-cache.json`](data/darwinia-cache.json) | Darwinia address cache (contract vs EOA). |
