import { scheduler } from "node:timers/promises";
import { Logger } from "./logger";

const logger = new Logger();

export const retry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 2500
) => {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries - 1) {
        logger.error("Operation failed after all retry attempts");
        throw lastError;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn("Operation failed, retrying...");
      await scheduler.wait(delay);
    }
  }
  if (lastError) {
    throw lastError;
  }
};
