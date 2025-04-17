export class Logger {
  info(message: string): void {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`);
  }

  warn(message: string): void {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`);
  }

  error(message: string, error?: any): void {
    const errorDetails = error ? `: ${error.message}\n${error.stack}` : "";
    console.error(
      `[ERROR] [${new Date().toISOString()}] ${message}${errorDetails}`
    );
  }

  debug(message: string): void {
    console.log(`[DEBUG] [${new Date().toISOString()}] ${message}`);
  }

  data(
    operation: string,
    entityType: string,
    entityId: string,
    data: any
  ): void {
    console.log(
      `[DATA] [${new Date().toISOString()}] ${operation} ${entityType} ${entityId}`
    );
  }
}

export const logger = new Logger();
