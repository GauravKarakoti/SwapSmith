import { safeParseLLMJson } from "../utils/safe-json";

describe("safeParseLLMJson", () => {
  it("parses raw JSON", () => {
    const input = '{"a":1}';
    expect(safeParseLLMJson(input)).toEqual({ a: 1 });
  });

  it("parses JSON inside markdown block", () => {
    const input = "```json\n{ \"a\": 1 }\n```";
    expect(safeParseLLMJson(input)).toEqual({ a: 1 });
  });

  it("parses JSON inside markdown block without newline", () => {
      const input = "```json{ \"a\": 1 }```";
      expect(safeParseLLMJson(input)).toEqual({ a: 1 });
  });

  it("parses JSON with extra text", () => {
    const input = "Here is your result:\n{ \"a\": 1 }";
    expect(safeParseLLMJson(input)).toEqual({ a: 1 });
  });

  it("parses JSON with extra text after", () => {
    const input = "{ \"a\": 1 }\nHope this helps!";
    expect(safeParseLLMJson(input)).toEqual({ a: 1 });
  });

  it("parses JSON with extra text before and after", () => {
    const input = "Here is the result: { \"a\": 1 } thanks";
    expect(safeParseLLMJson(input)).toEqual({ a: 1 });
  });

  it("throws on invalid JSON", () => {
    expect(() => safeParseLLMJson("invalid")).toThrow();
  });

  it("throws on empty string", () => {
      expect(() => safeParseLLMJson("")).toThrow("Empty LLM response");
  });

  it("throws when no JSON object is found", () => {
      expect(() => safeParseLLMJson("Just some text without braces")).toThrow("Failed to extract valid JSON from LLM response");
  });
});
