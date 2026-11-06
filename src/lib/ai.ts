import "server-only";

/**
 * Minimal Claude API client using tool calls to get reliable structured JSON back.
 * Model names change over time, so each job lists a preferred model and fallbacks;
 * ANTHROPIC_MODEL_VISION / ANTHROPIC_MODEL_FAST in Vercel override them.
 */
const VISION = [process.env.ANTHROPIC_MODEL_VISION, "claude-sonnet-5-5", "claude-sonnet-5", "claude-sonnet-4-6"].filter(Boolean) as string[];
const FAST = [process.env.ANTHROPIC_MODEL_FAST, "claude-haiku-5-5", "claude-haiku-4-5"].filter(Boolean) as string[];

export class AIError extends Error {}

type Tool = { name: string; description: string; input_schema: Record<string, unknown> };
type Block =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

export async function askClaude<T>(opts: { job: "vision" | "fast"; system: string; content: Block[]; tool: Tool; maxTokens?: number }): Promise<T> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AIError("AI isn’t switched on yet. Add ANTHROPIC_API_KEY in Vercel.");
  const models = opts.job === "vision" ? VISION : FAST;
  let lastError = "";
  for (const model of models) {
    // Newer models reject a forced tool choice; ask with "auto" first, then fall back to forcing it.
    for (const choice of [{ type: "auto" }, { type: "tool", name: opts.tool.name }]) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model, max_tokens: opts.maxTokens ?? 16000,
          system: `${opts.system}\n\nAlways reply by calling the ${opts.tool.name} tool exactly once with the complete result. Do not reply with plain text.`,
          tools: [opts.tool], tool_choice: choice,
          messages: [{ role: "user", content: opts.content }],
        }),
      });
      if (res.status === 404) { lastError = `model ${model} not available`; break; } // try the next model name
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg: string = data?.error?.message ?? res.statusText;
        if (res.status === 400 && /tool_choice/i.test(msg)) { lastError = msg; continue; } // try the other tool_choice
        if (res.status === 401) throw new AIError("The Claude API key isn’t valid. Check ANTHROPIC_API_KEY in Vercel.");
        if (res.status === 429 || res.status === 529) throw new AIError("The AI is busy right now. Try again in a minute.");
        if (/credit|billing/i.test(msg)) throw new AIError("The Claude API account is out of credit. Add credit at console.anthropic.com.");
        throw new AIError(`AI request failed: ${msg}`);
      }
      if (data?.stop_reason === "max_tokens") throw new AIError("This menu is too long to read in one go. Try uploading one page at a time.");
      const block = data?.content?.find((b: any) => b.type === "tool_use");
      if (block) return block.input as T;
      // Fallback: the model answered in text; pull out the JSON if it's there.
      const text: string = (data?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (json) { try { return JSON.parse(json) as T; } catch { /* fall through */ } }
      lastError = "no structured result";
    }
  }
  if (lastError === "no structured result") throw new AIError("The AI didn’t return a result. Please try again.");
  throw new AIError(`No Claude model was available (${lastError}). Set ANTHROPIC_MODEL_VISION in Vercel.`);
}
