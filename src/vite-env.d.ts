/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module "plotly.js-basic-dist-min" {
  const Plotly: {
    newPlot: (el: HTMLElement, data: object[], layout: object, config?: object) => Promise<void>;
    restyle: (el: HTMLElement, update: object, traces?: number | number[]) => Promise<void>;
    relayout: (el: HTMLElement, update: object) => Promise<void>;
    purge: (el: HTMLElement) => void;
    Plots: { resize: (el: HTMLElement) => void };
  };
  export default Plotly;
}
