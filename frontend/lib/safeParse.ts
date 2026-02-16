export function safeParseJSON<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("Invalid JSON detected:", error);
    return null;
  }
}
