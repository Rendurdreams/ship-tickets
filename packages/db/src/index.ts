export interface DatabaseHealth {
  readonly healthy: boolean;
  readonly latencyMs?: number;
}

export interface DatabaseProvider {
  health(): Promise<DatabaseHealth>;
}
