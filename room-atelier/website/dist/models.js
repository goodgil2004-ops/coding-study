import {
  saveFile
} from "./file-save.js";
/**
 * 3D 파일 입출력과 도형 조립, IndexedDB 저장
 * 한국어 해설판: 주석과 줄바꿈을 정리했습니다. 실제 처리 방식은 원본과 같습니다.
 */
import * as THREE from "three";
import {
  GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";
import {
  OBJLoader
} from "three/addons/loaders/OBJLoader.js";
import {
  MTLLoader
} from "three/addons/loaders/MTLLoader.js";
import {
  STLLoader
} from "three/addons/loaders/STLLoader.js";
import {
  DRACOLoader
} from "three/addons/loaders/DRACOLoader.js";
import {
  GLTFExporter
} from "three/addons/exporters/GLTFExporter.js";
import {
  MeshoptDecoder
} from "three/addons/libs/meshopt_decoder.module.js";
import {
  clone as cloneSkeleton
} from "three/addons/utils/SkeletonUtils.js";

/* 파싱 완료된 Three.js 모델을 ID별로 메모리에 보관합니다. 파일로 저장하는 JSON 원본과 구분합니다. */
export const assetCache = new Map();
const textDecoder = new TextDecoder();

/* 선택한 파일을 data: URL로 읽습니다. 바이너리를 Base64 문자열로 담으면 JSON 공간 파일 안에 포함할 수 있습니다. */
export const readDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(Error("파일을 읽지 못했어요."));
    r.readAsDataURL(file);
  });

/* 저장해 둔 Base64 문자열을 로더가 이해하는 ArrayBuffer로 되돌립니다. */
function bufferFromData(data) {
  const encoded = data.slice(data.indexOf(",") + 1),
    raw = atob(encoded),
    array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array.buffer;
}

/* 주 모델은 하나만 허용하되 BIN/텍스처/MTL은 함께 받습니다. 전체 25MB 제한은 과도한 메모리 사용을 줄이기 위한 것입니다. */
export async function collectModelFiles(files) {
  const list = [...files],
    models = list.filter((f) => /\.(glb|gltf|obj|stl)$/i.test(f.name));
  if (models.length !== 1)
    throw Error(
      "모델 파일은 한 개를 선택해 주세요. glTF의 BIN·텍스처 파일은 함께 선택할 수 있어요.",
    );
  if (list.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024)
    throw Error("모델과 텍스처를 합쳐 25MB 이하로 선택해 주세요.");
  const main = models[0],
    resources = {};
  for (const f of list) {
    if (f !== main) resources[f.name] = await readDataURL(f);
  }
  const record = {
    name: main.name,
    format: main.name.split(".").pop().toLowerCase(),
    data: await readDataURL(main),
    resources,
  };
  const group = await parseModel(record);
  return {
    record,
    group
  };
}

/* 파일 확장자별 로더를 선택합니다. GLB/glTF에는 Draco와 Meshopt 압축 해제기를 연결합니다. */
export async function parseModel(record) {
  const manager = new THREE.LoadingManager(),
    urls = [],
    resourceURLs = new Map();
  let missing = "";

  /* 모델이 참조한 파일 경로를 사용자가 같이 고른 리소스의 Blob URL로 바꿉니다. 필요한 파일이 빠지면 이름을 포함한 오류를 냅니다. */
  manager.setURLModifier((url) => {
    if (/^(data:|blob:)/.test(url)) return url;
    if (url.includes("/vendor/libs/draco/")) return url;
    let path;
    try {
      path = decodeURIComponent(url.split("?")[0]);
    } catch {
      path = url;
    }
    const filename = path.split("/").pop();
    const data = record.resources?.[path] || record.resources?.[filename];
    if (!data) {
      missing = filename;
      throw Error(`참조 파일 '${filename}'이 필요해요. 모델과 함께 선택해 주세요.`);
    }
    if (!resourceURLs.has(filename)) {
      const blob = new Blob([bufferFromData(data)], {
        type: data.slice(5, data.indexOf(";"))
      });
      const local = URL.createObjectURL(blob);
      urls.push(local);
      resourceURLs.set(filename, local);
    }
    return resourceURLs.get(filename);
  });
  const raw = bufferFromData(record.data);
  let group;
  try {
    if (record.format === "glb" || record.format === "gltf") {
      const loader = new GLTFLoader(manager),
        draco = new DRACOLoader();
      draco.setDecoderPath(new URL("./vendor/libs/draco/", import.meta.url).href);
      loader.setDRACOLoader(draco);
      loader.setMeshoptDecoder(MeshoptDecoder);
      try {
        const result = await loader.parseAsync(
          record.format === "glb" ? raw : textDecoder.decode(raw),
          "",
        );
        group = result.scene;
      } finally {
        draco.dispose();
      }
    } else if (record.format === "obj") {
      const loader = new OBJLoader(manager),
        mtl = Object.entries(record.resources || {}).find(([name]) => /\.mtl$/i.test(name));
      if (mtl) {
        const mats = new MTLLoader(manager).parse(textDecoder.decode(bufferFromData(mtl[1])), "");
        mats.preload();
        loader.setMaterials(mats);
      }
      group = loader.parse(textDecoder.decode(raw));
      if (urls.length)
        await new Promise((resolve, reject) => {
          manager.onLoad = resolve;
          manager.onError = (u) => reject(Error(`텍스처를 읽지 못했어요: ${u}`));
          setTimeout(resolve, 6000);
        });
    } else if (record.format === "stl") {
      const geometry = new STLLoader().parse(raw);
      const m = new THREE.MeshStandardMaterial({
        color: "#b5ae9b",
        roughness: 0.75,
        vertexColors: !!geometry.getAttribute("color"),
      });
      group = new THREE.Group();
      group.add(new THREE.Mesh(geometry, m));
    } else throw Error("GLB, glTF, OBJ, STL 파일을 지원합니다.");
    if (record.upAxisTurns) group.rotation.x -= (record.upAxisTurns * Math.PI) / 2;

    /* 표시할 면이 있는지, 크기가 정상인지, 삼각형이 150만 개 이하인지 확인합니다. */
    let triangles = 0,
      meshes = 0;
    group.traverse((m) => {
      if (m.isMesh) {
        meshes++;
        triangles += (m.geometry.index?.count || m.geometry.attributes.position?.count || 0) / 3;
        m.castShadow = true;
        m.receiveShadow = true;
        for (const mat of [].concat(m.material)) mat.side = THREE.DoubleSide;
      }
    });
    const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    if (!meshes || !Number.isFinite(size.length()) || Math.max(size.x, size.y, size.z) < 0.000001)
      throw Error("이 파일에 표시할 수 있는 3D 면이 없어요.");
    if (triangles > 1500000)
      throw Error("모델이 너무 복잡합니다. 150만 삼각형 이하로 줄여 주세요.");
    return group;
  } catch (e) {
    if (missing) throw Error(`참조 파일 '${missing}'이 필요해요. 모델과 함께 선택해 주세요.`);
    if (/ktx|basis/i.test(e.message))
      throw Error("KTX2 텍스처는 지원하지 않아요. PNG/JPG 텍스처를 포함한 GLB로 내보내 주세요.");
    throw e;
  } finally {
    for (const u of urls) URL.revokeObjectURL(u);
  }
}

/* 같은 모델을 여러 가구로 배치해도 수정/삭제가 서로 영향을 주지 않도록 기하와 재질을 복제합니다. */
export function cloneModel(o) {
  const base = assetCache.get(o.assetId);
  if (!base) return new THREE.Group();
  const group = cloneSkeleton(base);
  group.traverse((m) => {
    if (m.isMesh) {
      m.geometry = m.geometry.clone();
      m.material = Array.isArray(m.material) ?
        m.material.map((x) => x.clone()) :
        m.material.clone();
      if (o.tint)
        for (const mat of [].concat(m.material)) mat.color?.set(o.color);
    }
  });
  return group;
}

/* 모델 바닥을 Y=0에, X/Z 중심을 원점에 맞춘 후 w/h/d cm에 맞게 스케일을 적용합니다. */
export function normalizeModel(group, o) {
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group),
    size = bounds.getSize(new THREE.Vector3()),
    center = bounds.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  group.position.x -= center.x;
  group.position.y -= bounds.min.y;
  group.position.z -= center.z;
  wrapper.add(group);
  wrapper.scale.set(
    o.w / 100 / Math.max(0.0001, size.x),
    o.h / 100 / Math.max(0.0001, size.y),
    o.d / 100 / Math.max(0.0001, size.z),
  );
  wrapper.userData.id = o.id;
  return wrapper;
}

/* 초기 치수의 추정치입니다. glTF 계열의 미터 단위를 cm로 바꾸며, OBJ/STL은 단위가 불명확해 실제 치수 확인이 필요합니다. */
export function modelDimensions(group, format) {
  const s = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
  let scale = ["glb", "gltf"].includes(format) ? 100 : 1;
  const max = Math.max(s.x, s.y, s.z) * scale;
  if (max > 600 || max < 5) scale = 100 / Math.max(s.x, s.y, s.z);
  return {
    w: Math.max(1, Math.round(s.x * scale)),
    d: Math.max(1, Math.round(s.z * scale)),
    h: Math.max(1, Math.round(s.y * scale)),
  };
}

/* 저장된 도형 명세를 상자·원기둥·구·원뿔 Mesh로 바꾸고 위치/회전/색상을 적용합니다. */
export function makeParts(parts) {
  const group = new THREE.Group();
  for (const p of parts) {
    let g;
    if (p.shape === "cylinder") g = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    else if (p.shape === "sphere") g = new THREE.SphereGeometry(0.5, 24, 16);
    else if (p.shape === "cone") g = new THREE.ConeGeometry(0.5, 1, 32);
    else g = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: 0.72
      }),
    );
    m.scale.set(p.w / 100, p.h / 100, p.d / 100);
    m.position.set(p.x / 100, p.y / 100, p.z / 100);
    m.rotation.set((p.rx * Math.PI) / 180, (p.ry * Math.PI) / 180, (p.rz * Math.PI) / 180);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.partId = p.id;
    group.add(m);
  }
  return group;
}

/* 장면 배치 좌표를 제거한 복사본을 GLTFExporter에 넣어 binary GLB로 내보냅니다. */
export async function exportGLB(group, name) {
  const clean = group.clone(true);
  clean.position.set(0, 0, 0);
  clean.rotation.set(0, 0, 0);
  const result = await new GLTFExporter().parseAsync(clean, {
    binary: true,
    onlyVisible: true
  });
  saveFile(result, name.replace(/[<>:"/\\|?*]/g, "_") + ".glb", "model/gltf-binary");
}

/* 공간 파일을 열 때 아직 메모리에 없는 모델 원본을 파싱하여 캐시에 복구합니다. */
export async function loadProjectAssets(assets) {
  for (const [id, record] of Object.entries(assets || {})) {
    if (!assetCache.has(id)) assetCache.set(id, await parseModel(record));
  }
}

/* IndexedDB의 projects/current에 공간을 읽거나 씁니다. transaction 완료를 기다린 뒤 DB 연결을 닫습니다. */
export function projectDB(mode, value) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("room-atelier", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("projects");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result,
        tx = db.transaction("projects", mode === "get" ? "readonly" : "readwrite"),
        store = tx.objectStore("projects"),
        op = mode === "get" ? store.get("current") : store.put(value, "current");
      let result;
      op.onsuccess = () => (result = op.result);
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

/* 제작 가구는 1~80개의 유효한 도형 명세여야 합니다. 도형 종류·색·숫자 범위를 검증합니다. */
export function validateParts(parts) {
  if (!Array.isArray(parts) || !parts.length || parts.length > 80)
    throw Error("도형은 1~80개까지 사용할 수 있어요.");
  return parts.map((p, i) => {
    if (
      !["box", "cylinder", "sphere", "cone"].includes(p.shape) ||
      !/^#[0-9a-f]{6}$/i.test(p.color)
    )
      throw Error("도형 정보가 올바르지 않아요.");
    for (const k of ["w", "h", "d", "x", "y", "z", "rx", "ry", "rz"])
      if (
        !Number.isFinite(p[k]) ||
        Math.abs(p[k]) > 1200 ||
        (["w", "h", "d"].includes(k) && p[k] < 0.1)
      )
        throw Error("도형의 치수 또는 위치가 올바르지 않아요.");
    return {
      ...p,
      id: `part-${i + 1}`,
      name: String(p.name || "도형").slice(0, 30)
    };
  });
}
