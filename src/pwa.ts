import { registerSW } from "virtual:pwa-register";

/**
 * registerType autoUpdate makes the worker skip waiting and, once it
 * activates, reload this page. While the page stays open, ask the
 * registration for a newer worker whenever it becomes visible.
 */
export function startServiceWorker() {
  if (!import.meta.env.PROD) return;

  let registration: ServiceWorkerRegistration | undefined;

  registerSW({
    immediate: true,
    onRegisteredSW(_url, next) {
      registration = next;
    },
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    registration?.update().catch(() => {});
  });
}
