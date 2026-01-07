# AGENTS.md

This file contains guidelines and commands for agentic coding agents working in the Crab Sunset repository.

## Project Overview

Crab Sunset is a Node.js token holder snapshot system for Crab Network. It fetches token holder data from the Blockscout API and generates JSON snapshots with address annotations.

## Build/Development Commands

### Running Token Snapshots
```bash
# Token snapshots (wcrab, gcrab, ckton, wkton, gkton, xring, xwring, wcring)
npm run wcrab          # Wrapped CRAB example
npm run gcrab          # gCRAB example

# Other data sources
npm run native         # Native CRAB holders
npm run snow-lps       # Snow LP tokens
npm run evolution-land # Evolution Land tokens

# Batch operations
npm run fetch:all      # Fetch all tokens and data
npm run fix-cache      # Repair address cache
```

### Testing
This project does not have formal test suites. Test by running individual token commands and verifying output in the `data/` directory.

### Code Quality
No linting or formatting tools are currently configured. Agents should maintain consistent code style as documented below.

## Code Style Guidelines

### File Structure
- `bin/` - CLI entry points with shebang `#!/usr/bin/env node`
- `src/` - Core functionality modules
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
- **Files**: kebab-case (`fetch-token-holders.js`, `api.js`)
- **Functions**: camelCase (`fetchAllHolders`, `separateHoldersByType`)
- **Variables**: camelCase (`contractAddress`, `addressCache`)
- **Constants**: UPPER_SNAKE_CASE (`BASE_URL`, `CACHE_FILE`)
- **Classes**: Not used in this codebase (procedural style)

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
- Base URL: `https://crab-scan.darwinia.network/api`
- Always include `Accept: application/json` header
- Handle HTTP errors gracefully with null returns
- Cache address types to reduce API calls

### File I/O
- Use `fs.existsSync()` before reading files
- Create directories with `recursive: true` option
- Write JSON with `JSON.stringify(data, null, 2)` for readability
- Use `path.join()` and `path.resolve()` for cross-platform paths

### Caching Strategy
- Cache file: `data/.address_cache.json`
- Cache address types (contract vs EOA) to minimize API calls
- Load cache at startup, save after modifications
- Cache keys are lowercase addresses

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
   - Update `src/api.js` for endpoint changes
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
    - Call functions from `src/` modules

## Important Notes

- This is a data processing tool, not a web application
- All operations are synchronous from CLI perspective
- Output files are the primary deliverable
- Rate limiting is crucial to avoid API bans
- Cache significantly improves performance on subsequent runs
- All git operations (commit, push, etc.) must be handled by the user, not by agents