type TLogLevel = "debug" | "info" | "warn" | "error";

export class Logger {
  debug(message: string, ...optionalParams: unknown[]): void {
    this.message(message, "debug", ...optionalParams);
  }

  info(message: string, ...optionalParams: unknown[]): void {
    this.message(message, "info", ...optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.message(message, "warn", ...optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    this.message(message, "error", ...optionalParams);
  }

  private message(
    message: string,
    level: TLogLevel,
    ...optionalParams: unknown[]
  ): void {
    const caller = this.caller();
    const appInstance = parseInt(process.env.NODE_APP_INSTANCE ?? "0", 10);
    const pid = appInstance ? ` [${appInstance}] ` : " ";
    const msg = `[${new Date().toISOString()}]${pid}[${level.toUpperCase()}] ${caller} ${message}`;
    if (level === "warn") {
      console.warn(msg, ...optionalParams);
    } else if (level === "error") {
      console.error(msg, ...optionalParams);
    } else if (level == "info") {
      console.log(msg, ...optionalParams);
    } else if (level == "debug") {
      console.debug(msg, ...optionalParams);
    }
  }

  private caller(): string {
    const error = new Error();
    const stack = error.stack?.split("\n") || [];
    const callerLine = stack[4] || "";
    const match = callerLine.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/);
    if (match) {
      const [, methodName] = match;
      const method = methodName.includes(".")
        ? methodName.split(".")
        : methodName;
      return Array.isArray(method)
        ? `[${method[0]}] [${method[1]}]`
        : `[${method}]`;
    }
    return "[unknown]";
  }
}
