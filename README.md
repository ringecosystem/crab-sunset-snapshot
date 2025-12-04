# Crab Sunset 🦀🌅

Token holder snapshot system for Crab Network governance tokens.

## Features

- 📊 **Token Holder Tracking**: Fetch and track ERC-20 token holders
- 🔍 **Smart Contract Detection**: Separate contract holders from EOA holders
- 🏷️ **Address Annotations**: Automatic annotation of special addresses (Treasury, Snow LPs)
- 💾 **Caching System**: Reduce API calls with intelligent address caching
- 🔢 **BigInt Support**: Handle large token balances without scientific notation
- ⚡ **Native Token Support**: Track native CRAB token holders
- 🌊 **Snow LP Analysis**: Identify and analyze all Snow LP tokens

## Project Structure

```
crab-sunset/
├── bin/                    # CLI entry points
│   ├── fetch-token         # Fetch ERC-20 token holders
│   ├── fetch-native        # Fetch native CRAB holders
│   └── fetch-snow-lps      # Fetch Snow LP tokens
├── src/                    # Core functionality
│   ├── index.js            # Main exports
│   ├── api.js              # Blockscout API client
│   ├── cache.js            # Address caching system
│   ├── holders.js          # Holder fetching logic
│   ├── annotations.js      # Address annotation system
│   ├── fetch-token-holders.js
│   ├── fetch-native-holders.js
│   └── fetch-snow-lps.js
└── data/                   # Output directory for JSON snapshots

```

## Quick Start

### Install Dependencies

```bash
npm install
```

### Fetch Token Holders

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

# Fetch everything
npm run fetch:all
```

## Usage

### As CLI Tool

```bash
# Fetch any ERC-20 token
node bin/fetch-token <contract_address>

# Fetch native CRAB
node bin/fetch-native

# Fetch Snow LPs
node bin/fetch-snow-lps
```

### As Module

```javascript
const { fetchTokenHoldersSnapshot } = require('./src');

async function example() {
  const result = await fetchTokenHoldersSnapshot(
    '0x2D2b97EA380b0185e9fDF8271d1AFB5d2Bf18329',
    './data'
  );
  console.log(result);
}
```

## Output Format

### Token Snapshot (ERC-20)

```json
{
  "address": "0x...",
  "name": "Token Name",
  "symbol": "SYMBOL",
  "decimals": 18,
  "total_supply": "1000000000000000000000",
  "holders_count": 100,
  "contract_holders_count": 20,
  "eoa_holders_count": 80,
  "contract_holders": {
    "0x... (Snow LP contract)": "500000000000000000000",
    "0x... (Treasury contract)": "300000000000000000000"
  },
  "eoa_holders": {
    "0x...": "200000000000000000000"
  }
}
```

### Native Token Snapshot

```json
{
  "name": "CRAB",
  "symbol": "CRAB",
  "decimals": 18,
  "holders_count": 500,
  "contract_holders_count": 50,
  "eoa_holders_count": 450,
  "total_balance": "10000000000000000000000",
  "contract_holders": { ... },
  "eoa_holders": { ... }
}
```

### Snow LPs Snapshot

```json
{
  "timestamp": "2025-12-04T...",
  "chain": "Crab Network",
  "snow_lps_count": 32,
  "snow_lps": [
    {
      "address": "0x...",
      "name": "Snow LPs",
      "symbol": "SNOW-LP",
      "decimals": 18,
      "total_supply": "...",
      "holders_count": 11,
      "contract_holders_count": 3,
      "eoa_holders_count": 8,
      "lp_contract_balances": {
        "0x...": {
          "symbol": "WCRAB",
          "name": "Wrapped CRAB",
          "balance": "..."
        }
      },
      "contract_holders": { ... },
      "eoa_holders": { ... }
    }
  ]
}
```

## Address Annotations

Special addresses are automatically annotated:

- **Treasury Contract**: `0x6D6f646c64612f74727372790000000000000000`
- **Snow LP Contracts**: All detected Snow LP token contracts

Example output:
```
"0x6d6f646c64612f74727372790000000000000000 (Treasury contract)": "12568565..."
"0x05f0bc920a23d1662764907910b150c819c110aa (Snow LP contract)": "60854459..."
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
