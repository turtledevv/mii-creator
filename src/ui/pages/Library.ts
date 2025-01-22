import Html from "@datkat21/html";
import localforage from "localforage";
import { MiiEditor, MiiGender, RenderPart } from "../../class/MiiEditor";
import Modal, { buttonsOkCancel } from "../components/Modal";
import Mii from "../../external/mii-js/mii";
import { Buffer } from "../../../node_modules/buffer/index";
import Loader from "../components/Loader";
import { AddButtonSounds } from "../../util/AddButtonSounds";
import {
  createIconCard,
  createMiiCard,
  getMiiRender,
  MiiCustomRenderType,
  QRCodeCanvas,
} from "../../util/miiImageUtils";
import { Config } from "../../config";
import EditorIcons from "../../constants/EditorIcons";
import { CameraPosition, Mii3DScene, SetupType } from "../../class/3DScene";
import {
  FeatureSetType,
  MiiPagedFeatureSet,
  type FeatureSetEntry,
} from "../components/MiiPagedFeatureSet";
import { downloadLink, saveArrayBuffer } from "../../util/downloadLink";
import { ArrayNum, RandomInt } from "../../util/Numbers";
import {
  CanvasTexture,
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
  type Mesh,
  type ShaderMaterial,
  type Texture,
} from "three";
import {
  cPantsColorGoldHex,
  cPantsColorRedHex,
} from "../../class/3d/shader/fflShaderConst";
import { MiiFavoriteColorIconTable } from "../../constants/ColorTables";
import { getString as _ } from "../../l10n/manager";
import { FFLiDatabaseRandom_Get } from "../../external/ffl/FFLiDatabaseRandom";
import { replayUpdateNotice, Settings } from "./Settings";
import { getSetting } from "../../util/SettingsHelper";
import { GLTFExporter } from "three/examples/jsm/Addons.js";
import {
  initQrCam,
  QrScanDataType,
  QrScannerError,
  setQRCallback,
  startScanner,
} from "../../util/DecodeQRCode";
import { playSound } from "../../class/audio/SoundManager";
import type CameraControls from "camera-controls";
import { sRGB } from "../../util/Color";
export const savedMiiCount = async () =>
  (await localforage.keys()).filter((k) => k.startsWith("mii-")).length;
export const newMiiId = async () =>
  `mii-${Date.now()}-${await savedMiiCount()}`;
export const miiIconUrl = (
  mii: Mii,
  library: boolean = true,
  view: string = "variableiconbody",
  width: number = 180
) => {
  let url = Config.renderer.renderHeadshotURLNoParams;

  let params = new URLSearchParams();

  params.set("data", mii.encodeStudio().toString("hex"));
  switch (currentShader) {
    case "wiiu":
    case "wiiu_gloss":
      params.set("shaderType", "0");
      break;
    case "none":
    case "wiiu_blinn":
      params.set("shaderType", "3");
      break;
    case "wiiu_ffliconwithbody":
      params.set("shaderType", "4");
      break;
    case "switch":
      params.set("shaderType", "1");
      break;
    case "miitomo":
      params.set("shaderType", "2");
      break;
    case "lightDisabled":
      params.set("shaderType", "0");
      params.set("lightEnable", "0");
      break;
  }
  params.set("bodyType", currentBodyModel);
  params.set("type", view);
  params.set("width", width.toString());
  params.set("verifyCharInfo", "0");
  params.set("miic", encodeURIComponent(mii.encode().toString("base64")));
  params.set("version", Config.version.string);
  params.set("source", library ? "library" : "lookalike");
  params.set(
    "pantsColor",
    mii.normalMii === false ? "gold" : mii.favorite === true ? "red" : "gray"
  );

  if (mii.extHatType !== 0) {
    params.set("hatType", String(mii.extHatType));
  }
  if (mii.extHatColor !== 0) {
    params.set("hatColor", String(mii.extHatColor));
  }

  // params.set(
  //   "lightXDirection",
  //   "0"
  // );
  // params.set(
  //   "lightYDirection",
  //   "0"
  // );
  // params.set(
  //   "lightZDirection",
  //   "57"
  // );

  return `${url}?${params.toString()}`;
};

let currentShader: string = "wiiu";
document.addEventListener("library-shader-update", async () => {
  currentShader = await getSetting("shaderType");
});
let currentBodyModel: string = "wiiu";
document.addEventListener("library-body-update", async () => {
  currentBodyModel = await getSetting("bodyModel");
});
let shutdown: () => any = () => {
  console.log("Shutdown was called but was not set yet!");
};
export async function Library(highlightMiiId?: string) {
  currentShader = await getSetting("shaderType");
  currentBodyModel = await getSetting("bodyModel");
  function shutdownReal(): Promise<void> {
    return new Promise((resolve) => {
      container.class("fadeOut");
      setTimeout(() => {
        container.cleanup();
        resolve();
      }, 500);
    });
  }
  shutdown = shutdownReal;

  const container = new Html("div").class("mii-library").appendTo("body");

  const sidebar = new Html("div").class("library-sidebar").appendTo(container);

  sidebar.append(new Html("h1").text(_("generic.app_title")));

  const libraryList = new Html("div").class("library-list").appendTo(container);

  const miis = await Promise.all(
    (
      await localforage.keys()
    )
      .filter((k) => k.startsWith("mii-"))
      .sort((a, b) => Number(a.split("-")[1]!) - Number(b.split("-")[1]!))
      .map(async (k) => ({
        id: k,
        mii: (await localforage.getItem(k)) as string,
      }))
  );

  if (miis.length === 0) {
    libraryList.append(
      new Html("div")
        .style({ position: "absolute", top: "2rem", left: "2rem" })
        .text("You have no Miis yet. Create one to get started!")
    );
  }
  let miiErrorCount = 0;
  for (const mii of miis) {
    let miiContainer = new Html("div").class("library-list-mii");

    AddButtonSounds(miiContainer);

    try {
      const miiData = new Mii(Buffer.from(mii.mii, "base64"));
      // prevent error when importing converted Wii-era data
      miiData.unknown1 = 0;
      miiData.unknown2 = 0;

      // if (miiData)
      //   console.log(
      //     miiData.miiName + "'s birthPlatform:",
      //     miiData.deviceOrigin
      //   );

      miiContainer.style({
        "--color": MiiFavoriteColorIconTable[miiData.favoriteColor].top,
      });

      let extraData = "";
      // hat
      if (miiData.extHatType !== 0) {
        extraData += `&hatType=${encodeURIComponent(
          miiData.extHatType
        )}&hatColor=${encodeURIComponent(miiData.extHatColor)}`;
      }

      let miiImage = new Html("img").class("lazy").attr({
        "data-src": miiIconUrl(miiData) + extraData,
      });

      // Special
      if (miiData.normalMii === false || miiData.favorite === true) {
        const star = new Html("i")
          .style({ position: "absolute", top: "-22px", right: "-18px" })

          .appendTo(miiContainer);

        if (miiData.favorite === true) {
          star.html(EditorIcons.favorite).style({ color: cPantsColorRedHex });
        }
        if (miiData.normalMii === false) {
          star.html(EditorIcons.special).style({ color: cPantsColorGoldHex });
        }
      }

      let miiName = new Html("span").text(miiData.miiName);

      let miiEditCallback = miiEdit(mii, miiData);

      miiContainer.on("click", async () => {
        if (hasMiiErrored === true) {
          Modal.modal(
            "Oops",
            "This Mii hasn't loaded correctly. Do you still want to try and manage it?",
            "body",
            {
              text: "Cancel",
            },
            {
              callback(e) {
                miiEditCallback();
              },
              text: "Yes",
            },
            {
              text: "No",
            }
          );
          return;
        }

        miiEditCallback();
      });

      let hasMiiErrored = false;

      miiImage.on("error", () => {
        // prevent looping error load
        if (hasMiiErrored === true) return;
        miiImage.attr({
          src: "data:image/svg+xml," + encodeURIComponent(EditorIcons.error),
        });
        hasMiiErrored = true;
      });
      miiImage.on("load", () => {
        setTimeout(() => {
          // only play 50% of the time lol
          if (RandomInt(2) !== 0) return;
          playSound(`load${RandomInt(4) + 1}`);
        }, RandomInt(200));
      });

      miiContainer.appendMany(miiImage, miiName).appendTo(libraryList);

      requestAnimationFrame(() => {
        if (highlightMiiId !== undefined) {
          if (highlightMiiId === mii.id) {
            miiContainer.classOn("highlight");

            setTimeout(() => {
              miiContainer.classOff("highlight");
            }, 2000);

            const mc = miiContainer.elm;
            mc.closest(".library-list")!.scroll({
              top:
                mc.getBoundingClientRect().top +
                mc.getBoundingClientRect().height,
              behavior: "smooth",
            });
          }
        }
      });
    } catch (e: unknown) {
      console.log("Oops", e);
      miiErrorCount++;

      let miiImage = new Html("img").attr({
        src: "data:image/svg+xml," + encodeURIComponent(EditorIcons.error),
      });
      let miiName = new Html("span").text("?");

      miiContainer.appendMany(miiImage, miiName).appendTo(libraryList);

      miiContainer.on("click", async () => {
        Modal.modal(
          "Oops",
          "This Mii might be corrupted. Choose an option below.",
          "body",
          {
            text: "Cancel",
          },
          {
            text: "Download a copy",
            callback(e) {
              console.log(mii);
              saveArrayBuffer(
                Buffer.from(mii.mii, "base64").buffer,
                mii.id + ".miic"
              );
            },
          },
          {
            text: "Download a copy (Base64 encoded)",
            callback(e) {
              console.log(mii);
              saveArrayBuffer(
                Buffer.from(mii.mii).buffer,
                mii.id + ".miic.txt"
              );
            },
          },
          {
            text: "Delete",
            callback(e) {
              Modal.modal(
                "Warning",
                "Are you sure you want to delete this Mii?",
                "body",
                {
                  async callback(e) {
                    await localforage.removeItem(mii.id);
                    await shutdown();
                    Library();
                  },
                  text: "Yes",
                  type: "danger",
                },
                {
                  text: "No",
                }
              );
            },
          }
        );
      });
    }
  }

  if (miiErrorCount > 0) {
    Modal.modal(
      "Error",
      `It appears that ${miiErrorCount} of your Miis have failed to load. Their data may be corrupted.\n\nIf you'd like to try and recover the Mii data, you can select the Miis with errors and choose to either save a copy or delete them.`,
      "body",
      ...buttonsOkCancel
    );
  }

  window.LazyLoad.update();

  sidebar.appendMany(
    new Html("div").class("sidebar-buttons").appendMany(
      AddButtonSounds(
        new Html("button").text("Create Mii").on("click", async () => {
          miiCreateDialog();
        })
      ),
      AddButtonSounds(
        new Html("button").text("Settings").on("click", async () => {
          Settings();
        })
      )
    ),
    new Html("div").class("sidebar-credits").appendMany(
      new Html("div")
        .class("flex-group")
        .style({ width: "100%" })
        .appendMany(
          AddButtonSounds(
            new Html("button")
              .text("Credits")
              .on("click", async () => {
                var m = Modal.modal(
                  "Credits",
                  "",
                  "body",
                  { text: "Cancel" },
                  { text: "OK" }
                );
                m.qs(".modal-body span")!.cleanup();
                m.qs(".modal-content")!.style({
                  "max-width": "100%",
                  "max-height": "100%",
                });
                const mb = m.qs(".modal-body")!;
                const container = new Html("div").class("col").prependTo(mb);
                new Html("span")
                  .text("Check out the people behind Mii Creator!")
                  .style({
                    "font-size": "20px",
                    "flex-shrink": "0",
                    "margin-bottom": "-16px",
                  })
                  .prependTo(mb);

                createMiiCard(
                  container,
                  "Austin☆²¹ / Kat21",
                  "datkat21",
                  "https://github.com/datkat21",
                  "Author of Mii Creator",
                  "00070e555d5863674e53666975777c767c7d848b9299989f9ea1a8a9b5bc89e1e9efececf6ecf6ece8f3faf7fbfdfe"
                );
                createMiiCard(
                  container,
                  "Arian",
                  "ariankordi",
                  "https://github.com/ariankordi",
                  'Creator of <a target="_blank" href="https://mii-unsecure.ariankordi.net">Mii Renderer (REAL)</a> and was a big help with debugging many issues',
                  "080037030d020531020c030105040a0209000001000a011004010b0100662f04000214031603140d04000a020109"
                );
                createMiiCard(
                  container,
                  "obj",
                  "objecty",
                  "https://x.com/objecty_twitt",
                  "Composed the music for the site",
                  "00070e3b3f3c4649555e5c6675777a7a7f7e818890979ea5b4b7bebbbac188bdc6ced4ccd6cccfe3f5f8fffcff0513"
                );
                createMiiCard(
                  container,
                  "Timothy",
                  "Timimimi",
                  "https://github.com/Timiimiimii",
                  "Modeled many of the custom hats and helped with debugging",
                  "00070e3c4554575c616c6872818b909da0b1b7bec3cad0d78f93a1b1c0c78ce8f0f8fdf2f8f3f7ebebf6fdfcfffffb"
                );
                createMiiCard(
                  container,
                  "David J.",
                  "dwyazzo90",
                  "https://x.com/dwyazzo90",
                  "Helped with design and created the Wii U theme",
                  "0800450308040402020c0308060406020a0001000006000804000a0800326702010314031304190d04000a040109"
                );
              })
              .style({ flex: "1" })
          ),
          AddButtonSounds(
            new Html("button")
              .text("Help/Contact")
              .on("click", async () => {
                var m = Modal.modal(
                  "Contact",
                  "",
                  "body",
                  { text: "Cancel" },
                  { text: "OK" }
                );
                m.qs(".modal-body span")!.cleanup();
                m.qs(".modal-content")!.style({
                  "max-width": "100%",
                  "max-height": "100%",
                });
                const mb = m.qs(".modal-body")!;
                const container = new Html("div")
                  .class("col")
                  .style({ gap: "0" })
                  .prependTo(mb);
                new Html("span")
                  .text("Here's where you can contact the author, Kat21")
                  .style({
                    "font-size": "20px",
                    "flex-shrink": "0",
                    "margin-bottom": "-16px",
                  })
                  .prependTo(mb);

                createIconCard(
                  container,
                  "E-mail (Preferred)",
                  "mailto:datkat21.yt@gmail.com",
                  "datkat21.yt@gmail.com",
                  EditorIcons.contact_email
                );
                createIconCard(
                  container,
                  "Discord",
                  "",
                  "kat21",
                  EditorIcons.contact_discord
                );
                createIconCard(
                  container,
                  "File an issue on GitHub",
                  "https://github.com/datkat21/mii-creator",
                  "datkat21/mii-creator",
                  EditorIcons.contact_github
                );
              })
              .style({ flex: "1" })
          )
        ),
      new Html("strong").text("This site is not affiliated with Nintendo."),
      new Html("small")
        .text(`${Config.version.string} (${Config.version.name})`)
        .style({ cursor: "pointer" })
        .on("click", () => {
          replayUpdateNotice();
        })
      // new Html("strong").text("Please send any feedback or bug reports either through GitHub issues or to my email: datkat21.yt@gmail.com"),
    )
  );
}

type MiiLocalforage = {
  id: string;
  mii: string;
};

const miiCreateDialog = () => {
  const m = Modal.modal(
    "New Mii",
    "How would you like to create the Mii?",
    "body",
    {
      text: "From Scratch",
      type: "primary",
      callback: () => {
        miiCreateFromScratch();
      },
    },
    {
      text: "QR Code",
      callback: () => {
        miiScanQR();
      },
    },
    {
      text: "FFSD/MiiCreator data",
      callback: () => {
        let id: string;
        let modal = Modal.modal(
          "Import FFSD/MiiCreator data",
          "",
          "body",
          {
            text: "Cancel",
            callback: () => {
              miiCreateDialog();
            },
          },
          {
            text: "Confirm",
            callback() {
              Library(id);
            },
          }
        );
        modal
          .qsa(".modal-body .flex-group,.modal-body span")!
          .forEach((q) => q!.style({ display: "none" }));
        modal.qs(".modal-body")!.appendMany(
          new Html("span").text("Select a FFSD or .miic file to import"),
          new Html("input")
            .attr({ type: "file", accept: ".ffsd,.cfsd,.miic" })
            .style({ margin: "auto" })
            .on("change", (e) => {
              const target = e.target as HTMLInputElement;
              console.log("Files", target.files);

              const f = new FileReader();

              f.readAsArrayBuffer(target.files![0]);
              f.onload = async () => {
                try {
                  // prevent error when importing converted Wii-era data
                  const miiData = Buffer.from(f.result as ArrayBuffer);

                  const mii = new Mii(miiData);

                  const miiDataToSave = mii.encode().toString("base64");

                  id = await newMiiId();

                  await localforage.setItem(id, miiDataToSave);

                  shutdown();
                  modal.qs(".modal-body button")!.elm.click();
                } catch (e) {
                  Modal.alert("Error", `Invalid Mii data: ${e}`);
                  target.value = "";
                }
              };
            })
        );
      },
    },
    {
      text: "Enter NNID/PNID",
      callback: () => {
        Modal.modal(
          "Enter NNID/PNID",
          "Select a service to look up",
          "body",
          {
            text: "Cancel",
          },
          {
            text: "Enter Nintendo Network ID",
            callback(e) {
              miiCreateNNID();
            },
          },
          {
            text: "Enter Pretendo Network ID",
            callback(e) {
              miiCreatePNID();
            },
          }
        );
      },
    },
    {
      text: "Choose a look-alike",
      callback: () => {
        miiCreateRandomFFL();
      },
    },
    {
      text: "Random NNID",
      callback: () => {
        miiCreateRandom();
      },
    },
    {
      text: "Cancel",
    }
  );
  m.qs(".modal-body")!.styleJs({ maxWidth: "600px" });
};
const miiCreateFromScratch = () => {
  function cb(gender: MiiGender) {
    return () => {
      shutdown();
      new MiiEditor(gender, async (m, shouldSave) => {
        if (shouldSave === true) await localforage.setItem(await newMiiId(), m);
        Library();
      });
    };
  }

  Modal.modal(
    "Create New",
    "Select the Mii's gender",
    "body",
    {
      text: "Male",
      callback: cb(MiiGender.Male),
    },
    {
      text: "Female",
      callback: cb(MiiGender.Female),
    },
    {
      text: "Cancel",
      callback: () => miiCreateDialog(),
    }
  );
};
const miiScanQR = async () => {
  let qrReturnToMenu = true;
  const m = Modal.modal("Scan QR Code", "", "body", {
    text: "Cancel",
    callback: () => {
      m.qs("#stop-camera")!.elm.click();
      if (qrReturnToMenu) miiCreateDialog();
    },
  });

  const mb = m.qs(".modal-body")!;

  // delete the button container
  m.qs(".modal-body")!
    .qsa("*")!
    .forEach((item) => item!.cleanup());
  m.qs(".modal-content")?.styleJs({ maxHeight: "100%", maxWidth: "600px" });

  mb.appendMany(
    // camera stuff container
    new Html("div").classOn("col").appendMany(
      new Html("span").attr({ for: "cam-list" }).text("Select camera:"),
      new Html("select")
        .id("cam-list")
        .appendMany(
          new Html("option")
            .attr({ value: "environment", selected: "yes" })
            .text("Back Camera (default)"),
          new Html("option")
            .attr({ value: "user" })
            .text("User/Front Facing Camera"),
          new Html("option")
            .attr({ value: "device-camera", disabled: true })
            .text("(Open the camera for more options)")
        ),
      new Html("div")
        .class("flex-group")
        .appendMany(
          new Html("button").id("start-camera").text("Start camera"),
          new Html("button").id("stop-camera").text("Stop camera")
        ),
      new Html("video").id("qr-video").styleJs({ maxWidth: "100%" }),
      new Html("span").id("file-upload").text("Or upload an image:"),
      new Html("input").attr({
        type: "file",
        id: "file-input",
        accept: "image/*",
      })
    )
  );

  startScanner(mb.qs("#cam-list")!.elm);
  initQrCam(
    mb.qs("#cam-list")!.elm,
    mb.qs("#start-camera")!.elm as HTMLButtonElement,
    mb.qs("#stop-camera")!.elm as HTMLButtonElement,
    mb.qs("#file-input")!.elm as HTMLInputElement
  );

  if ((await getSetting("allowQrCamera")) === false) {
    // Hide unused items if camera isn't allowed
    mb.qsa('span[for="cam-list"], #cam-list, .flex-group, video')!.forEach(
      (e) => e!.style({ display: "none" })
    );
    // prevent video element from taking up space
    mb.qs("video")!.style({ position: "fixed" });
    mb.qs("span#file-upload")!.text(
      "Camera is disabled in settings.\n\nUpload an image:"
    );
  }

  // confirmation function
  async function qrImportConfirmation(mii: Mii, source: string) {
    const shouldClose = await getSetting("autoCloseQrScan");
    if (shouldClose) {
      // hack to close modal and stop scanner
      qrReturnToMenu = false;
      m.qs(".modal-header button")?.elm.click();
    }
    var m2 = Modal.modal(
      "Mii QR Scanned",
      "",
      "body",
      {
        text: "Cancel",
      },
      {
        text: "Don't Save",
      },
      {
        text: "Save",
        async callback(e) {
          const id = await newMiiId();
          await localforage.setItem(id, mii.encode().toString("base64"));
          shutdown();
          Library(id);
        },
      }
    );

    m2.qs(".modal-content")!.styleJs({ maxWidth: "100%", maxHeight: "100%" });
    m2.qs(".modal-body span")!.cleanup();

    m2.qs(".modal-body")!
      .style({ "align-items": "center", gap: "1.5rem" })
      .prependMany(
        new Html("span").text(`Do you want to save this Mii?`),
        new Html("small").text(source),
        new Html("span")
          .style({ "font-size": "20px" })
          .text(`${mii.miiName} has arrived!`),
        new Html("img")
          .attr({
            src: miiIconUrl(mii, false, "all_body_sugar", 260),
          })
          .style({
            width: "260px",
            height: "260px",
            "object-fit": "contain",
          })
      );
  }

  // initialize qr callback for data handling
  setQRCallback((data: Buffer, dataType: QrScanDataType) => {
    try {
      var mii: Mii;
      switch (dataType) {
        case QrScanDataType.GenericWiiU3ds:
          mii = new Mii(data);
          qrImportConfirmation(mii, "3DS/Wii U QR Code");
          break;
        case QrScanDataType.ExtraDataTL:
          // no working handling yet
          QrScannerError("This data format is not yet supported.");
          break;
        case QrScanDataType.ExtraDataMiiC:
          mii = new Mii(data);
          qrImportConfirmation(mii, "Mii Creator QR Code");
          break;
      }
    } catch (e) {
      QrScannerError(
        "An error occurred when reading the data.\nPlease check the console for more information."
      );
      console.error(e);
    }
  });
};
const miiCreateNNID = async () => {
  const input = await Modal.input(
    "Nintendo Network ID",
    "Enter NNID of user..",
    "Username",
    "body",
    false
  );
  if (input === false) {
    return miiCreateDialog();
  }

  Loader.show();

  let nnid = await fetch(
    Config.dataFetch.nnidFetchURL(encodeURIComponent(input))
  );

  const result = await nnid.json();

  Loader.hide();
  if (result.error !== undefined) {
    await Modal.alert("Error", `Couldn't get Mii: ${result.error}`);
    return;
  }

  shutdown();
  new MiiEditor(
    0,
    async (m, shouldSave) => {
      if (shouldSave === true) await localforage.setItem(await newMiiId(), m);
      Library();
    },
    result.data
  );
};
const miiCreatePNID = async () => {
  const input = await Modal.input(
    "Pretendo Network ID",
    "Enter PNID of user..",
    "Username",
    "body",
    false
  );
  if (input === false) {
    return miiCreateDialog();
  }

  Loader.show();

  let pnid = await fetch(
    Config.dataFetch.pnidFetchURL(encodeURIComponent(input))
  );

  Loader.hide();
  if (!pnid.ok) {
    await Modal.alert("Error", `Couldn't get Mii: ${await pnid.text()}`);
    return;
  }

  shutdown();
  new MiiEditor(
    0,
    async (m, shouldSave) => {
      if (shouldSave === true) await localforage.setItem(await newMiiId(), m);
      Library();
    },
    (await pnid.json()).data
  );
};
const miiCreateRandom = async () => {
  Loader.show();
  let random = await fetch(Config.dataFetch.nnidRandomURL).then((j) =>
    j.json()
  );
  Loader.hide();

  shutdown();
  new MiiEditor(
    0,
    async (m, shouldSave) => {
      if (shouldSave === true) await localforage.setItem(await newMiiId(), m);
      Library();
    },
    random.data
  );
};
const miiCreateRandomFFL = async () => {
  var m = Modal.modal(
    "Choose a look-alike",
    "",
    "body",
    {
      text: "Cancel",
      callback(e) {
        miiCreateDialog();
      },
    },
    {
      text: "Confirm",
    }
  );
  m.classOn("random-mii-grid");
  const container = m.qs(".modal-body")!;
  // Hide unused elements without deleting them
  container
    .qsa("span,.flex-group *")!
    .forEach((e) => e!.style({ display: "none" }));

  let randomMiiContainer = new Html("div")
    .class("random-mii-container")
    .appendTo(container);

  const group = container.qs(".flex-group")!;

  container.prepend(
    new Html("span")
      .style({
        width: "100%",
        padding: "14px 18px",
        background: "var(--hover)",
        color: "var(--text)",
        border: "1px solid var(--stroke)",
        "border-radius": "6px",
        "flex-shrink": "0",
      })
      .text(
        // arian wrote this for me.. because i didn't want to offend anyone having "race" in my mii creator😭
        "All of the options here are what Nintendo originally programmed in. Please let me know if you want more options added."
      )
  );

  new Html("button")
    .class("primary")
    .text("Reroll")
    .on("click", () => reroll())
    .appendTo(group);

  let options: Record<string, number> = {};

  function makeSelect(property: string, values: HTMLOptionElement[]) {
    console.log(values);
    return new Html("select").appendMany(...values).on("input", (e) => {
      options[property] = parseInt((e.target as HTMLSelectElement).value);
      if (options[property] === -1) delete options[property];

      console.log(options);
    });
  }

  group.prependMany(
    makeSelect("race", [
      new Option("Skin tone", "-1", true, true),
      new Option("(Random)", "-1"),
      new Option("Black", "0"),
      new Option("White", "1"),
      new Option("Asian", "2"),
    ]),
    makeSelect("gender", [
      new Option("Gender", "-1", true, true),
      new Option("(Random)", "-1"),
      new Option("Male", "0"),
      new Option("Female", "1"),
    ]),
    makeSelect("hairColor", [
      new Option("Hair color", "-1", true, true),
      new Option("(Random)", "-1"),
      new Option("Black", "0"),
      new Option("Brown", "1"),
      new Option("Red", "2"),
      new Option("Light brown", "3"),
      new Option("Gray", "4"),
      new Option("Green", "5"),
      new Option("Dirty blonde", "6"),
      new Option("Blonde", "7"),
    ]),
    makeSelect("favoriteColor", [
      new Option("Favorite color", "-1", true, true),
      new Option("(Random)", "-1"),
      new Option("Red", "0"),
      new Option("Orange", "1"),
      new Option("Yellow", "2"),
      new Option("Lime", "3"),
      new Option("Green", "4"),
      new Option("Blue", "5"),
      new Option("Cyan", "6"),
      new Option("Pink", "7"),
      new Option("Purple", "8"),
      new Option("Brown", "9"),
      new Option("White", "10"),
      new Option("Black", "11"),
    ]),
    makeSelect("eyeColor", [
      new Option("Eye color", "-1", true, true),
      new Option("(Random)", "-1"),
      new Option("Black", "0"),
      new Option("Gray", "1"),
      new Option("Brown", "2"),
      new Option("Hazel", "3"),
      new Option("Blue", "4"),
      new Option("Green", "5"),
    ]),
    makeSelect("age", [
      new Option("Age", "-1", true, true),
      new Option("(Random)", "-1"),
      new Option("Child", "0"),
      new Option("Adult", "1"),
      new Option("Elder", "2"),
    ])
  );

  function reroll() {
    randomMiiContainer.clear();
    for (let i = 0; i < 21; i++) {
      const randomMii = new Mii(
        Buffer.from(
          "AwEAAAAAAAAAAAAAgP9wmQAAAAAAAAAAAABNAGkAaQAAAAAAAAAAAAAAAAAAAEBAAAAhAQJoRBgmNEYUgRIXaA0AACkAUkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMNn",
          "base64"
        )
      );
      FFLiDatabaseRandom_Get(randomMii, options);

      let button = new Html("button")
        .append(new Html("img").attr({ src: miiIconUrl(randomMii, false) }))
        .appendTo(randomMiiContainer);

      const randomMiiB64 = randomMii.encode().toString("base64");

      button.on("click", () => {
        // Click the invisible "confirm" button to close the modal normally
        m.qs(".flex-group button")?.elm.click();
        shutdown();
        new MiiEditor(
          0,
          async (m, shouldSave) => {
            if (shouldSave === true)
              await localforage.setItem(await newMiiId(), m);
            Library();
          },
          randomMiiB64
        );
      });
    }
  }
  reroll();
};
const miiEdit = (mii: MiiLocalforage, miiData: Mii) => {
  return () => {
    const modal = Modal.modal(
      miiData.miiName,
      "What would you like to do?",
      "body",
      {
        text: "Edit",
        async callback() {
          await shutdown();
          new MiiEditor(
            0,
            async (m, shouldSave) => {
              if (shouldSave === true) await localforage.setItem(mii.id, m);
              Library();
            },
            mii.mii
          );
        },
      },
      {
        text: "Delete",
        async callback() {
          let scaredIcon: Blob,
            fearfulIcon: Blob,
            reliefIcon: Blob,
            scaredIconURL: string,
            fearfulIconURL: string,
            reliefIconURL: string;

          scaredIcon = await (
            await fetch(miiIconUrl(miiData) + "&expression=10")
          ).blob();
          fearfulIcon = await (
            await fetch(miiIconUrl(miiData) + "&expression=30")
          ).blob();
          reliefIcon = await (
            await fetch(miiIconUrl(miiData) + "&expression=1")
          ).blob();

          scaredIconURL = URL.createObjectURL(scaredIcon);
          fearfulIconURL = URL.createObjectURL(fearfulIcon);
          reliefIconURL = URL.createObjectURL(reliefIcon);

          function release() {
            URL.revokeObjectURL(scaredIconURL);
            URL.revokeObjectURL(fearfulIconURL);
            URL.revokeObjectURL(reliefIconURL);
          }
          function destroy() {
            // cry about it
            disableModal();
            scaredMiiImage.classOn("rotateAndCry");
          }

          function closingCallback() {
            tmpDeleteModal
              .qs(".modal-body")!
              .qsa("*")!
              .forEach((a) => a!.attr({ disabled: true, tabindex: "-1" }));
          }
          function disableModal() {
            closingCallback();
          }
          function closeModal() {
            tmpDeleteModal.class("closing");
            closingCallback();
            setTimeout(() => {
              tmpDeleteModal.cleanup();
            }, 350);
          }

          let tmpDeleteModal = Modal.modal(
            "Warning",
            `Are you sure you want to delete ${miiData.miiName}?`,
            "body"
          );

          // button group
          tmpDeleteModal.qs(".modal-body .flex-group")!.appendMany(
            new Html("button")
              .class("danger")
              .text("Yes")
              .on("click", () => {
                destroy();
                scaredMiiImage.attr({
                  src: fearfulIconURL,
                });
                setTimeout(async () => {
                  closeModal();
                  release();
                  await localforage.removeItem(mii.id);
                  await shutdown();
                  Library();
                }, 1000);
              }),
            new Html("button").text("No").on("click", () => {
              closeModal();
              release();
            })
          );

          // center
          tmpDeleteModal.qs(".modal-body")!.classOn("flex-group");

          const scaredMiiImage = new Html("img")
            // surprised with open mouth expression
            .attr({ src: scaredIconURL })
            .style({ width: "180px", margin: "-18px auto 0 auto" });

          tmpDeleteModal.qs(".modal-body")!.prepend(scaredMiiImage);
          tmpDeleteModal.qsa("button")!.forEach((item) => {
            const yes = item?.elm.classList.contains("danger");
            item!.on("pointerenter", () => {
              if (yes) {
                scaredMiiImage.attr({
                  src: fearfulIconURL,
                });
              } else {
                scaredMiiImage.attr({
                  src: reliefIconURL,
                });
              }
            });
            item!.on("pointerleave", () => {
              scaredMiiImage.attr({
                src: scaredIconURL,
              });
            });
          });
        },
      },
      {
        text: "Export/Download Data",
        async callback() {
          miiExportDownload(mii, miiData);
        },
      },
      {
        text: "Render",
        async callback() {
          miiExport(mii, miiData);
        },
      },
      {
        text: "Cancel",
      }
    );
    // new UI layout (a bit hacky)
    // modal.qs(".modal-body span")!.cleanup();
    // modal.qs(".modal-body")!.style({ "flex-direction": "row" });
    // modal
    //   .qs(".modal-body .flex-group")!
    //   .classOff("flex-group")
    //   .classOn("col")
    //   .style({ "justify-content": "center" });
    modal.qs(".modal-body")?.prepend(
      new Html("img")
        .attr({
          src: miiIconUrl(miiData, true, "all_body_sugar", 240),
        })
        .style({
          "object-fit": "contain",
          width: "180px",
          height: "240px",
          margin: "-18px auto 0 auto",
        })
    );
  };
};

const miiQRConversionWarning = async (miiData: Mii) => {
  if (miiData.hasExtendedColors() === true) {
    let result = await Modal.prompt(
      "Warning",
      "This Mii is using extended Switch colors, but those colors will never show up if you scan this QR Code anywhere outside of this app. Is this OK?",
      "body",
      false
    );
    if (result === false) return false;
  }
  return true;
};

const miiFFSDWarning = async (miiData: Mii) => {
  if (miiData.hasExtendedColors() === true) {
    let result = await Modal.prompt(
      "Warning",
      'This Mii is using extended Switch colors and/or MiiCreator features, but those features will be lost when converting to FFSD.\nUse "Save MiiCreator data" or "Save Charinfo data" if you want to keep the data.\nIs this OK?',
      "body",
      false
    );
    if (result === false) return false;
  }
  return true;
};

const miiExport = (mii: MiiLocalforage, miiData: Mii) => {
  Modal.modal(
    "Render Mii",
    "What would you like to do?",
    "body",
    {
      text: "Download 3D head model",
      async callback() {
        const holder = new Html("div").style({ opacity: "0" });
        const scene = new Mii3DScene(
          miiData,
          holder.elm,
          SetupType.Screenshot,
          (renderer) => {},
          true
        );
        // hide body
        scene.init().then(async () => {
          await scene.updateMiiHead();
          scene.getScene().getObjectByName("m")!.visible = false;
          scene.getScene().getObjectByName("f")!.visible = false;

          const shaderSetting = await getSetting("shaderType");
          // const bodyModelHands = await getSetting("bodyModelHands");

          if (shaderSetting === "none") {
            const result = await Modal.prompt(
              "Notice",
              "3D model export looks best when using the Wii U shader, which you aren't using.\nThis may result in incorrect color output. Do you still want to continue?",
              "body"
            );
            if (result === false) return;
          }

          // Firstly, fix up the materials?
          let i = 0;
          let mats = new Map<number, any>();
          scene.getScene().traverse(async (o) => {
            if ((o as Mesh).isMesh !== true) return;

            const m = o as Mesh;

            mats.set(i, m.material);

            console.log(m.name, m.geometry.userData);

            // this depends on shader setting..
            let map: Texture | null = null;
            const userData = m.geometry.userData;

            if (
              // Both of these internally use FFL shader
              shaderSetting.startsWith("wiiu") ||
              shaderSetting === "lightDisabled"
            ) {
              map = (m.material as ShaderMaterial).uniforms.s_texture.value;

              // if (bodyModelHands) {
              //   if (m.name === "hands_m" || m.name === "hands_f") {
              //     (m.material as ShaderMaterial).uniforms.u_const1.value =
              //       new Vector4(...scene.handColor, 1);
              //   }
              // }
              if (map) {
                // Wii U shader textures need to be converted from linear to sRGB

                // Create a temporary canvas
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d")!;

                // Set canvas dimensions
                canvas.width = map.image.width;
                canvas.height = map.image.height;

                // Draw the texture to the canvas
                context.drawImage(map.image, 0, 0);

                // Get image data from the canvas
                const imageData = context.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height
                );
                const data = imageData.data;

                // Convert from sRGB Linear to sRGB
                for (let i = 0; i < data.length; i += 4) {
                  // Extract RGB components
                  let r = data[i] / 255;
                  let g = data[i + 1] / 255;
                  let b = data[i + 2] / 255;

                  // Convert from sRGB Linear to sRGB
                  r = sRGB(r);
                  g = sRGB(g);
                  b = sRGB(b);

                  // Convert back to 0-255 range
                  data[i] = Math.round(r * 255);
                  data[i + 1] = Math.round(g * 255);
                  data[i + 2] = Math.round(b * 255);
                }

                // Update the canvas with the modified image data
                context.putImageData(imageData, 0, 0);

                const newMap = new CanvasTexture(canvas);

                // Make sure to apply previous map properties!
                newMap.flipY = map.flipY;
                newMap.wrapS = map.wrapS;
                newMap.wrapT = map.wrapS;

                // possible texture leak?
                map = newMap;
                map.needsUpdate = true;

                // Re-generate mipmaps
                map.needsUpdate = true;
              }
            } else if (shaderSetting === "switch") {
              // Can't remember what the uniform for texture is on switch
            } else {
              // Prevent warning by assigning map to null if it is null
              if ((m.material as MeshStandardMaterial).map !== null)
                map = (m.material as MeshStandardMaterial).map;

              // if (bodyModelHands) {
              //   if (m.name === "hands_m" || m.name === "hands_f") {
              //     (m.material as MeshBasicMaterial).color.set(
              //       new Color(...scene.handColor)
              //     );
              //   }
              // }
            }

            // Just use modulateColor from the userData
            // because i can't be asked
            function rgbaToHex(rgba: [number, number, number]) {
              const [r, g, b] = rgba;
              const intR = Math.round(r * 255);
              const intG = Math.round(g * 255);
              const intB = Math.round(b * 255);
              const hexR = intR.toString(16).padStart(2, "0");
              const hexG = intG.toString(16).padStart(2, "0");
              const hexB = intB.toString(16).padStart(2, "0");
              return Number(`0x${hexR}${hexG}${hexB}`);
            }

            m.material = new MeshPhysicalMaterial({
              color: rgbaToHex(userData.modulateColor),
              metalness: 1,
              roughness: 1,

              // For texture
              alphaTest: 0.5,
              map: map,
            });

            i++;
          });

          const exporter = new GLTFExporter();
          exporter.parse(
            scene.getScene(),
            (gltf) => {
              console.log("gltf", gltf);
              if (gltf instanceof ArrayBuffer) {
                saveArrayBuffer(gltf, miiData.miiName + "_head.glb");
              }
              scene.shutdown();
            },
            (error) => {
              console.error("Oops, something went wrong:", error);
            },
            {
              binary: true,
            }
          );
        });
      },
    },
    {
      text: "Render presets",
      async callback() {
        miiExportRender(mii, miiData);
      },
    },
    {
      text: "Make your own render",
      async callback() {
        customRender(miiData);
      },
    },
    {
      text: "Cancel",
    }
  );
};

const miiExportRender = async (mii: MiiLocalforage, miiData: Mii) => {
  Modal.modal(
    `Render options: ${miiData.miiName}`,
    "Choose a way to render this Mii",
    "body",
    {
      text: "Focus on head",
      async callback() {
        const renderImage = await getMiiRender(
          miiData,
          MiiCustomRenderType.Head
        );
        downloadLink(
          renderImage.src,
          `${miiData.miiName}_render_headshot_${Date.now()}.png`
        );
      },
    },
    {
      text: "Focus on full body",
      async callback() {
        const renderImage = await getMiiRender(
          miiData,
          MiiCustomRenderType.Body
        );
        downloadLink(
          renderImage.src,
          `${miiData.miiName}_render_body_${Date.now()}.png`
        );
      },
    },
    {
      text: "Head only",
      async callback() {
        const renderImage = await getMiiRender(
          miiData,
          MiiCustomRenderType.HeadOnly
        );
        downloadLink(
          renderImage.src,
          `${miiData.miiName}_render_head_only_${Date.now()}.png`
        );
      },
    },
    {
      text: "Cancel",
    }
  );
};

const miiExportDownload = async (mii: MiiLocalforage, miiData: Mii) => {
  Modal.modal(
    "Export Mii",
    "How would you like to save the Mii?",
    "body",
    {
      text: "Cancel",
    },
    {
      text: "Save MiiCreator data",
      async callback() {
        const blob = new Blob([miiData.encode()]);
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.download = miiData.miiName + ".miic";
        document.body.appendChild(a);
        a.click();

        requestAnimationFrame(() => {
          a.remove();
        });

        // free URL after some time
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 2000);
      },
    },
    {
      text: "Download other file types...",
      callback(e) {
        Modal.modal(
          "Other download types",
          "Choose a file type to download",
          "body",
          {
            text: "Cancel",
            callback(e) {
              miiExportDownload(mii, miiData);
            },
          },
          {
            text: "Download FFSD file",
            async callback() {
              if (!(await miiFFSDWarning(miiData))) return;
              const blob = new Blob([miiData.encodeFFSD()]);
              const url = URL.createObjectURL(blob);

              const a = document.createElement("a");
              a.href = url;
              a.target = "_blank";
              a.download = miiData.miiName + ".ffsd";
              document.body.appendChild(a);
              a.click();

              requestAnimationFrame(() => {
                a.remove();
              });

              // free URL after some time
              setTimeout(() => {
                URL.revokeObjectURL(url);
              }, 2000);
            },
          },
          {
            text: "Download Charinfo file",
            async callback() {
              //if (!(await miiColorConversionWarning(miiData))) return;
              const blob = new Blob([miiData.encodeCharinfo()]);
              const url = URL.createObjectURL(blob);

              const a = document.createElement("a");
              a.href = url;
              a.target = "_blank";
              a.download = miiData.miiName + ".charinfo";
              document.body.appendChild(a);
              a.click();

              requestAnimationFrame(() => {
                a.remove();
              });

              // free URL after some time
              setTimeout(() => {
                URL.revokeObjectURL(url);
              }, 2000);
            },
          }
        );
      },
    },
    {
      text: "Save Mii as QR Code",
      async callback() {
        if (!(await miiQRConversionWarning(miiData))) return;
        // hack: force FFL shader for QR codes by changing the setting
        const setting = await getSetting("shaderType");
        await localforage.setItem("settings_shaderType", "wiiu");
        const qrCodeImage = await QRCodeCanvas(
          mii.mii,
          miiData.hasExtendedColors()
        ); // extendedColors
        await localforage.setItem("settings_shaderType", setting);
        downloadLink(qrCodeImage, `${miiData.miiName}_QR.png`);
      },
    },
    {
      text: "Show other raw data formats",
      async callback() {
        const modal = Modal.modal(
          "Miscellaneous Output Formats",
          "Click inside a code block to select it.",
          "body",
          ...buttonsOkCancel
        );

        modal
          .qs(".modal-content")!
          .style({ "max-height": "100vh", "max-width": "600px" });
        modal
          .qs(".modal-body")!
          .prependMany(
            new Html("div").appendMany(
              new Html("span").class("h4").text("Charinfo data (Hex)"),
              new Html("pre")
                .class("pre-wrap", "mb-0")
                .text(miiData.encodeCharinfo().toString("hex"))
            ),
            new Html("div").appendMany(
              new Html("span").class("h4").text("MiiC (Base64)"),
              new Html("pre")
                .class("pre-wrap", "mb-0")
                .text(miiData.encode().toString("base64"))
            ),
            new Html("div").appendMany(
              new Html("span").class("h4").text("FFSD (Base64)"),
              new Html("pre")
                .class("pre-wrap", "mb-0")
                .text(miiData.encodeFFSD().toString("base64"))
            ),
            new Html("div").appendMany(
              new Html("span").class("h4").text("FFSD (Hex)"),
              new Html("pre")
                .class("pre-wrap", "mb-0")
                .text(miiData.encodeFFSD().toString("hex"))
            ),
            new Html("div").appendMany(
              new Html("span").class("h4").text("Mii Studio data"),
              new Html("pre")
                .class("pre-wrap", "mb-0")
                .text(miiData.encodeStudio().toString("hex"))
            )
          );
      },
    }
  );
};

export async function customRender(miiData: Mii) {
  const modal = Modal.modal("Custom Render", "", "body", {
    text: "Cancel",
  });
  const body = modal.qs(".modal-body")!.classOn("responsive-row-lg").clear();
  modal.qs(".modal-content")!.styleJs({
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
  });
  let parent = new Html("div")
    .style({
      display: "flex",
      flex: "1",
      background: "var(--container-solid)",
      "border-radius": "12px",
      "flex-shrink": "0",
      height: "100%",
      overflow: "hidden",
      "justify-content": "center",
      "align-items": "center",
    })
    .appendTo(body);
  let parentBox = new Html("div")
    .style({ "aspect-ratio": "1 / 1", height: "100%" })
    .appendTo(parent);
  let tabsContent = new Html("div")
    .classOn("tab-content")
    .style({ flex: "1", height: "100%", overflow: "auto" })
    .appendTo(body);

  let configuration = {
    fov: 30,
    pose: 0,
    expression: 0,
    renderWidth: 720,
    renderHeight: 720,
    cameraPosition: 1,
    animSpeed: 100,
  };

  const base64Data = miiData.encodeStudio().toString("hex");

  const expressionDuplicateList = [34, 42, 44, 46, 48, 50, 52, 54, 61, 62];

  let poseListPerBodyModel: Record<string, number> = {
    wii: 4,
    wiiu: 14,
    switch: 5,
    miitomo: 16,
  };

  let bodyModelSetting = (await getSetting("bodyModel")) as string;

  let poseCount = 0;
  if (bodyModelSetting in poseListPerBodyModel) {
    poseCount = poseListPerBodyModel[bodyModelSetting] + 1;
  }

  console.log(bodyModelSetting);

  let controls: CameraControls,
    rotationFactor = Math.PI / 8;

  const e: Record<string, FeatureSetEntry> = {
    camera: {
      label: "Camera",
      header:
        "Use mouse or touch to move the camera around.\nUsing touch, rotate the camera around with one finger, and drag with two fingers to pan. Pinch with two fingers to zoom.\nIf you like this site, please consider sharing it with others and credit me or the site when you post your renders! 🙂",
      items: [
        {
          type: FeatureSetType.Slider,
          property: "fov",
          iconStart: "FOV",
          iconEnd: "",
          min: 5,
          max: 90,
          part: RenderPart.Face,
        },
        {
          type: FeatureSetType.Misc,
          html: new Html("div").class("flex-group", "col").appendMany(
            new Html("label").text("Position"),
            new Html("div").class("flex-group").appendMany(
              new Html("button").text("Center horizontally").on("click", () => {
                const newPosition = scene.focusCamera(
                  CameraPosition.MiiFullBody,
                  true,
                  false,
                  true
                )!;
                let target = new Vector3();
                controls.getTarget(target);
                target.x = newPosition.x;
                controls.moveTo(target.x, target.y, target.z);
              }),
              new Html("button").text("Center vertically").on("click", () => {
                const newPosition = scene.focusCamera(
                  CameraPosition.MiiFullBody,
                  true,
                  false,
                  true
                )!;
                let target = new Vector3();
                controls.getTarget(target);
                target.y = newPosition.y;
                controls.moveTo(target.x, target.y, target.z);
              }),
              new Html("button").text("Reset").on("click", () => {
                const newPosition = scene.focusCamera(
                  CameraPosition.MiiFullBody,
                  true,
                  false,
                  true
                )!;
                scene
                  .getControls()
                  .moveTo(newPosition.x, newPosition.y, newPosition.z);
              })
            ),
            new Html("label").text("Rotate"),
            new Html("div").class("flex-group").appendMany(
              new Html("button").text("Up").on("click", () => {
                scene
                  .getControls()
                  .rotateTo(
                    controls.azimuthAngle,
                    controls.polarAngle - rotationFactor
                  );
              }),
              new Html("button").text("Down").on("click", () => {
                scene
                  .getControls()
                  .rotateTo(
                    controls.azimuthAngle,
                    controls.polarAngle + rotationFactor
                  );
              }),
              new Html("button").text("Left").on("click", () => {
                scene
                  .getControls()
                  .rotateTo(
                    controls.azimuthAngle - rotationFactor,
                    controls.polarAngle
                  );
              }),
              new Html("button").text("Right").on("click", () => {
                scene
                  .getControls()
                  .rotateTo(
                    controls.azimuthAngle + rotationFactor,
                    controls.polarAngle
                  );
              }),
              new Html("button").text("Reset").on("click", () => {
                controls.rotateTo(0, Math.PI / 2);
              })
            )
          ),
          select() {},
        },
      ],
    },
    // TODO
    // scene: {
    //   label: "Scene",
    //   header: "Change the default background color in Settings.",
    //   items: [
    //     {
    //       type: FeatureSetType.Misc,
    //       html: new Html("div")
    //         .class("input-group")
    //         .appendMany(
    //           new Html("label").text("H"),
    //           new Html("button").text("H"),
    //           new Html("button").text("H"),
    //           new Html("button").text("H")
    //         ),
    //       select() {
    //         /* ... */
    //       },
    //     },
    //   ],
    // },
    pose: {
      label: "Pose",
      header:
        "Change the Body Model option in Settings to get many different options of poses!\n\nUse option 0 here for the default animation.",
      items: ArrayNum(poseCount).map((k) => ({
        type: FeatureSetType.Icon,
        value: k,
        // icon: String(k),
        icon:
          k === 0
            ? "None"
            : `<img src="assets/images/poses/${bodyModelSetting}/${String(
                k
              ).padStart(2, "0")}.png" height=120>`,
        part: RenderPart.Head,
      })),
    },
    expression: {
      label: "Expression",
      items: ArrayNum(70)
        .filter((n) => !expressionDuplicateList.includes(n))
        .map((k) => ({
          type: FeatureSetType.Icon,
          value: k,
          icon: `<img class="lazy" width=128 height=128 data-src="${
            Config.renderer.renderHeadshotURLNoParams
          }?width=128&scale=1&data=${encodeURIComponent(
            base64Data
          )}&expression=${k}&type=fflmakeicon&verifyCharInfo=0">`,
          part: RenderPart.Head,
        })),
    },
    animation: {
      label: "Animation",
      header:
        "This usually only applies to Miitomo body model which has animations for its poses.",
      items: [
        {
          type: FeatureSetType.Slider,
          property: "animSpeed",
          part: RenderPart.Face,
          iconStart: "0x",
          iconEnd: "2x",
          min: 0,
          max: 200,
        },
      ],
    },
  };

  // very hacky way to use feature set to create tabs
  MiiPagedFeatureSet({
    mii: configuration,
    miiIsNotMii: true,
    entries: e as any,
    onChange(mii, forceRender, part) {
      configuration = mii as any;
      updateConfiguration();
      // console.log("updated", configuration);
      oldConfiguration = Object.assign({}, configuration);
    },
  })
    .style({ height: "auto" })
    .appendTo(tabsContent);

  let playing = true;

  let pauseButton = AddButtonSounds(
    new Html("button")
      .text("Pause Animation")
      .on("click", () => {
        if (playing === true) {
          playing = false;
        } else {
          playing = true;
        }
        scene.anim.forEach((anim) => {
          if (playing === true) {
            anim.paused = false;
            pauseButton.text("Pause Animation");
          } else {
            anim.paused = true;
            pauseButton.text("Play Animation");
          }
        });
      })
      .appendTo(tabsContent)
  );

  new Html("button")
    .text("Download PNG")
    .on("click", finalizeRender)
    .appendTo(tabsContent);

  new Html("button")
    .text("Download 3D model")
    .on("click", save3DModel)
    .appendTo(tabsContent);

  window.addEventListener("resize", () => {
    const { width, height } = parentBox.elm.getBoundingClientRect();
    scene.resize(width, height);
  });

  const scene = new Mii3DScene(
    miiData,
    parentBox.elm,
    SetupType.Screenshot,
    (renderer) => {}
  );
  controls = scene.getControls();

  //@ts-expect-error testing
  window.scene = scene;

  // Background color
  const useGreenScreen = await getSetting("customRenderGreenScreen");
  if (useGreenScreen !== "off") {
    let color: string = useGreenScreen;
    switch (useGreenScreen) {
      case "green":
        color = "#00ff00";
        break;
      case "blue":
        color = "#0000ff";
        break;
      case "white":
        color = "#ffffff";
        break;
      case "black":
        color = "#000000";
        break;
    }

    scene.getScene().background = new Color(color);
  }

  let oldConfiguration: any = {
    fov: 30,
    pose: 0,
    expression: 0,
    renderWidth: 720,
    renderHeight: 720,
    cameraPosition: 1,
    animSpeed: 1,
  };

  function updateConfiguration() {
    scene.getCamera()!.fov = configuration.fov;
    scene.getCamera()!.updateProjectionMatrix();
    switch (configuration.cameraPosition) {
      case 0:
        scene.focusCamera(CameraPosition.MiiHead);
        break;
      case 1:
        scene.focusCamera(CameraPosition.MiiFullBody);
        break;
    }

    // Only update expression when expression is changed.
    // console.log(oldConfiguration.expression, configuration.expression);
    if (oldConfiguration.expression !== configuration.expression) {
      scene.traverseAddFaceMaterial(
        scene.getHead() as Mesh,
        `&data=${encodeURIComponent(base64Data)}&expression=${
          configuration.expression
        }&width=896&verifyCharInfo=0`
      );
    }

    const pose = "Pose." + String(configuration.pose).padStart(2, "0");

    if (scene.animations.get(`${scene.type}-${pose}`)) {
      scene.swapAnimation(pose);
      if (playing === false) {
        scene.anim.forEach((a) => (a.paused = true));
      }
    } else {
      scene.swapAnimation("Wait");
    }
    scene.anim.forEach((a) => {
      a.timeScale = configuration.animSpeed / 100;
    });
    if (bodyModelSetting === "miitomo") {
      scene.anim.get(scene.type)!.timeScale *= 0.5;
    }
  }

  //@ts-expect-error
  window.scene = scene;

  scene.init().then(async () => {
    await scene.updateMiiHead();
    scene.focusCamera(CameraPosition.MiiFullBody, true, false);
    parentBox.append(scene.getRendererElement());
  });

  let shouldClose = await getSetting("autoCloseCustomRender");

  const rendererElm = scene.getRendererElement();

  function finalizeRender() {
    rendererElm.toBlob((blob) => {
      const image = new Image(rendererElm.width, rendererElm.height);
      image.src = URL.createObjectURL(blob!);
      console.log("Temporary render URL:", image.src);
      image.onload = () => {
        downloadLink(
          image.src,
          `${miiData.miiName}_all_body_${new Date().toJSON()}.png`
        );
        if (shouldClose) {
          scene.shutdown();
          parent.cleanup();
          modal.qs("button")?.elm.click();
        }
      };
    });
  }

  async function save3DModel() {
    const shaderSetting = await getSetting("shaderType");
    // const bodyModelHands = await getSetting("bodyModelHands");

    if (shaderSetting === "none") {
      const result = await Modal.prompt(
        "Notice",
        "3D model export looks best when using the Wii U shader, which you aren't using.\nThis may result in incorrect color output. Do you still want to continue?",
        "body"
      );
      if (result === false) return;
    }
    // Firstly, fix up the materials?
    let i = 0;
    let mats = new Map<number, any>();
    scene.getScene().traverse(async (o) => {
      if ((o as Mesh).isMesh !== true) return;

      const m = o as Mesh;

      mats.set(i, m.material);

      console.log(m.name, m.geometry.userData);

      // this depends on shader setting..
      let map: Texture | null = null;
      const userData = m.geometry.userData;

      if (
        // Both of these internally use FFL shader
        shaderSetting.startsWith("wiiu") ||
        shaderSetting === "lightDisabled"
      ) {
        map = (m.material as ShaderMaterial).uniforms.s_texture.value;

        // if (bodyModelHands) {
        //   if (m.name === "hands_m" || m.name === "hands_f") {
        //     (m.material as ShaderMaterial).uniforms.u_const1.value =
        //       new Vector4(...scene.handColor, 1);
        //   }
        // }
        if (map) {
          // Wii U shader textures need to be converted from linear to sRGB

          // Create a temporary canvas
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d")!;

          document.body.appendChild(canvas);

          // Set canvas dimensions
          canvas.width = map.image.width;
          canvas.height = map.image.height;

          // Draw the texture to the canvas
          context.drawImage(map.image, 0, 0);

          // Get image data from the canvas
          const imageData = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          );
          const data = imageData.data;

          // Convert from sRGB Linear to sRGB
          for (let i = 0; i < data.length; i += 4) {
            // Extract RGB components
            let r = data[i] / 255;
            let g = data[i + 1] / 255;
            let b = data[i + 2] / 255;

            // Convert from sRGB Linear to sRGB
            r = sRGB(r);
            g = sRGB(g);
            b = sRGB(b);

            // Convert back to 0-255 range
            data[i] = Math.round(r * 255);
            data[i + 1] = Math.round(g * 255);
            data[i + 2] = Math.round(b * 255);
          }

          // Update the canvas with the modified image data
          context.putImageData(imageData, 0, 0);

          const newMap = new CanvasTexture(canvas);

          // Make sure to apply previous map properties!
          newMap.flipY = map.flipY;
          newMap.wrapS = map.wrapS;
          newMap.wrapT = map.wrapS;

          // leak?
          map = newMap;
          map.needsUpdate = true;

          // await new Promise((resolve) => {
          //   createImageBitmap(canvas)
          //     .then((imageBitmap) => {
          //       // Assign the ImageBitmap to the map's source.data
          //       // map!.source.data = imageBitmap;
          //       console.log(map!.source.data);
          //       // Re-generate mipmaps
          //       map!.needsUpdate = true;
          //       resolve(true);
          //     })
          //     .catch((error) => {
          //       console.error("Error creating ImageBitmap:", error);
          //     });
          // });

          // Re-generate mipmaps
          map.needsUpdate = true;
        }
      } else if (shaderSetting === "switch") {
        // Can't remember what the uniform for texture is on switch
      } else {
        // Prevent warning by assigning map to null if it is null
        if ((m.material as MeshStandardMaterial).map !== null)
          map = (m.material as MeshStandardMaterial).map;

        // if (bodyModelHands) {
        //   if (m.name === "hands_m" || m.name === "hands_f") {
        //     (m.material as MeshBasicMaterial).color.set(
        //       new Color(...scene.handColor)
        //     );
        //   }
        // }
      }

      // Just use modulateColor from the userData
      // because i can't be asked
      function rgbaToHex(rgba: [number, number, number]) {
        const [r, g, b] = rgba;
        const intR = Math.round(r * 255);
        const intG = Math.round(g * 255);
        const intB = Math.round(b * 255);
        const hexR = intR.toString(16).padStart(2, "0");
        const hexG = intG.toString(16).padStart(2, "0");
        const hexB = intB.toString(16).padStart(2, "0");
        return Number(`0x${hexR}${hexG}${hexB}`);
      }

      m.material = new MeshPhysicalMaterial({
        color: rgbaToHex(userData.modulateColor),
        metalness: 1,
        roughness: 1,

        // For texture
        alphaTest: 0.5,
        map: map,
      });

      i++;
    });

    const exporter = new GLTFExporter();
    exporter.parse(
      scene.getScene(),
      (gltf) => {
        console.log("gltf", gltf);
        if (gltf instanceof ArrayBuffer) {
          saveArrayBuffer(
            gltf,
            `${miiData.miiName}_all_body_${new Date().toJSON()}.glb`
          );
        }
        if (shouldClose) {
          scene.shutdown();
          parent.cleanup();
          modal.qs("button")?.elm.click();
        } else {
          // Revert back all materials.
          i = 0;
          scene.getScene().traverse((o) => {
            if ((o as Mesh).isMesh !== true) return;

            const m = o as Mesh;

            m.material = mats.get(i);

            i++;
          });
        }
      },
      (error) => {
        console.error("Oops, something went wrong:", error);
      },
      {
        binary: true,
      }
    );
  }
}
