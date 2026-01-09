# AGENTS.md

This file contains guidelines and commands for agentic coding agents working in the Crab Sunset repository.

## Project Overview

Crab Sunset is a Node.js token holder snapshot system for Crab and Darwinia Networks. It fetches token holder data from the Blockscout API and generates JSON snapshots with address annotations.

### Architecture Overview

**Token Snapshots:**
- Each token generates a JSON file with holder addresses and balances
- Holders are separated into contracts and EOAs
- Snow LP contracts are annotated in the holder list (e.g., `"0xaddr... (Snow LP)"`)
- Detailed LP holder data is available in network-specific snapshot files: `snow_lps_crab.json` and `snow_lps_darwinia.json`

**Snow LP Handling:**
- LP contracts are detected and annotated during token fetching
- Full LP holder details are stored separately in network-specific files
- Crab: `npm run snow-lps` → `snow_lps_crab.json`
- Darwinia: `npm run snow-lps-darwinia` → `snow_lps_darwinia.json`
- This separation keeps token files clean while preserving LP data access

## Build/Development Commands

### Running Token Snapshots
```bash
# Crab Network tokens
npm run wcrab          # Wrapped CRAB
npm run gcrab          # gCRAB
npm run ckton          # CKTON
npm run wkton          # WKTON
npm run gkton          # gCKTON
npm run xring          # xRING
npm run xwring         # xWRING
npm run wcring         # WCRING

# Darwinia Network tokens
npm run xwcrab         # xWCRAB

# Other data sources
npm run native         # Native CRAB holders
npm run snow-lps       # Crab Snow LP tokens (→ snow_lps_crab.json)
npm run snow-lps-darwinia  # Darwinia Snow LP tokens (→ snow_lps_darwinia.json)
npm run evolution-land # Evolution Land tokens

# Batch operations
npm run fetch:crab     # Fetch all Crab network data
npm run fetch:darwinia # Fetch all Darwinia network data
npm run fetch:all      # Fetch all tokens and data from both networks
npm run fix-cache      # Repair both Crab and Darwinia address caches
npm run airdrop        # Calculate RING airdrop distribution based on holder snapshots
```

### Testing
This project does not have formal test suites. Test by running individual token commands and verifying output in the `data/` directory.

### Code Quality
No linting or formatting tools are currently configured. Agents should maintain consistent code style as documented below.

## Code Style Guidelines

### File Structure
- `bin/` - CLI entry points with shebang `#!/usr/bin/env node`
- `src/` - Core functionality modules organized by purpose:
  - `src/base/` - Base classes for API, cache, holders, and annotations
  - `src/crab/` - Crab Network specific implementations
  - `src/darwinia/` - Darwinia Network specific implementations
  - `src/special/` - Special data fetchers (native, evolution-land, snow-lps)
- `src/special/rules/` - Airdrop calculation rules
- `data/` - JSON snapshot outputs and cache files

### CLI Entry Points
- Use `#!/usr/bin/env node` shebang
- Access arguments via `process.argv[2]` onwards
- Exit with `process.exit(1)` on fatal errors
- Use `console.error()` for error messages

### Module System
- Use CommonJS (`require`/`module.exports`)
- Destructure imports when multiple functions needed: `const { func1, func2 } = require('./module');`
- Export objects with descriptive property names

### Naming Conventions
- **Files**: kebab-case (`fetch-token.js`, `api.js`)
- **Directories**: kebab-case (`crab/`, `darwinia/`, `special/`)
- **Functions**: camelCase (`fetchAllHolders`, `separateHoldersByType`)
- **Variables**: camelCase (`contractAddress`, `addressCache`)
- **Constants**: UPPER_SNAKE_CASE (`BASE_URL`, `CACHE_FILE`)
- **Classes**: PascalCase (e.g., `CrabAPI`, `BaseAPI`, `BaseCache`)

### Code Formatting
- **Indentation**: Tabs (not spaces)
- **Line endings**: LF
- **Max line length**: Not strictly enforced, but keep readable
- **Semicolons**: Required
- **Quotes**: Single quotes for strings, double quotes for JSON output

### Error Handling
- API calls: Return `null` on failure, use `try/catch`
- File operations: Warn with `console.warn()` but continue, return empty objects
- CLI errors: Use `console.error()` + `process.exit(1)`
- HTTP errors: Check `response.ok` before parsing JSON

### Async/Await Patterns
- Always use `async/await` for asynchronous operations
- Add rate limiting: `await new Promise((r) => setTimeout(r, 200));`
- Progress indicators: `process.stdout.write(\rProcessing...); process.stdout.write(\n);`

### Console Output Style
- Use emojis for status: `✅` success, `⚠️` warning, `❌` error, `📊` info, `💾` save
- Include context in messages: `✅ Fetched ${count} holders`
- Use `\r` for progress updates that overwrite the same line

### Data Handling
- Store token balances as strings to avoid scientific notation
- Use `BigInt()` for balance comparisons and sorting
- Normalize addresses to lowercase for caching and annotations
- Sort holders by balance (descending) using `BigInt` comparison

### API Integration
- Crab Network Base URL: `https://crab-scan.darwinia.network/api`
- Darwinia Network Base URL: `https://explorer.darwinia.network/api`
- Always include `Accept: application/json` header
- Handle HTTP errors gracefully with null returns
- Network-specific API logic is in `src/crab/api.js` and `src/darwinia/api.js`
- Cache address types to reduce API calls

### File I/O
- Use `fs.existsSync()` before reading files
- Create directories with `recursive: true` option
- Write JSON with `JSON.stringify(data, null, 2)` for readability
- Use `path.join()` and `path.resolve()` for cross-platform paths

### Caching Strategy
- Crab cache file: `data/crab-cache.json`
- Darwinia cache file: `data/darwinia-cache.json`
- Cache address types (contract vs EOA) to minimize API calls
- Load cache at startup, save after modifications
- Cache keys are lowercase addresses
- Each network has its own cache to avoid conflicts

### Annotation System
- Special addresses defined in constants
- Load dynamic annotations from snapshot files
- Apply annotations using lowercase address matching
- Format: `address (annotation)` in output

## Development Workflow

1. **Adding New Tokens**: 
   - Add npm script in `package.json`
   - Use token contract address as parameter
   - Follow naming pattern: `npm run <symbol>`

2. **Modifying API Logic**:
   - Update network-specific API classes in `src/crab/api.js` or `src/darwinia/api.js`
   - For shared functionality, update base classes in `src/base/`
   - Maintain backward compatibility
   - Add error handling for new fields

3. **Cache Management**:
    - Cache structure: `{ address: boolean }` (contract = true)
    - Use `loadCache()` and `saveCache()` utilities
    - Cache is automatically updated during address type checks

4. **Creating New CLI Scripts**:
    - Create file in `bin/` directory without `.js` extension
    - Make executable: `chmod +x bin/script-name`
    - Add shebang and argument validation
    - Call functions from network-specific modules in `src/crab/`, `src/darwinia/`, or `src/special/`

## Airdrop Calculation

### Overview
The airdrop calculation system distributes RING tokens to Crab ecosystem holders based on defined distribution rules.

### Distribution Model
| Token Group | Allocation | Description |
|-------------|------------|-------------|
| CRAB Group | 60% | CRAB + WCRAB + gCRAB + xWCRAB |
| CKTON Group | 20% | CKTON + WCKTON + gCKTON |
| Evolution Land | 15% | (Future implementation) |
| Reserve | 5% | (Future use) |

### Rule System
Rules are implemented as classes extending `BaseAirdropRule`:
- `src/special/rules/base-rule.js` - Abstract base class
- `src/special/rules/crab-group-rule.js` - CRAB Group rule (60%)
- `src/special/rules/ckton-group-rule.js` - CKTON Group rule (20%)

Each rule:
1. Loads holder data from JSON files in `data/`
2. Filters for EOA addresses using network caches
3. Aggregates balances per address
4. Calculates proportional airdrop allocation

### Adding New Rules
1. Create new rule class in `src/special/rules/`
2. Extend `BaseAirdropRule`
3. Implement `calculate()` method
4. Register in `src/special/rules/index.js`

### Output
- File: `data/airdrop_snapshot.json`
- Contains: recipients, breakdown per rule, statistics, timestamp

### Usage
```bash
# Run after fetching all data
npm run fetch:all
npm run airdrop
```

- This is a data processing tool, not a web application
- All operations are synchronous from CLI perspective
- Output files are the primary deliverable
- Rate limiting is crucial to avoid API bans
- Cache significantly improves performance on subsequent runs
- All git operations (commit, push, etc.) must be handled by the user, not by agents