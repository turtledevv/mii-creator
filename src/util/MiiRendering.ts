import type { GLTF } from "three/examples/jsm/Addons.js";
import Mii from "../external/mii-js/mii";
import * as THREE from "three";
import { RandomInt } from "./Numbers";
import { cMaterialName } from "../class/3d/shader/fflShaderConst";

export type GLTFLike = {
  animations: any[];
  asset: {};
  cameras: any[];
  parser: any;
  scene: THREE.Object3D;
  scenes: any[];
  userData: any;
};

export async function getHeadModel(mii: Mii): Promise<GLTF> {
  // In the future, this could be hooked up to a custom rendering library (FFL under WASM or a custom asset loader)
  // For now, this will just return a cube with some FFL shader properties to test if it's working.
  const geometry = new THREE.BoxGeometry(45, 45, 45);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 25, 0);

  // Boilerplate data for use with the shader
  mesh.geometry.userData = {
    cullMode: 1,
    modulateType: cMaterialName.FFL_MODULATE_TYPE_SHAPE_FACELINE,
    modulateColor: [1, 0, 0, 1],
    modulateMode: 0,
  };

  const asset = {
    extras: {
      partsTransform: {
        hatTranslate: [0, 0, 0],
      },
    },
  };

  let scene = new THREE.Group();

  scene.add(mesh);

  // GLTF-like object so that the code can still handle it sort of like one
  return {
    animations: [],
    asset,
    cameras: [],
    parser: {},
    scene,
    scenes: [scene],
    userData: {},
  } as GLTFLike as GLTF;
}
