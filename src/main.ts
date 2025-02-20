import Mii from "./external/mii-js/mii";
import { Buffer as Buf } from "../node_modules/buffer/index";
import { setupUi } from "./ui/setup";
import { MiiEditor } from "./class/MiiEditor";
import LazyLoad, { type ILazyLoadInstance } from "vanilla-lazyload";
import { langManager } from "./l10n/manager";
import * as Sentry from "@sentry/browser";
import { Config } from "./config";
import Modal, { closeModal } from "./ui/components/Modal";
import { initializeFFLWithResource } from "./external/ffl.js/ffl.js";
import type { FFLShaderMaterial } from "./external/ffl.js/FFLShaderMaterial.js";
import type { LUTShaderMaterial } from "./external/ffl.js/LUTShaderMaterial.js";

declare global {
  interface Window {
    buffer: Buf;
    editor: MiiEditor;
    firstVisit: boolean;
    LazyLoad: ILazyLoadInstance;
    localforage: LocalForage;
    Mii: any;
    mii: Mii;
    sentryOnLoad: any;

    // New stuff
    FFLShaderMaterial: FFLShaderMaterial;
    LUTShaderMaterial: LUTShaderMaterial;
  }
}

//@ts-expect-error Buffer to keep in window for debugging purposes
window.buffer = Buf;

window.LazyLoad = new LazyLoad();

if (Config.apis.useSentry) {
  Sentry.init({
    dsn: Config.apis.sentryURL,
    tracesSampleRate: 0.01,
  });
}

// Make the theme ready before settings is initialized
document.documentElement.dataset.theme = "default";

let FFL: any;
export const getFFL = () => FFL;

// Depending on config, load FFL.js
if (Config.renderer.useRendererServer === false) {
  var m = Modal.modal(
    "Notice",
    // TODO: Make a better message? 😅
    "Mii Creator is loading assets, please wait..."
  );

  FFL = (await import("./external/ffl.js/ffl-emscripten.js")).default
    .Module as any;

  console.log(FFL);
  console.log("We've got FFL!");

  // Import FFL.JS (c) 2025 Arian K. pro max Edition
  await initializeFFLWithResource(Config.renderer.fflResourcePath, FFL);
  console.log("Ready!");

  closeModal(m);
}

langManager.getString("languages.en_US");
setupUi();
