declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState<T = unknown>(): T;
  setState(state: unknown): void;
};

declare module "*.ttf?inline" {
  const src: string;
  export default src;
}

declare module "*.css?inline" {
  const src: string;
  export default src;
}
