import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createOutlineDefinition } from "./outline.ts";

export default function (pi: ExtensionAPI): void {
  pi.registerTool(createOutlineDefinition());

  // System prompt: guide the agent on when to use ast_outline
  pi.on("before_agent_start", async (event, _ctx) => {
    return {
      systemPrompt:
        event.systemPrompt +
        `\n## AST outline\n` +
        `Use \`ast_outline\` to see the structure of source files (functions, classes, interfaces) ` +
        `without reading the full content. This is useful for:\n` +
        `  • Large files where you need to understand the layout first\n` +
        `  • Finding specific symbols quickly\n` +
        `  • Getting an overview before diving into details\n` +
        `Don't use it for small files or when you already know the structure. ` +
        `After seeing the outline, use \`read\` with offset/limit to focus on relevant sections.\n`,
    };
  });
}