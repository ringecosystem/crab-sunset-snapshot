# Crab Sunset 🦀🌅

Token holder snapshot system for Crab chain.

## Project Structure

```
crab-sunset/
├── bin/                    # CLI entry points
│   ├── fetch-token         # Fetch ERC-20 token holders
│   ├── fetch-native        # Fetch native CRAB holders
│   ├── fetch-snow-lps      # Fetch Snow LP tokens
│   └── fetch-evolution-land# Fetch Evolution Land tokens
├── src/                    # Core functionality
│   ├── index.js            # Main exports
│   ├── api.js              # Blockscout API client
│   ├── cache.js            # Address caching system
│   ├── holders.js          # Holder fetching logic
│   ├── annotations.js      # Address annotation system
│   ├── fetch-token-holders.js
│   ├── fetch-native-holders.js
│   ├── fetch-snow-lps.js
│   └── fetch-evolution-land.js
└── data/                   # Output directory for JSON snapshots

```

## Usage

```bash
# Fetch specific tokens
npm run wcrab    # Wrapped CRAB
npm run gcrab    # gCRAB
npm run ckton    # CKTON
npm run wkton    # Wrapped CKTON
npm run gkton    # gCKTON
npm run xring    # xRING
npm run xwring   # xWRING
npm run wcring   # WCRING

# Fetch native CRAB
npm run native

# Fetch all Snow LP tokens
npm run snow-lps

# Fetch all Evolution Land tokens
npm run evolution-land

# Fetch everything
npm run fetch:all
```

## Configuration

### Tracked Tokens

The system tracks the following tokens:

| Symbol | Name | Address |
|--------|------|---------|
| WCRAB | Wrapped CRAB | `0x2D2b97EA380b0185e9fDF8271d1AFB5d2Bf18329` |
| gCRAB | gCRAB | `0xdafa555e2785DC8834F4Ea9D1ED88B6049142999` |
| CKTON | Crab Commitment Token | `0x0000000000000000000000000000000000000402` |
| WCKTON | Wrapped CKTON | `0x159933C635570D5042723359fbD1619dFe83D3f3` |
| gCKTON | gCKTON | `0xB633Ad1142941CA2Eb9C350579cF88BbE266660D` |
| xRING | xRING | `0x7399Ea6C9d35124d893B8d9808930e9d3F211501` |
| xWRING | xWRING | `0x273131F7CB50ac002BDd08cA721988731F7e1092` |
| WCRING | Wrapped CRing | `0xA3eE184ed6eA8fa276AfA282980f83A7091b1E8C` |

### API Endpoint

Blockscout API: `https://crab-scan.darwinia.network/api`

## Caching

The system uses a `.address_cache.json` file to cache address types (contract vs EOA), significantly reducing API calls on subsequent runs.

## License

MIT
