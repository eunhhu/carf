import type { MethodHandler } from "../rpc/types";

type Params = {
  pattern: string;
  limit?: number;
};

// Search memory for a pattern
export const searchMemory: MethodHandler = async ({ params }) => {
  const { pattern, limit = 100 } = params as Params;

  if (!pattern) {
    throw new Error("pattern parameter is required");
  }

  const results: string[] = [];
  const ranges = Process.enumerateRanges("r--");

  for (const range of ranges) {
    if (results.length >= limit) break;

    try {
      const matches = Memory.scanSync(range.base, range.size, pattern);
      for (const match of matches) {
        if (results.length >= limit) break;
        results.push(match.address.toString());
      }
    } catch {
      // Skip unreadable ranges
    }
  }

  return results;
};
