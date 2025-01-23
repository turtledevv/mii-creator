// Configuration file used client-side.

// Instance of FFL-Testing/Mii Studio API compatible renderer.
const baseURL = "https://mii-renderer.nxw.pw/miis/image";
// ^^ image.png, image.glb

// Origin used for NNID, PNID, and random NNID fetch.
// Details: https://github.com/ariankordi/nwf-mii-cemu-toy/blob/ffl-renderer-proto-integrate/README.md
const nnidFetchOrigin = "https://mii-unsecure.ariankordi.net";

export const Config = {
  renderer: {
    baseURL,
    renderFFLMakeIcon: `${baseURL}.png?shaderType=miitomo&type=fflmakeicon&width=360&verifyCharInfo=0`,
    renderHeadshotURL: `${baseURL}.png?shaderType=wiiu&type=face&width=260&verifyCharInfo=0`,
    renderHeadshotURLNoParams: `${baseURL}.png`,
    renderFullBodyURL: `${baseURL}.png?shaderType=wiiu&type=all_body_sugar&width=420&verifyCharInfo=0&scale=1`,
    render3DHeadURL: `${baseURL}.glb?shaderType=wiiu&type=face&width=260&verifyCharInfo=0`,
    renderFaceURL: `${baseURL}.png?scale=1&drawStageMode=mask_only&verifyCharInfo=0`,
  },
  dataFetch: {
    // For fetching data from various sources.
    nnidRandomURL: `${nnidFetchOrigin}/mii_data_random`,
    // Caller has to encodeURIComponent before passing:
    nnidFetchURL: (nnid: string) => `${nnidFetchOrigin}/mii_data/${nnid}`,
    pnidFetchURL: (pnid: string) =>
      `${nnidFetchOrigin}/mii_data/${pnid}?api_id=1`,
  },
  mii: {
    scalingMode: "scaleApply",
    // ^^ scaleLimit, scaleLimitClampY, scaleApply
  },
  version: {
    string: "v0.9.0",
    name: "QR code & MiiC v3 support",

    // ignore that I'm just writing HTML here
    changelog: `
    <h1 style="font-size: 20px;text-align: center;">v0.9.0 - QR Code and MiiC v3 Support</h1>

    <div class="flex-group">
      <img draggable="false" width=96 height=96 src="https://i.imgur.com/sMtNF5a.png">
      <div class="col" style="gap:12px">
        <small>Austin☆²¹ / Kat21</small>
        <div>Let's go over the new changes!</div>
      </div>
    </div>

    <div style="text-align:center;margin:12px 0">
      <p style="margin-bottom:0"><strong style="color:var(--error-color)">Please <a href="mailto:datkat21.yt@gmail.com">contact me</a> <small>(kat21)</small> if you have any feedback, feature requests, or bug reports.</strong></p>
      <small>(Some people are just not aware that kat21 made this app, not ariankordi. if you are one of those people you should know by now. Also this project is named "Mii Creator", not "Mii Creator Web," or any other "mii maker" thing. 🙂)</small>
    </div>

    <h3>The new changes</h3>

    <ul style="display:flex;flex-direction:column;gap:8px;line-height:1.75rem">
      <li>Update Mii Creator file format to version 3, still haven't decided the final feature to add to the miis to fill that last byte, my original idea was probably custom shirt color but that sounds a little bit boring.</li>
      <ul>
        <li>The "face paint" feature for changing color of the head (I really thought it was called face paint in Miitopia, but checking again it is called "foundation")</li>
      </ul>
      <li>I was testing default light direction previously but it looked a bit.. odd, so I got rid of it, if you want it as an option let me know</li>
      <li>Add some new shader options (a few new ones based on the FFL shader)</li>
      <li>Update readme and preview image</li>
      <li>New way of displaying app updates (you're reading one right now)</li>
      <li>Added my contact information inside the app! <small>(please email me about problems 🥺)</small></li>
      <li>Subtle loading sound when each mii image loads in like the switch mii editor applet, just for fun</li>
      <li>Functional QR code scanning</li>
      <ul>
        <li>It works with Wii U/3DS and mii creator qr codes, but unfortunately does not have fully compatibility with tomodachi life ones due to a weird bug where it isn't decrypting the extra data properly. The code to handle it is there, and once I find a fix, it will fully work with those Tomodachi Life Mii QR codes.</li>
        <li>Camera scanning has a bug when you move away from the tab while scanning, don't do that</li>
      </ul>
      <li>The icons subtly change shader/body model in the background as you change the shader type or body model setting</li>
      <li>Fixed most issues relating to the library duplication bugs by making it a single shutdown function</li>
      <li>Display a version string in the sidebar on the main menu, (also helps to know which update you're on)</li>
      <li>Miscellaneous settings related to QR code scanning</li>
      <ul>
        <li>Ability to disable closing of the QR code menu after you scan a QR code (the library will still refresh in the background if you click 'save')</li>
        <li>Ability to completely disable camera for the QR scanner, so it just becomes a file input</li>
      </ul>
      <li>Fix a possible memory leak with the particle effects</li>
      <li>Add Miitomo body model and animations</li>
      <li>Option to color the hands like in Miitomo</li>
      <li>Much more control in the custom render menu</li>
      <li>Green-screen and other solid color background options for the custom render menu in Settings</li>
      <li>Fix glTF textures exported using Wii U shader</li>
      <li>And probably some more small changes that should improve the user experience</li>
    </ul>
 
    <h3>Plans</h3>
    <ul style="display:flex;flex-direction:column;gap:8px;line-height:1.75rem">
      <li>More theme options</li>
      <li>Online account system for saving your mii data across devices</li>
    </ul>

    <h3>Attributions / Acknowledgements</h5>

    <p>These people helped me with the new update!</p>

    <div class="flex-group" style="justify-content:flex-start">
      <div class="flex-group" style="gap:0px;justify-content:flex-start">
        <img draggable="false" width=96 height=96 src="${baseURL}.png?type=variableiconbody&data=080037030d020531020c030105040a0209000001000a011004010b0100662f04000214031603140d04000a020109&shaderType=switch&width=96&source=update&characterYRotate=8&bodyType=switch">
        <div class="col" style="gap:12px;flex:1">
          <small>Arian <a href="https://github.com/ariankordi">(@ariankordi)</a></small>
          <div>Wrote code for the new QR code feature, helped with Git, debugging, advice</div>
        </div>
      </div>
      <div class="flex-group" style="gap:0px;justify-content:flex-start">
        <img draggable="false" width=96 height=96 src="${baseURL}.png?type=variableiconbody&data=00070e3c4554575c616c6872818b909da0b1b7bec3cad0d78f93a1b1c0c78ce8f0f8fdf2f8f3f7ebebf6fdfcfffffb&shaderType=switch&width=96&source=update&characterYRotate=8&bodyType=switch">
        <div class="col" style="gap:12px;flex:1">
          <small>Timothy <a href="https://github.com/Timiimiimii">(@Timimimi)</a></small>
          <div>Implemented the new <code>.charinfo</code> <a href="https://github.com/datkat21/mii-creator/pull/15">export format</a></div>
        </div>
      </div>
      <div class="flex-group" style="gap:0px;justify-content:flex-start">
        <img draggable="false" width=96 height=96 src="${baseURL}.png?type=variableiconbody&data=00070e3b3f3c4649555e5c6675777a7a7f7e818890979ea5b4b7bebbbac188bdc6ced4ccd6cccfe3f5f8fffcff0513&shaderType=switch&width=96&source=update&characterYRotate=8&bodyType=switch">
        <div class="col" style="gap:12px;flex:1">
          <small>obj <a href="https://x.com/objecty_twitt">(@objecty)</a></small>
          <div>Helped with designing some new icons</div>
        </div>
      </div>
      <div class="flex-group" style="gap:0px;justify-content:flex-start">
        <img draggable="false" width=96 height=96 src="${baseURL}.png?type=variableiconbody&data=0800450308040402020c0308060406020a0001000006000804000a0800326702010314031304190d04000a040109&shaderType=switch&width=96&source=update&characterYRotate=8&bodyType=switch">
        <div class="col" style="gap:12px;flex:1">
          <small>David J. <a href="https://x.com/dwyazzo90">(@dwyazzo90)</a></small>
          <div>Provided suggestions and ideas</div>
        </div>
      </div>
      <div class="flex-group" style="gap:0px;justify-content:flex-start">
        <img draggable="false" width=96 height=96 src="${baseURL}.png?type=variableiconbody&data=00070e283208131d43484b524c515a5a606f75838a919ea5b4b7bebbb3ba8bced1d8e1fc03171d191b262d2e313745&shaderType=switch&width=96&source=update&characterYRotate=8&bodyType=switch">
        <div class="col" style="gap:12px;flex:1">
          <small>justcamtro <a href="https://x.com/justcamtro">(@justcamtro)</a></small>
          <div>Tested the new update and gave feedback</div>
        </div>
      </div>
    </div>

    <p style="margin-bottom:0;text-align:center"><strong>You can view this message again in Settings.</strong></p>
    `,
  },
};
