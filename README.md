# pi-ast-grep

> **⚠️ Vibecoded toy - don't trust it.**
>
> AST outline integration for Pi. Shows tree-sitter structure of source files after reading them.

## What it does

- Registers `ast_outline` tool for explicit structural queries
- Hooks into Pi's `tool_result` event after `read` calls
- Runs `ast-grep outline` to extract top-level symbols (functions, classes, etc.)
- Notifies the model with file structure so it understands shape without re-reading
- Caches outlines per session to avoid redundant parsing

## Install

```bash
pi install git:github.com/umarahzamy/pi-ast-grep
```

## Dev

```bash
npm install
npm run typecheck
npm test
```

## License

MIT
