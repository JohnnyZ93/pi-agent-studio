declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState<T = unknown>(): T;
  setState(state: unknown): void;
};
