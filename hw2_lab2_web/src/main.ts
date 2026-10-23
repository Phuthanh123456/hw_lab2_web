import "./style.css";
import { AudioQueueDemo } from "./ui/AudioQueueDemo";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("The application root element was not found.");
}

const demo = new AudioQueueDemo(app);
const disposeDemo = (): void => {
  void demo.dispose().catch((error: unknown) => console.error("Audio demo cleanup failed", error));
};
const onPageHide = (): void => {
  window.removeEventListener("pagehide", onPageHide);
  disposeDemo();
};
window.addEventListener("pagehide", onPageHide, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener("pagehide", onPageHide);
    disposeDemo();
  });
}
