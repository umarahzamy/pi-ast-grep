import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";

const outlined = new Map<string, string>();

function isExecutable(path: string): boolean {
  try {
    execFileSync("test", ["-x", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function findOnPath(command: string): string | null {
  const pathDirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const names = process.platform === "win32"
    ? [command, ...(process.env.PATHEXT ?? ".EXE").split(";").map((ext) => `${command}${ext}`)]
    : [command];
  for (const dir of pathDirs) {
    for (const name of names) {
      const candidate = join(dir, name);
      if (isExecutable(candidate)) return candidate;
    }
  }
  return null;
}

function findFromToolManager(manager: string): string | null {
  const managerBin = findOnPath(manager);
  if (!managerBin) return null;
  try {
    const output = execFileSync(managerBin, ["which", "ast-grep"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    return output.split(/\r?\n/).map((line) => line.trim()).find(isExecutable) ?? null;
  } catch {
    return null;
  }
}

function findInNixProfiles(): string | null {
  const roots = [
    ...(process.env.NIX_PROFILES ?? "").split(/\s+/).filter(Boolean),
    join(homedir(), ".nix-profile"),
    "/nix/var/nix/profiles/default",
  ];
  return roots.map((root) => join(root, "bin", "ast-grep")).find(isExecutable) ?? null;
}

// Resolve the ast-grep binary once. No shell `which` dependency.
const SG = (() => {
  const configured = process.env.SG?.trim() || process.env.AST_GREP_BIN?.trim();
  if (configured) {
    if (isExecutable(configured)) return configured;
    const discovered = findOnPath(configured);
    if (discovered) return discovered;
  }
  return findOnPath("ast-grep") ?? findFromToolManager("mise") ?? findInNixProfiles();
})();

function expandPath(p: string): string {
  return p.startsWith("~") ? resolve(homedir(), p.slice(1)) : resolve(p);
}

/** Run `ast-grep outline <file>` and cache the result per absolute path. */
export function runOutline(abs: string): string | null {
  if (outlined.has(abs)) return outlined.get(abs) ?? null;
  if (!existsSync(abs)) return null;
  if (!SG) return null;
  try {
    const raw = execFileSync(SG, ["outline", abs], {
      timeout: 2000,
      encoding: "utf-8",
      maxBuffer: 64 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const lines = raw.split(/\r?\n/).filter((line) => line.trim() && line.trim() !== "nothing found");
    const hasSymbols = lines.some((line) => line.trim() !== abs);
    if (hasSymbols) {
      const outline = lines.join("\n");
      outlined.set(abs, outline);
      return outline;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const outlineSchema = Type.Object({
  path: Type.String({ description: "File path to outline" }),
});

export type OutlineInput = Type.Static<typeof outlineSchema>;

export interface OutlineDetails {
  outlineLength?: number;
}

export function createOutlineDefinition(): ToolDefinition<typeof outlineSchema, OutlineDetails> {
  return {
    name: "ast_outline",
    label: "AST outline",
    description: "Show the tree-sitter structure (top-level symbols) of a source file. Use after reading a file to see its shape without re-reading it.",
    promptSnippet: "AST outline: structural symbol tree of a source file (classes/functions)",
    promptGuidelines: [
      "Use ast_outline after reading a source file to see its structure instead of re-reading the whole file.",
      "Prefer ast_outline for structure; use lsp_diagnostics for compile/type errors.",
    ],
    parameters: outlineSchema,
    async execute(_id, params, _signal, _update, _ctx) {
      const abs = expandPath(params.path);
      if (!existsSync(abs)) {
        return { content: [{ type: "text", text: `File not found: ${abs}` }], isError: true, details: {} satisfies OutlineDetails };
      }
      const outline = runOutline(abs);
      if (!outline) {
        return { content: [{ type: "text", text: `No structural symbols found in ${abs}` }], details: {} satisfies OutlineDetails };
      }
      return { content: [{ type: "text", text: `[structure]\n${outline}` }], details: { outlineLength: outline.length } satisfies OutlineDetails };
    },
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      text.setText(
        theme.fg("toolTitle", theme.bold("ast_outline")) +
        " " +
        theme.fg("accent", args.path ?? "")
      );
      return text;
    },
  };
}