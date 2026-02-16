export function safeParseLLMJson(raw: string): any {
  if (!raw) throw new Error("Empty LLM response");

  let cleaned = raw.trim();

  // Remove ```json ... ``` blocks
  cleaned = cleaned.replace(/```json\s*/gi, "");
  cleaned = cleaned.replace(/```/g, "");

  // Attempt direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {}

  // Try extracting first JSON object using bracket matching
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1) {
    const jsonSubstring = cleaned.slice(firstBrace, lastBrace + 1);
    try {
        return JSON.parse(jsonSubstring);
    } catch {}
  }

  throw new Error("Failed to extract valid JSON from LLM response");
}
