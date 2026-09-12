interface VsCodeApi<TOutgoing, TState> {
  postMessage(message: TOutgoing): void;
  getState(): TState | undefined;
  setState(state: TState): void;
}

declare function acquireVsCodeApi<TOutgoing = unknown, TState = unknown>(): VsCodeApi<TOutgoing, TState>;

let cached: VsCodeApi<unknown, unknown> | undefined;

export function getVsCodeApi<TOutgoing, TState = unknown>(): VsCodeApi<TOutgoing, TState> {
  if (!cached) {
    cached = acquireVsCodeApi();
  }
  return cached as VsCodeApi<TOutgoing, TState>;
}
