import {
  createAutosave,
  recoveryCandidates
} from "./autosave.js";
import {
  deskItems,
  deskKinds,
  buildDeskItem,
  placeOnDesk
} from "./desk-items.js";
import {
  saveFile
} from "./file-save.js";
/**
 * 공간 편집기의 중심: 상태, 3D 장면, 이벤트, 저장
 * 한국어 해설판: 주석과 줄바꿈을 정리했습니다. 실제 처리 방식은 원본과 같습니다.
 */

/* Three.js는 3D 라이브러리입니다. 아래 모듈은 화면 조작·모델 파일·제작실·방 윤곽을 역할별로 나눕니다. */
import * as THREE from "three";
import {
  OrbitControls
} from "three/addons/OrbitControls.js";
import {
  assetCache,
  collectModelFiles,
  cloneModel,
  normalizeModel,
  modelDimensions,
  makeParts,
  exportGLB,
  loadProjectAssets,
  projectDB,
  validateParts,
} from "./models.js";
import {
  createBuilder
} from "./builder.js";
import {
  roomOutline,
  polygonArea,
  pointInside,
  validateOutline,
  createOutlineEditor,
} from "./outline.js";

/* 문서에서 HTML 요소를 찾는 단축 함수입니다. $는 하나, $$는 여러 요소를 배열로 반환합니다. */
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];

/* 버튼의 SVG 아이콘 경로 데이터입니다. 실제 가구의 3D 형상과는 별개의 UI 자산입니다. */
const icons = {
  cube: "M12 3 3 8v9l9 5 9-5V8z M3 8l9 5 9-5 M12 13v9",
  save: "M5 3h12l4 4v14H3V3z M7 3v6h10V3 M7 21v-8h10v8",
  download: "M12 3v12m-5-5 5 5 5-5 M4 16v5h16v-5",
  folder: "M3 6h7l2 3h9v11H3z",
  scan: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5 M7 8l5-3 5 3v8l-5 3-5-3z M7 8l5 4 5-4m-5 4v7",
  search: "M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  undo: "M9 4 4 9l5 5 M4 9h10a6 6 0 0 1 0 12",
  redo: "M15 4 20 9l-5 5 M20 9H10a6 6 0 0 0 0 12",
  camera: "M3 7h5l2-3h4l2 3h5v14H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  focus: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8m-4-4v8",
  walls: "M3 20V5l9-3 9 3v15l-9-3z M12 2v15",
  mouse: "M8 3h8a3 3 0 0 1 3 3v11a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V6a3 3 0 0 1 3-3 M12 3v6",
  rotate: "M20 8V3l-4 4 M20 8a9 9 0 1 0 1 8",
  copy: "M8 8h13v13H8z M16 8V3H3v13h5",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7m4-7v7",
  cursor: "M4 3l6 18 3-8 8-3z",
  ruler: "M3 16 16 3l5 5L8 21z M8 11l3 3m1-7 3 3",
  upload: "M12 16V3m-5 5 5-5 5 5 M3 16v5h18v-5",
  close: "M5 5l14 14M19 5 5 19",
};

function icon(n) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[n] || icons.cube}"/></svg>`;
}
$$("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));

/* 기본 가구의 설계값입니다. w=가로, d=세로, h=높이이며 모두 cm 단위입니다. */
const catalog = [{
  type: "bed",
  name: "포근한 싱글 침대",
  w: 110,
  d: 205,
  h: 75,
  color: "#e7dec9",
  category: "bed",
}, {
  type: "desk",
  name: "오크 워크 데스크",
  w: 150,
  d: 65,
  h: 75,
  color: "#c5a580",
  category: "work",
}, {
  type: "chair",
  name: "라운드 데스크 체어",
  w: 58,
  d: 60,
  h: 90,
  color: "#878e81",
  category: "work",
}, {
  type: "wardrobe",
  name: "슬림 수납장",
  w: 75,
  d: 60,
  h: 235,
  color: "#e0dfd5",
  category: "bed",
}, {
  type: "shelf",
  name: "오픈 우드 책장",
  w: 95,
  d: 30,
  h: 200,
  color: "#b49673",
  category: "work",
}, {
  type: "sofa",
  name: "컴팩트 2인 소파",
  w: 150,
  d: 80,
  h: 80,
  color: "#bda887",
  category: "bed",
}, {
  type: "plant",
  name: "초록 한 조각",
  w: 45,
  d: 45,
  h: 120,
  color: "#6b7955",
  category: "decor",
}, {
  type: "rug",
  name: "내추럴 울 러그",
  w: 160,
  d: 130,
  h: 2,
  color: "#d0c3a7",
  category: "decor",
}, ];
catalog.push(...deskItems);
const kindNames = {
  ...deskKinds,
  imported: "가져온 3D 모델",
  custom: "직접 만든 가구",
  wall: "벽 · 가벽",
  bed: "침대",
  desk: "책상 · 테이블",
  chair: "의자",
  wardrobe: "옷장",
  shelf: "책장",
  sofa: "소파",
  plant: "식물",
  rug: "러그",
  box: "자유형",
};
let nextId = 1;

/* 가구마다 고유 ID를 부여하고 방 안의 X/Z 위치, 회전각을 붙입니다. Y는 바닥에서 띄우는 높이입니다. */
function newObject(template, x = 0, z = 0, rotation = 0) {
  return {
    ...template,
    id: `item-${nextId++}`,
    x,
    z,
    rotation,
    feature: template.feature || "standard",
  };
}

/* 저장 가능한 모델 원본 데이터와 렌더링용 메모리 캐시(assetCache)를 구분합니다. */
let assetRecords = {};

/* 앱의 기준 데이터입니다. room은 방의 구조, objects는 배치된 가구와 벽의 목록입니다. */
let state = {
  version: 2,
  room: {
    w: 400,
    d: 360,
    h: 270,
    wall: "#e4e2db",
    floor: "#b98a5d"
  },
  objects: [
    newObject(catalog[0], -128, 65),
    newObject(catalog[1], 98, -124),
    newObject(catalog[2], 97, -25),
    newObject(catalog[3], -149, -145),
    newObject(catalog[4], -45, -161),
    newObject(catalog[6], 160, 105),
    newObject(catalog[7], 57, 60),
  ],
};

/* 선택·검색·카메라·실행 취소 등의 화면 상태입니다. history와 future는 이전/다음 변경 내역을 보관합니다. */
let selectedId = state.objects[0].id,
  history = [],
  future = [],
  category = "all",
  search = "",
  isTop = false,
  wallsVisible = true,
  dirty = false;
let renderer,
  scene,
  camera,
  controls,
  roomGroup,
  objectsGroup,
  selectionRing,
  dimensionsGroup,
  thumbRenderer,
  thumbScene,
  thumbCamera;
const viewport = $("#viewport"),
  meshMap = new Map(),
  thumbnailCache = new Map(),
  textureCache = new Map();
const snapshot = () => JSON.stringify(state);

/* 현재 배치에서 참조하는 모델 원본만 모아 내보내기/저장용 데이터를 만듭니다. 서버 전송은 하지 않습니다. */
function projectData() {
  const assets = {};
  for (const o of state.objects)
    if (o.assetId) assets[o.assetId] = assetRecords[o.assetId];
  return {
    ...state,
    version: 2,
    assets
  };
}

// 저장 구현은 autosave.js에 위임하고, 이 파일은 화면 메시지와 공간 데이터만 연결합니다.
const autosave = createAutosave({
  getData: projectData,
  write: value => projectDB("put", value),
  storage: localStorage,
  onStatus: status => {
    const label = {
      saving: "자동 저장 중…",
      saved: "자동 저장됨",
      error: "저장 실패 · 파일로 백업해 주세요",
      "backup-error": "복구용 저장 공간 부족"
    };
    $("#save-state").textContent = label[status];
    if (status === "saved") dirty = false;
    if (status === "error") toast("자동 저장에 실패했어요. 파일 저장으로 백업해 주세요.");
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") autosave.flush().catch(() => {});
});
window.addEventListener("pagehide", () => {
  autosave.flush().catch(() => {});
});

/* 변경 직전 state를 JSON 문자열로 보관합니다. 최대 30단계만 유지하고 새 변경 이후의 redo 기록을 지웁니다. */
function checkpoint() {
  // checkpoint는 변경 직전에 호출됩니다. 마이크로태스크는 현재 이벤트의 변경 뒤 실행됩니다.
  queueMicrotask(() => autosave.schedule());
  history.push(snapshot());
  if (history.length > 30) history.shift();
  future = [];
  dirty = true;
  $("#save-state").textContent = "저장되지 않은 변경";
  syncUndo();
}

function syncUndo() {
  $("#undo").disabled = !history.length;
  $("#redo").disabled = !future.length;
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 2800);
}

/* 장면에서 제거한 객체의 GPU 기하와 재질 자원을 해제합니다. DOM에서 지우는 것만으로는 GPU 자원이 정리되지 않습니다. */
function dispose(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) {
      for (const m of [].concat(o.material)) m.dispose();
    }
  });
}

/* 색상과 거칠기를 가진 표준 재질을 만듭니다. 광원과 함께 물체의 밝기와 입체감이 정해집니다. */
function material(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    ...opts
  });
}

/* 둥근 모서리의 2D 윤곽을 만든 후 ExtrudeGeometry로 두께를 줍니다. */
function roundedGeometry(w, h, d, r) {
  r = Math.min(r, w / 3, h / 3, d / 3);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.002, d - r * 2),
    bevelEnabled: true,
    bevelSize: r * 0.4,
    bevelThickness: r,
    bevelSegments: 3,
    steps: 1,
    curveSegments: 5,
  });
  g.center();
  return g;
}

/* 가구 한 개의 렌더링 객체를 만듭니다. 외부 모델·직접 만든 가구는 전용 경로로 처리하고, 기본 가구는 상자/원기둥/구를 조합합니다. */
function makeFurniture(o) {
  if (o.type === "imported") return normalizeModel(cloneModel(o), o);
  if (o.type === "custom") return normalizeModel(makeParts(o.parts), o);
  const group = new THREE.Group(),
    c = o.color,
    slim = o.feature === "slim",
    rounded = o.feature === "rounded",
    frame = slim ? 0.022 : 0.04;

  function box(w, h, d, col, x = 0, y = h / 2, z = 0, r = 0) {
    if (rounded) r = Math.max(r * 1.4, Math.min(w, h, d) * 0.18);
    const mesh = new THREE.Mesh(
      r ? roundedGeometry(w, h, d, r) : new THREE.BoxGeometry(w, h, d),
      material(col),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function cyl(rt, rb, h, col, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 24), material(col));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  function legs(y = 0.43, height = 0.86, col = "#514d40") {
    for (const x of [-0.44, 0.44])
      for (const z of [-0.41, 0.41]) box(frame, height, frame, col, x, y, z);
  }

  /* 문과 창은 벽에서 구멍을 빼는 불리언 연산 대신, 개구부 주변의 상자 조각들을 배치해 표현합니다. */
  if (buildDeskItem(o.type, {
      box,
      cyl
    }, c)) {
    // Additional catalogue models use the same sizing and material pipeline.
  } else if (o.type === "wall") {
    const gap = THREE.MathUtils.clamp((o.openingW || 90) / o.w, 0.05, 0.95),
      opening = THREE.MathUtils.clamp((o.openingH || 210) / o.h, 0.05, 0.95);
    if (o.wallType === "door" || o.wallType === "window") {
      const side = (1 - gap) / 2;
      for (const x of [-(gap + side) / 2, (gap + side) / 2]) box(side, 1, 1, c, x, 0.5, 0);
      if (o.wallType === "door") {
        box(gap, 1 - opening, 1, c, 0, (1 + opening) / 2, 0);
      } else {
        const sill = Math.min(0.35, 1 - opening - 0.03);
        box(gap, sill, 1, c, 0, sill / 2, 0);
        box(gap, 1 - sill - opening, 1, c, 0, (1 + sill + opening) / 2, 0);
      }
    } else box(1, 1, 1, c, 0, 0.5, 0);

    /* 침대의 프레임·매트리스·베개를 여러 상자로 조립합니다. 각 가구 분기 아래 숫자는 최종 치수가 아닌 상대적인 형상 비율입니다. */
  } else if (o.type === "bed") {
    box(0.94, 0.27, 0.93, "#a9a294", 0, 0.205, 0.025, 0.025);
    box(1, 0.3, 0.95, "#eeeae0", 0, 0.485, 0.025, 0.045);
    box(0.98, 0.1, 0.64, c, 0, 0.65, 0.17, 0.035);
    box(0.94, 0.4, 0.58, c, 0, 0.42, 0.2, 0.04);
    box(1, 0.95, 0.055, "#b2a790", 0, 0.475, -0.47, 0.02);
    box(0.65, 0.15, 0.18, "#faf7ed", 0, 0.7, -0.29, 0.05);
    for (const x of [-0.38, 0.38])
      for (const z of [-0.36, 0.36]) box(0.06, 0.1, 0.05, "#514c42", x, 0.05, z);
  } else if (o.type === "desk") {
    legs(0.46, 0.92, slim ? "#43483e" : "#a9a89d");
    box(1, 0.07, 1, c, 0, 0.955, 0, rounded ? 0.045 : 0.008);
    box(0.37, 0.12, 0.82, "#e3e0d4", -0.27, 0.86, 0);
    box(0.06, 0.014, 0.02, "#787c70", -0.26, 0.86, 0.42);
    // Accessories stay inside the requested furniture bounds.
  } else if (o.type === "chair") {
    cyl(0.038, 0.045, 0.38, "#454b44", 0, 0.29, 0);
    box(0.82, 0.1, 0.8, c, 0, 0.49, 0.04, 0.04);
    box(0.8, 0.47, 0.12, c, 0, 0.765, -0.35, 0.04);
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5,
        m = box(0.045, 0.035, 0.42, "#444b43", Math.sin(a) * 0.15, 0.1, Math.cos(a) * 0.15);
      m.rotation.y = a;
      cyl(0.065, 0.065, 0.06, "#343c35", Math.sin(a) * 0.35, 0.04, Math.cos(a) * 0.35);
    }
    for (const x of [-0.45, 0.45]) {
      box(0.035, 0.22, 0.04, "#5a6054", x, 0.6, 0.03);
      box(0.08, 0.035, 0.62, "#beac88", x, 0.72, 0.02, rounded ? 0.015 : 0);
    }
  } else if (o.type === "wardrobe") {
    box(1, 0.96, 1, c, 0, 0.52, 0, rounded ? 0.025 : 0);
    box(0.012, 0.91, 0.012, "#9fa295", 0, 0.52, 0.502);
    for (const x of [-0.07, 0.07]) box(0.015, 0.1, 0.025, "#9e9786", x, 0.52, 0.518);
    box(0.9, 0.04, 0.85, "#646a5c", 0, 0.02, 0);
    box(1.02, 0.025, 1.02, "#c6ad82", 0, 0.99, 0);
  } else if (o.type === "shelf") {
    box(1, 1, 0.04, c, 0, 0.5, -0.48);
    for (const x of [-0.47, 0.47]) box(0.055, 1, 1, c, x, 0.5, 0);
    for (let j = 0; j <= 5; j++) {
      box(0.94, 0.027, 1, c, 0, j * 0.194 + 0.015, 0);
      if (j < 5) {
        for (let i = 0; i < 7; i++) {
          const col = ["#72776b", "#495247", "#c4bca8", "#8b9182", "#5d6257", "#d0c9b6", "#868577"][
            (i + j) % 7
          ];
          box(0.055, 0.13 + (i % 3) * 0.015, 0.63, col, -0.37 + i * 0.108, j * 0.194 + 0.1, -0.08);
        }
      }
    }
  } else if (o.type === "sofa") {
    for (const x of [-0.4, 0.4])
      for (const z of [-0.3, 0.3]) box(0.055, 0.13, 0.06, "#686050", x, 0.065, z);
    box(0.96, 0.3, 0.92, c, 0, 0.31, 0, 0.055);
    box(0.98, 0.56, 0.18, c, 0, 0.69, -0.39, 0.045);
    for (const x of [-0.43, 0.43]) box(0.15, 0.39, 0.9, c, x, 0.57, 0.01, 0.05);
    for (const x of [-0.2, 0.2]) box(0.37, 0.11, 0.68, "#d4c5aa", x, 0.51, 0.05, 0.045);
  } else if (o.type === "plant") {
    cyl(0.27, 0.19, 0.3, "#c2ad90", 0, 0.15, 0);
    cyl(0.24, 0.24, 0.012, "#4c4c34", 0, 0.302, 0);
    cyl(0.02, 0.029, 0.61, "#6f7048", 0, 0.59, 0);
    for (let j = 0; j < 11; j++) {
      const angle = j * 2.4;
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 10),
        material(j % 2 ? c : "#869069"),
      );
      leaf.scale.set(0.115, 0.16, 0.024);
      leaf.position.set(
        Math.sin(angle) * (0.16 + j * 0.009),
        0.45 + j * 0.042,
        Math.cos(angle) * (0.16 + j * 0.009),
      );
      leaf.rotation.set(0.3, angle, 0.5);
      leaf.castShadow = true;
      group.add(leaf);
    }
  } else if (o.type === "rug") {
    box(1, 1, 1, c, 0, 0.5, 0, 0);
    for (let j = 0; j < 5; j++) {
      box(0.008, 0.01, 0.93, "#b1a68f", -0.46 + j * 0.015, 1.005, 0);
      box(0.008, 0.01, 0.93, "#b1a68f", 0.46 - j * 0.015, 1.005, 0);
    }
  } else {
    box(1, 1, 1, c, 0, 0.5, 0, rounded ? 0.05 : 0);
  }

  /* 이전 사진 기능으로 저장한 공간 파일을 다시 열기 위한 호환 코드입니다. 현재 UI는 사진 자동 3D 복원을 제공하지 않습니다. */
  if (o.photo && o.texture) {
    let t = textureCache.get(o.photo);
    if (!t) {
      t = new THREE.TextureLoader().load(o.photo, () => {
        thumbnailCache.clear();
        if (thumbRenderer) syncInspector();
      });
      t.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(o.photo, t);
    }
    let p;
    if (o.photoSurface === "top" || (!o.photoSurface && ["desk", "rug", "bed"].includes(o.type))) {
      p = new THREE.Mesh(
        new THREE.PlaneGeometry(o.type === "bed" ? 0.96 : 0.98, o.type === "bed" ? 0.58 : 0.98),
        material("#ffffff", {
          map: t,
          side: THREE.DoubleSide
        }),
      );
      p.rotation.x = -Math.PI / 2;
      p.position.set(0, o.type === "bed" ? 0.708 : 1.002, o.type === "bed" ? 0.18 : 0);
    } else {
      p = new THREE.Mesh(
        new THREE.PlaneGeometry(0.88, 0.83),
        material("#ffffff", {
          map: t,
          side: THREE.DoubleSide
        }),
      );
      p.position.set(0, 0.55, 0.512);
    }
    group.add(p);
  }

  /* 기본 가구의 실제 외곽 크기를 구하고 중심과 바닥을 정렬한 뒤 입력 cm를 100으로 나눠 3D 장면 크기에 맞춥니다. */
  const bounds = new THREE.Box3().setFromObject(group),
    size = bounds.getSize(new THREE.Vector3()),
    center = bounds.getCenter(new THREE.Vector3());
  for (const child of group.children) {
    child.position.x -= center.x;
    child.position.y -= bounds.min.y;
    child.position.z -= center.z;
  }
  group.scale.set(o.w / 100 / size.x, o.h / 100 / size.y, o.d / 100 / size.z);
  group.userData.id = o.id;
  return group;
}

/* Canvas 2D로 마루 무늬를 그린 뒤 3D 바닥 재질의 텍스처로 사용합니다. 같은 난수 시드로 무늬를 재현합니다. */
function woodTexture(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1024, 1024);
  let seed = 123;

  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  for (let y = 0; y < 1024; y += 64) {
    ctx.fillStyle = `rgba(70,42,20,${rnd() * 0.09})`;
    ctx.fillRect(0, y, 1024, 64);
    ctx.strokeStyle = "#6e4e363a";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, y, 1024, 64);
    for (let x = 0; x < 1024; x += 256) {
      let start = x + (y % 128 === 0 ? 0 : 128);
      ctx.beginPath();
      ctx.moveTo(start, y);
      ctx.lineTo(start, y + 64);
      ctx.stroke();
    }
    for (let j = 0; j < 34; j++) {
      ctx.strokeStyle = `rgba(70,42,20,${rnd() * 0.07})`;
      ctx.lineWidth = 1;
      const yy = y + rnd() * 64;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(300, yy + 4, 700, yy - 4, 1024, yy);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(state.room.w / 400, state.room.d / 360);
  tex.anisotropy = 8;
  return tex;
}

/* 방 치수 라벨을 캔버스에 그려 카메라를 바라보는 Sprite로 표시합니다. */
function textSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  ctx.font = "500 36px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "#77806d";
  ctx.fillText(text, 192, 50);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: t,
      depthTest: false,
      transparent: true
    }),
  );
  s.scale.set(1.35, 0.28, 1);
  return s;
}

/* 방 윤곽에서 바닥과 외벽을 다시 만듭니다. 데이터는 cm, 장면 좌표는 m 상당의 단위로 변환합니다. */
function buildRoom() {
  if (roomGroup) {
    roomGroup.traverse((o) => {
      if (o.material?.map) o.material.map.dispose();
    });
    dispose(roomGroup);
    scene.remove(roomGroup);
  }
  roomGroup = new THREE.Group();
  scene.add(roomGroup);
  const {
    w,
    d,
    h,
    wall,
    floor
  } = state.room,
    W = w / 100,
    D = d / 100,
    H = h / 100,
    points = roomOutline(state.room).map((p) => [p[0] / 100, p[1] / 100]);

  function b(x, y, z, c, px, py, pz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x, y, z), material(c));
    m.position.set(px, py, pz);
    m.receiveShadow = true;
    m.castShadow = true;
    roomGroup.add(m);
    return m;
  }
  const shape = new THREE.Shape();
  points.forEach((p, i) => (i ? shape.lineTo(p[0], -p[1]) : shape.moveTo(p[0], -p[1])));
  shape.closePath();
  const base = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.12,
      bevelEnabled: false
    }),
    material("#c7c8bc"),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.12;
  base.receiveShadow = true;
  roomGroup.add(base);
  const fm = material(floor);
  fm.map = woodTexture(floor);
  fm.map.repeat.set(0.25, 0.2778);
  const floorMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), fm);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0.002;
  floorMesh.receiveShadow = true;
  roomGroup.add(floorMesh);

  /* 다각형의 각 변마다 벽을 만들고 변의 방향으로 회전합니다. 외향 법선은 카메라 쪽 벽을 숨기는 판정에 사용합니다. */
  points.forEach((a, i) => {
    const p = points[(i + 1) % points.length],
      dx = p[0] - a[0],
      dz = p[1] - a[1],
      len = Math.hypot(dx, dz),
      mx = (a[0] + p[0]) / 2,
      mz = (a[1] + p[1]) / 2;
    const wallMesh = b(len, H, 0.075, wall, mx, H / 2, mz);
    wallMesh.rotation.y = -Math.atan2(dz, dx);
    wallMesh.userData.outerWall = {
      nx: dz / len,
      nz: -dx / len,
      x: mx,
      z: mz
    };
    const trim = b(len, 0.09, 0.083, "#d4d6cb", mx, 0.045, mz);
    trim.rotation.y = wallMesh.rotation.y;
    trim.userData.outerWall = wallMesh.userData.outerWall;
  });
  if (state.room.shape !== "custom") {
    const decor = new THREE.Group();
    decor.userData.outerWall = {
      nx: -1,
      nz: 0,
      x: -W / 2,
      z: 0
    };
    roomGroup.add(decor);
    const wz = -D * 0.12,
      wy = H * 0.55,
      wh = Math.min(1.9, H * 0.7),
      wd = Math.min(1.1, D * 0.34);

    function windowBox(...args) {
      const m = b(...args);
      decor.add(m);
      return m;
    }
    windowBox(0.045, wh, wd, "#c2c9c0", -W / 2 + 0.045, wy, wz);
    for (const z of [wz - wd / 2, wz + wd / 2])
      windowBox(0.05, wh + 0.09, 0.04, "#f5f1e6", -W / 2 + 0.08, wy, z);
    for (const y of [wy - wh / 2, wy + wh / 2])
      windowBox(0.09, 0.035, wd + 0.1, "#f5f1e6", -W / 2 + 0.09, y, wz);
    windowBox(0.06, 0.045, wd + 0.28, "#5f6154", -W / 2 + 0.14, wy + wh / 2 + 0.05, wz);
    for (let i = 0; i < 23; i++) {
      const m = windowBox(
        0.055 + (i % 2) * 0.025,
        wh + 0.13,
        (wd / 22) * 0.9,
        i % 2 ? "#dfdacb" : "#eee9dc",
        -W / 2 + 0.14,
        wy - 0.03,
        wz - wd / 2 + (i * wd) / 22,
      );
      m.castShadow = false;
    }
  }
  if (dimensionsGroup) {
    dimensionsGroup.traverse((o) => o.material?.map?.dispose());
    dispose(dimensionsGroup);
    scene.remove(dimensionsGroup);
  }
  dimensionsGroup = new THREE.Group();
  scene.add(dimensionsGroup);

  function dimension(a, b, text, pos) {
    const pts = [new THREE.Vector3(...a), new THREE.Vector3(...b)];
    dimensionsGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({
          color: "#a6ad9a",
          transparent: true,
          opacity: 0.65
        }),
      ),
    );
    const label = textSprite(text);
    label.position.set(...pos);
    dimensionsGroup.add(label);
  }
  dimension([-W / 2, 0.005, D / 2 + 0.31], [W / 2, 0.005, D / 2 + 0.31], w + " cm", [
    0,
    0.02,
    D / 2 + 0.53,
  ]);
  dimension([W / 2 + 0.3, 0.005, -D / 2], [W / 2 + 0.3, 0.005, D / 2], d + " cm", [
    W / 2 + 0.57,
    0.04,
    0,
  ]);
  $("#room-summary").innerHTML =
    (w / 100).toFixed(1) +
    " × " +
    (d / 100).toFixed(1) +
    " m <span>·</span> " +
    (Math.abs(polygonArea(roomOutline(state.room))) / 10000).toFixed(1) +
    " m²";
}

/* state.objects의 각 항목을 3D 객체로 변환하고 ID→Mesh 맵을 갱신합니다. */
function buildObjects() {
  if (objectsGroup) {
    dispose(objectsGroup);
    scene.remove(objectsGroup);
  }
  objectsGroup = new THREE.Group();
  scene.add(objectsGroup);
  meshMap.clear();
  for (const o of state.objects) {
    const g = makeFurniture(o);
    g.position.set(o.x / 100, (o.y || 0) / 100, o.z / 100);
    g.rotation.y = (o.rotation * Math.PI) / 180;
    objectsGroup.add(g);
    meshMap.set(o.id, g);
  }
  updateRing();
  renderList();
}

/* 회전한 가구가 차지하는 축 정렬 사각형의 가로/세로를 삼각함수로 계산합니다. */
function footprint(o) {
  const a = (o.rotation * Math.PI) / 180;
  return {
    w: Math.abs(Math.cos(a)) * o.w + Math.abs(Math.sin(a)) * o.d,
    d: Math.abs(Math.sin(a)) * o.w + Math.abs(Math.cos(a)) * o.d,
  };
}

/* 가구를 방 경계 안으로 보정합니다. 비직사각형 방에서는 가구의 네 모서리가 포함되는지 검사하고 20cm 격자에서 가까운 위치를 찾습니다. 가구끼리의 충돌 검사는 아닙니다. */
function clampObject(o) {
  const f = footprint(o);
  o.x = Math.round(
    THREE.MathUtils.clamp(
      o.x,
      -Math.max(0, (state.room.w - f.w) / 2),
      Math.max(0, (state.room.w - f.w) / 2),
    ),
  );
  o.z = Math.round(
    THREE.MathUtils.clamp(
      o.z,
      -Math.max(0, (state.room.d - f.d) / 2),
      Math.max(0, (state.room.d - f.d) / 2),
    ),
  );
  const outline = roomOutline(state.room),
    a = (o.rotation * Math.PI) / 180;

  function inside(x, z) {
    return [-1, 1].every((sx) => [-1, 1].every((sz) =>
      pointInside(
        x + ((sx * o.w) / 2) * Math.cos(a) + ((sz * o.d) / 2) * Math.sin(a),
        z - ((sx * o.w) / 2) * Math.sin(a) + ((sz * o.d) / 2) * Math.cos(a),
        outline,
      ),
    ), );
  }
  if (!inside(o.x, o.z) && state.room.shape && state.room.shape !== "rectangle") {
    let best = null,
      dist = Infinity;
    for (let x = -state.room.w / 2 + f.w / 2; x <= state.room.w / 2 - f.w / 2; x += 20)
      for (let z = -state.room.d / 2 + f.d / 2; z <= state.room.d / 2 - f.d / 2; z += 20) {
        const ds = (o.x - x) ** 2 + (o.z - z) ** 2;
        if (ds < dist && inside(x, z)) {
          best = [x, z];
          dist = ds;
        }
      }
    if (best) {
      o.x = Math.round(best[0]);
      o.z = Math.round(best[1]);
    }
  }
  return inside(o.x, o.z) && o.h + (o.y || 0) <= state.room.h;
}

/* 선택한 가구 아래에 테두리를 표시합니다. 실제 가구 데이터와 선택 표시를 분리합니다. */
function updateRing() {
  if (selectionRing) {
    dispose(selectionRing);
    scene.remove(selectionRing);
  }
  const o = state.objects.find((o) => o.id === selectedId);
  if (!o) return;
  const w = o.w / 200 + 0.025,
    d = o.d / 200 + 0.025;
  const pts = [
    [-w, 0.02, -d],
    [w, 0.02, -d],
    [w, 0.02, d],
    [-w, 0.02, d],
    [-w, 0.02, -d],
  ].map((p) => new THREE.Vector3(...p));
  selectionRing = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({
      color: "#b8754f",
      depthTest: false
    }),
  );
  selectionRing.position.set(o.x / 100, (o.y || 0) / 100, o.z / 100);
  selectionRing.rotation.y = (o.rotation * Math.PI) / 180;
  selectionRing.renderOrder = 100;
  scene.add(selectionRing);
}

/* 가구 전용 장면을 작은 이미지로 렌더링해 목록의 미리보기를 만듭니다. 같은 설정은 캐시를 재사용합니다. */
function thumb(o) {
  const key = JSON.stringify([
    o.type,
    o.w,
    o.d,
    o.h,
    o.color,
    o.feature,
    o.photo || null,
    o.texture,
    o.photoSurface,
    o.assetId,
    o.parts,
    o.wallType,
    o.openingW,
    o.openingH,
  ]);
  if (thumbnailCache.has(key)) return thumbnailCache.get(key);
  const g = makeFurniture(o);
  thumbScene.add(g);
  const bounds = new THREE.Box3().setFromObject(g),
    center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z) * 0.78;
  thumbCamera.left = -extent * 1.4;
  thumbCamera.right = extent * 1.4;
  thumbCamera.top = extent;
  thumbCamera.bottom = -extent;
  thumbCamera.position.copy(center).add(new THREE.Vector3(4, 3.2, 5));
  thumbCamera.lookAt(center);
  thumbCamera.updateProjectionMatrix();
  thumbRenderer.render(thumbScene, thumbCamera);
  const url = thumbRenderer.domElement.toDataURL();
  thumbScene.remove(g);
  dispose(g);
  thumbnailCache.set(key, url);
  return url;
}

/* 카테고리와 검색어로 기본 가구를 골라 버튼을 만듭니다. 클릭하면 addObject로 연결됩니다. */
function renderCatalog() {
  const list = catalog.filter(
    (o) => (category === "all" || o.category === category) && o.name.includes(search),
  );
  $("#catalog").replaceChildren();
  for (const o of list) {
    const btn = document.createElement("button");
    btn.className = "catalog-card";
    btn.setAttribute("aria-label", `${o.name} 추가`);
    btn.innerHTML = `<span class="catalog-img"><img src="${thumb(o)}" alt=""></span><span class="catalog-plus">+</span><strong>${o.name}</strong><small>${o.w} × ${o.d} × ${o.h} cm</small>`;
    btn.onclick = () => addObject(o);
    $("#catalog").append(btn);
  }
  if (!list.length) $("#catalog").textContent = "찾는 가구가 없어요.";
}

/* 방에 배치된 객체 목록을 HTML로 다시 그립니다. 사용자 이름은 textContent로 넣습니다. */
function renderList() {
  $("#object-list").replaceChildren();
  state.objects.forEach((o, i) => {
    const btn = document.createElement("button");
    btn.className = "scene-item" + (o.id === selectedId ? " active" : "");
    btn.innerHTML = icon("cube");
    const name = document.createElement("span");
    name.textContent = o.name;
    btn.append(name);
    const n = document.createElement("span");
    n.className = "item-number";
    n.textContent = String(i + 1).padStart(2, "0");
    btn.append(n);
    btn.onclick = () => select(o.id);
    $("#object-list").append(btn);
  });
  $("#object-count").textContent = `${state.objects.length}개의 가구`;
  $("#list-count").textContent = String(state.objects.length).padStart(2, "0");
}

/* 선택 ID, 속성 패널, 테두리, 목록을 함께 갱신합니다. 작은 화면에서는 속성 패널을 띄웁니다. */
function select(id, showPanel = true) {
  selectedId = id;
  syncInspector();
  updateRing();
  renderList();
  if (showPanel && id && innerWidth <= 900) $(".inspector-panel").classList.add("mobile-open");
  if (!id) $(".inspector-panel").classList.remove("mobile-open");
}

/* 선택된 가구 데이터를 오른쪽 입력란에 반영합니다. 모델 종류에 따라 제작실/벽 설정을 표시합니다. */
function syncInspector() {
  const o = state.objects.find((o) => o.id === selectedId);
  $("#selection-panel").hidden = !o;
  $("#no-selection").hidden = !!o;
  if (!o) return;
  $("#selected-image").src = thumb(o);
  $("#object-name").value = o.name;
  $("#object-kind").textContent = kindNames[o.type] + (o.photo ? " · 사진으로 만든 가구" : "");
  $("#selection-index").textContent = String(state.objects.indexOf(o) + 1).padStart(2, "0");
  for (const k of ["w", "d", "h", "x", "y", "z", "rotation"]) $("#obj-" + k).value = o[k] || 0;
  $("#wall-properties").hidden = o.type !== "wall";
  $("#edit-model").hidden = o.type !== "custom";
  $("#model-note").textContent =
    o.type === "imported" ?
    o.tint ?
    "가져온 모델 · 색상 변경됨" :
    "가져온 모델 · 원본 재질 유지" :
    o.type === "custom" ?
    "도형을 조합한 직접 제작 모델" :
    o.type === "wall" ?
    "길이·두께·높이와 각도를 조절할 수 있어요." :
    "치수에 따라 생성하는 기본 3D 모델";
  $("#wall-type").value = o.wallType || "solid";
  $("#opening-w").value = o.openingW || 90;
  $("#opening-h").value = o.openingH || 210;
  $("#object-color").value = o.color;
  $$(".swatch").forEach((b) => b.classList.toggle("active", b.dataset.color === o.color));
}

/* 가구 변경 후 3D 객체·속성 패널·실행 취소 버튼을 한곳에서 다시 맞춥니다. */
function changed() {
  autosave.schedule();
  buildObjects();
  syncInspector();
  syncUndo();
}

/* 최대 개수 확인 → 변경 전 기록 → 새 가구 생성 → 경계 보정 → 장면 갱신 순서로 가구를 추가합니다. */
function addObject(t) {
  if (state.objects.length >= 80) return toast("가구는 최대 80개까지 배치할 수 있어요.");
  checkpoint();
  const desk = state.objects.find(o => o.id === selectedId && o.type === "desk") || state.objects.find(o => o.type === "desk");
  const o = Object.assign(newObject(t), placeOnDesk(t, desk));
  state.objects.push(o);
  const fits = clampObject(o);
  selectedId = o.id;
  changed();
  select(o.id);
  toast(fits ? `${o.name} 추가됨${t.desktop && desk ? " · 책상 높이에 배치했어요" : ""}` : "가구가 방보다 큽니다. 치수를 줄여 주세요.");
}

/* Blob은 메모리의 파일 데이터입니다. 임시 URL과 download 링크로 브라우저 저장을 요청하고 URL을 해제합니다. Android판에서는 이 클릭을 android-bridge.js가 가로챕니다. */
function download(data, filename, type = "application/json") {
  saveFile(data, filename, type);
}

/* 방 크기와 화면 비율로 직교 카메라의 표시 범위를 계산합니다. 3D/평면 보기에서 같은 방이 잘 들어오도록 맞춥니다. */
function frameCamera() {
  const m = Math.max(state.room.w, state.room.d) / 100,
    aspect = viewport.clientWidth / viewport.clientHeight,
    span = Math.max(m * 0.83 + 1.1, (m * 1.43 + 1.4) / (2 * aspect));
  camera.left = -span * aspect;
  camera.right = span * aspect;
  camera.top = span;
  camera.bottom = -span;
  camera.zoom = 1;
  camera.position.set(isTop ? 0 : m * 1.5, isTop ? m * 2 : m * 1.35, isTop ? 0.001 : m * 1.65);
  controls.target.set(0, isTop ? 0 : (state.room.h / 100) * 0.24, 0);
  camera.updateProjectionMatrix();
  controls.enableRotate = !isTop;
  controls.update();
}

/* 렌더러·카메라·광원·미리보기 렌더러를 준비하고 저장 데이터를 복구합니다. 마지막에 반복 렌더링과 드래그 이벤트를 연결합니다. */
async function init() {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  viewport.prepend(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#f0efe9");
  camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 80);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.02;
  controls.minZoom = 0.35;
  controls.maxZoom = 3.5;
  controls.enablePan = false;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  scene.add(new THREE.HemisphereLight("#fff9e6", "#c3c8b9", 2.4));
  const sun = new THREE.DirectionalLight("#fff3dc", 4.1);
  sun.position.set(-3, 8, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -9,
    right: 9,
    top: 9,
    bottom: -9,
    near: 0.1,
    far: 30
  });
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0002;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#e9f0ff", 1.4);
  fill.position.set(5, 5, -4);
  scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), material("#f0efe9"));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.16;
  ground.receiveShadow = true;
  scene.add(ground);
  thumbRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  thumbRenderer.setSize(320, 220);
  thumbRenderer.setPixelRatio(1);
  thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
  thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  thumbRenderer.toneMappingExposure = 1.3;
  thumbScene = new THREE.Scene();
  thumbScene.add(new THREE.HemisphereLight("#fff8e8", "#b6bcaf", 2.7));
  const tl = new THREE.DirectionalLight("#ffffff", 3.8);
  tl.position.set(-3, 5, 4);
  thumbScene.add(tl);
  thumbCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 50);
  try {
    /* 복원: 최신 복구 사본과 IndexedDB를 시각순으로 검사하고, 기존 저장이 없으면 initial-room.json 사용. 저장된 데이터는 검증 후 장면에 반영합니다. */
    let current = null;
    try {
      current = await projectDB("get");
    } catch (e) {
      console.warn("Database unavailable", e);
    }
    // 손상된 최신 사본이 있어도 이전 후보를 차례로 검증해 복원을 시도합니다.
    const candidates = recoveryCandidates(current, localStorage);
    let restored = false;
    for (const saved of candidates) {
      try {
        const validated = validateProject(saved);
        await loadProjectAssets(saved.assets || {});
        assetRecords = saved.assets || {};
        state = validated;
        restored = true;
        break;
      } catch (e) {
        console.warn("Saved snapshot unusable", e);
      }
    }
    if (!restored && !candidates.length) {
      const saved = await fetch("./initial-room.json").then(r => r.ok ? r.json() : null).catch(() => null);
      if (saved) {
        state = validateProject(saved);
        await loadProjectAssets(saved.assets || {});
        assetRecords = saved.assets || {};
      }
    }
    nextId = Math.max(0, ...state.objects.map(o => Number(o.id.split("-")[1]) || 0)) + 1;
    selectedId = state.objects[0]?.id;
    $("#save-state").textContent = restored ? "작업 복원됨" : "시작 공간";
    if (candidates.length && !restored) toast("저장된 작업을 읽지 못했어요. 내보낸 공간 파일을 불러와 주세요.");
  } catch (e) {
    toast("작업 복원에 실패했어요. 저장 파일을 확인해 주세요.");
  }
  // 저장 데이터를 읽은 뒤에만 자동 저장을 활성화합니다.
  autosave.enable();

  buildRoom();
  buildObjects();
  renderCatalog();
  syncInspector();
  syncRoomInputs();
  syncUndo();
  frameCamera();
  new ResizeObserver(() => {
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    frameCamera();
  }).observe(viewport);

  /* 매 프레임 카메라 움직임을 반영하고 시야를 가리는 외벽을 숨긴 뒤 화면을 다시 그립니다. */
  renderer.setAnimationLoop(() => {
    controls.update();
    roomGroup?.traverse((m) => {
      const n = m.userData.outerWall;
      if (n)
        m.visible =
        wallsVisible &&
        !isTop &&
        n.nx * (camera.position.x - n.x) + n.nz * (camera.position.z - n.z) < 0;
    });
    renderer.render(scene, camera);
  });
  bindDragging();
}

/* Raycaster로 화면 좌표에서 3D 광선을 쏴 클릭한 가구를 찾습니다. 바닥 평면과의 교점을 이용해 드래그를 X/Z 이동으로 변환합니다. */
function bindDragging() {
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let drag = null;

  function ray(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  }
  renderer.domElement.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return;
      ray(e);
      const hits = raycaster.intersectObjects(objectsGroup.children, true);
      if (hits.length) {
        let g = hits[0].object;
        while (g && !g.userData.id) g = g.parent;
        if (!g) return;
        select(g.userData.id);
        const p = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, p)) {
          const o = state.objects.find((o) => o.id === g.userData.id);
          drag = {
            id: o.id,
            x: e.clientX,
            y: e.clientY,
            dx: o.x - p.x * 100,
            dz: o.z - p.z * 100,
            moved: false,
          };
          controls.enabled = false;
          renderer.domElement.setPointerCapture(e.pointerId);
          renderer.domElement.style.cursor = "grabbing";
        }
      } else {
        select(null);
        controls.enabled = true;
      }
    },
    true,
  );
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
    if (!drag.moved) {
      checkpoint();
      drag.moved = true;
    }
    ray(e);
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, p)) return;
    const o = state.objects.find((o) => o.id === drag.id);
    o.x = Math.round((p.x * 100 + drag.dx) / 5) * 5;
    o.z = Math.round((p.z * 100 + drag.dz) / 5) * 5;
    clampObject(o);
    const g = meshMap.get(o.id);
    g.position.set(o.x / 100, (o.y || 0) / 100, o.z / 100);
    autosave.schedule();
    updateRing();
    $("#obj-x").value = o.x;
    $("#obj-z").value = o.z;
  });

  function end() {
    if (drag?.moved) autosave.flush().catch(() => {});
    drag = null;
    controls.enabled = true;
    renderer.domElement.style.cursor = "grab";
  }
  renderer.domElement.addEventListener("pointerup", end);
  renderer.domElement.addEventListener("pointercancel", end);
  renderer.domElement.style.cursor = "grab";
}

/* 기준 데이터인 state.room을 방 설정 폼과 동기화합니다. */
function syncRoomInputs() {
  for (const k of ["w", "d", "h"]) $(`#room-${k}`).value = state.room[k];
  $("#wall-color").value = state.room.wall;
  $("#floor-color").value = state.room.floor;
  $("#room-shape").value = state.room.shape || "rectangle";
  $("#notch-w").value = state.room.notchW || 140;
  $("#notch-d").value = state.room.notchD || 140;
  $("#notch-fields").hidden = state.room.shape !== "l";
}

/* JSON 스냅샷으로 되돌린 뒤 방·가구·폼·카메라를 다시 만듭니다. */
function restore(s) {
  state = JSON.parse(s);
  nextId = Math.max(0, ...state.objects.map((o) => Number(o.id.split("-")[1]) || 0)) + 1;
  if (!state.objects.some((o) => o.id === selectedId)) selectedId = state.objects[0]?.id;
  buildRoom();
  changed();
  syncRoomInputs();
  frameCamera();
  dirty = true;
  $("#save-state").textContent = "저장되지 않은 변경";
}

/* 실행 취소는 현재 상태를 future로 보내고 history의 마지막 상태를 복원합니다. redo는 반대로 동작합니다. */
function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restore(history.pop());
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restore(future.pop());
}

/* 삭제 전에 기록을 남기므로 실행 취소로 객체를 복원할 수 있습니다. */
function removeSelected() {
  if (!selectedId) return;
  checkpoint();
  state.objects = state.objects.filter((o) => o.id !== selectedId);
  selectedId = null;
  changed();
  select(null);
  toast("가구가 삭제됐어요. 실행 취소로 복원할 수 있어요.");
}

/* 가구 속성 변경의 공통 처리입니다. 비율 잠금·가져온 모델 색상·제작 가구 도형 색상을 함께 반영합니다. */
function updateObject(key, value) {
  const o = state.objects.find((o) => o.id === selectedId);
  if (!o) return;
  checkpoint();
  if (["w", "d", "h"].includes(key)) {
    const ratio = value / o[key];
    if ($("#lock-ratio").checked) {
      for (const k of ["w", "d", "h"]) o[k] = Math.round(o[k] * ratio);
      if (o.w > 1200 || o.d > 1200 || o.h > 1200 || o.w < 0.1 || o.d < 0.1 || o.h < 0.1) {
        restore(history.pop());
        toast("비율을 유지할 수 있는 치수를 입력해 주세요.");
        return;
      }
    }
  }
  o[key] = value;
  if (key === "color" && o.type === "imported") o.tint = true;
  if (key === "color" && o.type === "custom")
    o.parts = o.parts.map((p) => ({
      ...p,
      color: value
    }));
  const fits = clampObject(o);
  changed();
  if (!fits) toast("가구가 방보다 큽니다. 치수를 줄여 주세요.");
}

/* 이 아래는 UI 이벤트 연결부입니다. HTML 요소의 id/data 속성과 JavaScript의 선택자가 서로 대응합니다. */
$$("[data-panel]").forEach(
  (b) =>
  (b.onclick = () => {
    $$("[data-panel]").forEach((x) => {
      const active = x === b;
      x.classList.toggle("active", active);
      x.setAttribute("aria-selected", String(active));
    });
    $("#furniture-panel").hidden = b.dataset.panel !== "furniture";
    $("#room-panel").hidden = b.dataset.panel !== "room";
  }),
);
$$("[data-category]").forEach(
  (b) =>
  (b.onclick = () => {
    category = b.dataset.category;
    $$("[data-category]").forEach((x) => x.classList.toggle("active", x === b));
    renderCatalog();
  }),
);
$("#search").oninput = (e) => {
  search = e.target.value.trim();
  renderCatalog();
};
for (const color of ["#e7dec9", "#bda887", "#a8afa0", "#6b7955", "#777b73", "#464d46"]) {
  const b = document.createElement("button");
  b.className = "swatch";
  b.style.background = color;
  b.dataset.color = color;
  b.setAttribute("aria-label", `색상 ${color}`);
  b.onclick = () => updateObject("color", color);
  $("#color-swatches").append(b);
}
for (const k of ["w", "d", "h", "x", "y", "z", "rotation"])
  $(`#obj-${k}`).onchange = (e) => {
    let value = Number(e.target.value);
    if (!Number.isFinite(value) || e.target.value === "") {
      syncInspector();
      return;
    }
    if (["w", "d", "h"].includes(k) && (value < 0.1 || value > 1200)) {
      toast("치수는 0.1–1200cm 범위로 입력해 주세요.");
      syncInspector();
      return;
    }
    if (k === "y" && (value < 0 || value > 1200)) {
      toast("바닥 높이는 0–1200cm로 입력해 주세요.");
      syncInspector();
      return;
    }
    if (k === "rotation") value = ((value % 360) + 360) % 360;
    updateObject(k, value);
  };
$("#object-color").onchange = (e) => updateObject("color", e.target.value);
$("#object-name").onchange = (e) => {
  const name = e.target.value.trim();
  if (name) updateObject("name", name);
  else syncInspector();
};
$("#rotate").onclick = () => {
  const o = state.objects.find((o) => o.id === selectedId);
  if (o) updateObject("rotation", (o.rotation + 90) % 360);
};
$("#duplicate").onclick = () => {
  const o = state.objects.find((o) => o.id === selectedId);
  if (o && state.objects.length < 80) {
    addObject({
      ...o,
      id: undefined,
      name: o.name.slice(0, 37) + " 복사"
    });
    const n = state.objects.at(-1);
    n.x = o.x + 20;
    n.z = o.z + 20;
    n.rotation = o.rotation;
    clampObject(n);
    changed();
  } else if (o) toast("가구는 최대 80개까지 배치할 수 있어요.");
};
$("#delete").onclick = removeSelected;

/* 방 치수를 바꾸면 사용자 윤곽도 새 방 크기 비율로 조절합니다. 배치한 가구를 보정한 뒤 방과 카메라를 갱신합니다. */
$("#room-form").onsubmit = (e) => {
  e.preventDefault();
  const room = {
    ...state.room,
    w: Number($("#room-w").value),
    d: Number($("#room-d").value),
    h: Number($("#room-h").value),
  };
  if (
    room.w < 200 ||
    room.w > 1200 ||
    room.d < 200 ||
    room.d > 1200 ||
    room.h < 200 ||
    room.h > 450
  )
    return;
  checkpoint();
  if (state.room.shape === "custom" && state.room.points)
    room.points = state.room.points.map((p) => [
      (p[0] * room.w) / state.room.w,
      (p[1] * room.d) / state.room.d,
    ]);
  state.room = room;
  let oversized = false;
  state.objects.forEach((o) => {
    if (!clampObject(o)) oversized = true;
  });
  buildRoom();
  changed();
  frameCamera();
  toast(
    oversized ? "방 크기가 바뀌었어요. 큰 가구의 치수도 조절해 주세요." : "방 크기가 적용됐어요.",
  );
};
for (const k of ["wall", "floor"])
  $(`#${k}-color`).onchange = (e) => {
    checkpoint();
    state.room[k] = e.target.value;
    buildRoom();
  };
$("#undo").onclick = undo;
$("#redo").onclick = redo;
$("#view-3d").onclick = () => {
  isTop = false;
  $("#view-3d").classList.add("active");
  $("#view-top").classList.remove("active");
  frameCamera();
};
$("#view-top").onclick = () => {
  isTop = true;
  $("#view-top").classList.add("active");
  $("#view-3d").classList.remove("active");
  frameCamera();
};
$("#zoom-in").onclick = () => {
  camera.zoom = Math.min(3.5, camera.zoom * 1.18);
  camera.updateProjectionMatrix();
};
$("#zoom-out").onclick = () => {
  camera.zoom = Math.max(0.35, camera.zoom / 1.18);
  camera.updateProjectionMatrix();
};
$("#reset-view").onclick = frameCamera;
$("#walls-toggle").onclick = () => {
  wallsVisible = !wallsVisible;
  $("#walls-toggle").classList.toggle("active", wallsVisible);
  buildRoom();
};

/* 공간 저장은 비동기 IndexedDB 저장입니다. 네트워크 계정 저장이나 기기 간 동기화가 아닙니다. */
$("#save").onclick = async () => {
  try {
    await autosave.flush();
    dirty = false;
    $("#save-state").textContent = "이 기기에 저장됨";
    toast("모델 파일과 함께 공간을 저장했어요.");
  } catch (e) {
    toast("브라우저에 저장하지 못했어요. 파일 저장을 이용해 주세요.");
  }
};

/* 공간 파일은 모델 원본까지 포함한 JSON입니다. 이미지 버튼은 현재 3D 캔버스를 PNG로 변환합니다. */
$("#export-project").onclick = () => {
  download(JSON.stringify(projectData()), "나의-작은-공간.room.json");
  toast("3D 모델을 포함한 공간 파일을 저장했어요.");
};
$("#screenshot").onclick = () => {
  renderer.render(scene, camera);
  renderer.domElement.toBlob((blob) => {
    if (blob) download(blob, "나의-작은-공간.png", "image/png");
  });
};

/* 사용자가 선택한 공간 파일을 읽고 형식/용량을 검사한 뒤 포함된 3D 자산을 복구합니다. */
$("#import-project").onclick = () => $("#project-file").click();
$("#project-file").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (f.size > 120 * 1024 * 1024) throw Error("파일은 120MB 이하로 선택해 주세요.");
    toast("공간과 3D 모델을 불러오는 중이에요.");
    const raw = JSON.parse(await f.text()),
      s = validateProject(raw);
    await loadProjectAssets(raw.assets || {});
    checkpoint();
    Object.assign(assetRecords, raw.assets || {});
    restore(JSON.stringify(s));
    toast("공간 파일을 불러왔어요.");
  } catch (err) {
    toast(err.message || "유효한 공간 파일이 아닙니다.");
  }
  e.target.value = "";
};

/* 외부 JSON을 그대로 신뢰하지 않습니다. 버전·숫자 범위·색상·객체 ID·모델 원본·방 윤곽을 검사합니다. */
function validateProject(raw) {
  if (
    !raw ||
    ![1, 2].includes(raw.version) ||
    !Array.isArray(raw.objects) ||
    raw.objects.length > 80
  )
    throw Error("지원하는 공간 파일이 아닙니다.");
  const r = raw.room,
    hex = /^#[0-9a-f]{6}$/i,
    num = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  if (
    !r ||
    !num(r.w, 200, 1200) ||
    !num(r.d, 200, 1200) ||
    !num(r.h, 200, 450) ||
    !hex.test(r.wall) ||
    !hex.test(r.floor)
  )
    throw Error("방 정보가 올바르지 않습니다.");
  const ids = new Set();
  const objects = raw.objects.map((o) => {
    if (
      !o ||
      !Object.hasOwn(kindNames, o.type) ||
      typeof o.name !== "string" ||
      !o.name.trim() ||
      o.name.length > 40 ||
      !/^item-\d+$/.test(o.id) ||
      ids.has(o.id) ||
      !num(o.w, 0.1, 1200) ||
      !num(o.d, 0.1, 1200) ||
      !num(o.h, 0.1, 1200) ||
      !num(o.x, -1200, 1200) ||
      !num(o.z, -1200, 1200) ||
      !num(o.y || 0, -1200, 1200) ||
      !num(o.rotation, 0, 359) ||
      !hex.test(o.color)
    )
      throw Error("가구 정보가 올바르지 않습니다.");
    ids.add(o.id);
    if (
      o.photo &&
      (typeof o.photo !== "string" ||
        !/^data:image\/(jpeg|png|webp);base64,/.test(o.photo) ||
        o.photo.length > 1500000)
    )
      throw Error("가구 사진 정보가 올바르지 않습니다.");
    const result = {
      id: o.id,
      type: o.type,
      name: o.name,
      w: o.w,
      d: o.d,
      h: o.h,
      x: o.x,
      y: o.y || 0,
      z: o.z,
      rotation: o.rotation,
      color: o.color,
      feature: ["standard", "slim", "rounded"].includes(o.feature) ? o.feature : "standard",
      photo: o.photo || undefined,
      texture: !!o.texture,
      photoSurface: ["front", "top"].includes(o.photoSurface) ? o.photoSurface : undefined,
    };
    if (o.type === "custom") result.parts = validateParts(o.parts);
    if (o.type === "wall") {
      result.wallType = ["solid", "door", "window"].includes(o.wallType) ? o.wallType : "solid";
      result.openingW = num(o.openingW, 5, 1100) ? o.openingW : 90;
      result.openingH = num(o.openingH, 5, 1100) ? o.openingH : 210;
    }
    if (o.type === "imported") {
      const rec = raw.assets?.[o.assetId];
      if (
        typeof o.assetId !== "string" ||
        !rec ||
        !["glb", "gltf", "obj", "stl"].includes(rec.format) ||
        typeof rec.data !== "string" ||
        !rec.data.startsWith("data:") ||
        !rec.data.includes(";base64,") ||
        rec.data.length > 36 * 1024 * 1024
      )
        throw Error("모델 원본 파일이 없거나 올바르지 않아요.");
      for (const value of Object.values(rec.resources || {}))
        if (
          typeof value !== "string" ||
          !value.startsWith("data:") ||
          !value.includes(";base64,") ||
          value.length > 36 * 1024 * 1024
        )
          throw Error("모델 참조 파일이 올바르지 않아요.");
      result.assetId = o.assetId;
      result.tint = !!o.tint;
    }
    return result;
  });
  const room = {
    w: r.w,
    d: r.d,
    h: r.h,
    wall: r.wall,
    floor: r.floor,
    shape: ["rectangle", "l", "custom"].includes(r.shape) ? r.shape : "rectangle",
    notchW: num(r.notchW, 10, 1100) ? r.notchW : 140,
    notchD: num(r.notchD, 10, 1100) ? r.notchD : 140,
  };
  if (room.shape === "custom") room.points = validateOutline(r.points, room);
  return {
    version: 2,
    room,
    objects
  };
}

/* 입력란이나 모달을 조작 중이면 편집 단축키를 실행하지 않습니다. */
window.addEventListener("keydown", (e) => {
  if (
    ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) || [...document.querySelectorAll("dialog")].some((d) => d.open)
  )
    return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
    e.preventDefault();
    redo();
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    removeSelected();
  } else if (e.key.toLowerCase() === "r") $("#rotate").click();
  else if (e.key === "Escape") select(null);
});

/* 제작실이 반환한 모델을 기존 가구에 적용하거나 custom 가구로 새로 추가합니다. */
const builder = createBuilder({
  onMessage: toast,
  onSave: (model, id) => {
    if (id) {
      const o = state.objects.find((o) => o.id === id);
      if (!o) throw Error("수정할 가구를 찾지 못했어요.");
      checkpoint();
      Object.assign(o, model);
      clampObject(o);
      changed();
      toast("가구를 수정했어요.");
    } else addObject({
      ...model,
      type: "custom",
      color: "#b39772"
    });
  },
});
$("#open-builder").onclick = () => builder.open();
$("#edit-model").onclick = () => builder.open(state.objects.find((o) => o.id === selectedId));
$("#export-model").onclick = async () => {
  const o = state.objects.find((o) => o.id === selectedId);
  if (!o) return;
  try {
    await exportGLB(meshMap.get(o.id), o.name);
    toast("선택한 모델을 GLB 파일로 저장했어요.");
  } catch (e) {
    toast("모델을 내보내지 못했어요: " + e.message);
  }
};

/* 윤곽 편집기의 결과를 state.room.points에 저장하고 방의 바닥/벽을 다시 생성합니다. */
const outlineEditor = createOutlineEditor({
  getRoom: () => state.room,
  onApply: (points) => {
    checkpoint();
    state.room.shape = "custom";
    state.room.points = points;
    state.objects.forEach(clampObject);
    buildRoom();
    changed();
    syncRoomInputs();
    toast("방 윤곽을 적용했어요.");
  },
});
$("#draw-outline").onclick = () => outlineEditor.open();
$("#room-shape").onchange = (e) => {
  if (e.target.value === "custom") {
    outlineEditor.open();
    e.target.value = state.room.shape || "rectangle";
    return;
  }
  checkpoint();
  state.room.shape = e.target.value;
  state.objects.forEach(clampObject);
  buildRoom();
  changed();
  syncRoomInputs();
};
for (const k of ["w", "d"])
  $("#notch-" + k).onchange = (e) => {
    const v = Number(e.target.value);
    if (!Number.isFinite(v) || v < 10 || v > state.room[k] - 100) {
      toast("잘라낼 크기는 10cm 이상, 방 크기보다 100cm 이상 작게 입력해 주세요.");
      syncRoomInputs();
      return;
    }
    checkpoint();
    state.room[k === "w" ? "notchW" : "notchD"] = v;
    state.objects.forEach(clampObject);
    buildRoom();
    changed();
  };

/* 가벽도 일반 객체 목록에 추가하므로 가구와 같은 이동·회전·치수 편집 기능을 재사용합니다. */
$$("[data-wall]").forEach(
  (b) =>
  (b.onclick = () =>
    addObject({
      type: "wall",
      name: b.dataset.wall === "door" ?
        "문이 있는 벽" :
        b.dataset.wall === "window" ?
        "창이 있는 벽" :
        "가벽",
      w: 180,
      d: 10,
      h: state.room.h,
      color: state.room.wall,
      wallType: b.dataset.wall,
      openingW: 90,
      openingH: b.dataset.wall === "window" ? 110 : 210,
    })),
);
$("#wall-type").onchange = (e) => updateObject("wallType", e.target.value);
for (const [id, key] of [
    ["opening-w", "openingW"],
    ["opening-h", "openingH"],
  ])
  $("#" + id).onchange = (e) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v >= 5 && v <= 1100) updateObject(key, v);
    else syncInspector();
  };

/* 가져오기 미리보기와 실제 배치를 구분하는 임시 상태입니다. 읽는 중에는 중복 배치를 막습니다. */
let pendingModel = null,
  importBusy = false;
$("#open-import").onclick = () => {
  $("#model-import-dialog").showModal();
};
$("#close-import").onclick = () => $("#model-import-dialog").close();

function importFeedback(s) {
  $("#import-feedback").textContent = s;
}

/* 선택한 파일들 → 로더 파싱 → 자산 캐시 → 치수 추정 → 미리보기의 흐름입니다. 최종 실제 치수는 사용자가 확인합니다. */
$("#model-files").onchange = async (e) => {
  if (!e.target.files.length) return;
  importBusy = true;
  pendingModel = null;
  $("#place-model").disabled = true;
  importFeedback("모델과 재질을 읽고 있어요…");
  try {
    const {
      record,
      group
    } = await collectModelFiles(e.target.files),
      assetId = "asset-" + crypto.randomUUID();
    assetCache.set(assetId, group);
    const dims = modelDimensions(group, record.format);
    pendingModel = {
      record,
      assetId,
      ...dims
    };
    $("#import-name").value = record.name.replace(/\.[^.]+$/, "").slice(0, 40);
    for (const k of ["w", "d", "h"]) $("#import-" + k).value = dims[k];
    $("#import-preview").src = thumb({
      type: "imported",
      assetId,
      ...dims,
      color: "#ffffff"
    });
    $("#import-preview").hidden = false;
    $("#import-placeholder").hidden = true;
    $("#import-file-name").textContent = record.name;
    $("#place-model").disabled = false;
    importFeedback("모델을 불러왔어요. 실제 치수와 축 방향을 확인해 주세요.");
  } catch (err) {
    importFeedback("불러오기 실패: " + err.message);
  } finally {
    importBusy = false;
    e.target.value = "";
  }
};

/* 확정 버튼을 누르면 원본을 assetRecords에 남기고 imported 가구를 장면에 추가합니다. */
$("#import-model-form").onsubmit = (e) => {
  e.preventDefault();
  if (importBusy || !pendingModel) return;
  const dims = {
    w: Number($("#import-w").value),
    d: Number($("#import-d").value),
    h: Number($("#import-h").value),
  };
  if (!Object.values(dims).every((v) => Number.isFinite(v) && v >= 0.1 && v <= 1200))
    return importFeedback("치수는 0.1–1200cm로 입력해 주세요.");
  if (state.objects.length >= 80)
    return importFeedback("공간에는 80개의 오브젝트까지 배치할 수 있어요.");
  assetRecords[pendingModel.assetId] = pendingModel.record;
  addObject({
    type: "imported",
    assetId: pendingModel.assetId,
    name: $("#import-name").value.trim() || "가져온 모델",
    ...dims,
    color: "#ffffff",
  });
  $("#model-import-dialog").close();
  pendingModel = null;
  $("#place-model").disabled = true;
  $("#import-preview").hidden = true;
  $("#import-placeholder").hidden = false;
  importFeedback("");
};

/* 모델의 위쪽 축이 다를 때 X축으로 90도씩 보정하고 미리보기 크기를 다시 계산합니다. */
$("#model-axis").onclick = () => {
  if (!pendingModel) return;
  const g = assetCache.get(pendingModel.assetId);
  g.rotation.x -= Math.PI / 2;
  g.updateMatrixWorld(true);
  pendingModel.record.upAxisTurns = (pendingModel.record.upAxisTurns || 0) + 1;
  const dims = modelDimensions(g, pendingModel.record.format);
  Object.assign(pendingModel, dims);
  for (const k of ["w", "d", "h"]) $("#import-" + k).value = dims[k];
  thumbnailCache.clear();
  $("#import-preview").src = thumb({
    type: "imported",
    assetId: pendingModel.assetId,
    ...dims,
    color: "#ffffff",
  });
};

/* 지원하는 브라우저에서만 WebMCP 도구를 등록합니다. 이 기능은 AI 서버 호출이나 사진 인식 기능이 아닙니다. */
const context = document.modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  window.addEventListener("pagehide", () => lifecycle.abort(), {
    once: true
  });
  const toolList = [{
    name: "read_room",
    title: "현재 방 읽기",
    description: "Read room dimensions in centimeters and the furniture currently in the editor.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: true
    },
    execute: () => JSON.parse(snapshot()),
  }, {
    name: "resize_room",
    title: "방 크기 변경",
    description: "Apply room width, depth, and height in centimeters and move furniture inside the new bounds.",
    inputSchema: {
      type: "object",
      properties: {
        width: {
          type: "number",
          minimum: 200,
          maximum: 1200
        },
        depth: {
          type: "number",
          minimum: 200,
          maximum: 1200
        },
        height: {
          type: "number",
          minimum: 200,
          maximum: 450
        },
      },
      required: ["width", "depth", "height"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      untrustedContentHint: false
    },
    execute: (input) => {
      const {
        width,
        depth,
        height
      } = input;
      if (
        ![width, depth, height].every(Number.isFinite) ||
        width < 200 ||
        width > 1200 ||
        depth < 200 ||
        depth > 1200 ||
        height < 200 ||
        height > 450
      )
        throw Error("Room dimensions are out of range.");
      $("#room-w").value = width;
      $("#room-d").value = depth;
      $("#room-h").value = height;
      $("#room-form").requestSubmit();
      return {
        room: {
          ...state.room
        }
      };
    },
  }, {
    name: "add_furniture",
    title: "가구 추가",
    description: "Add one preset furniture object to the room using the same action as the furniture library.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: catalog.map((x) => x.type)
        }
      },
      required: ["type"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      untrustedContentHint: false
    },
    execute: (input) => {
      const t = catalog.find((x) => x.type === input.type);
      if (!t) throw Error("Unknown furniture type.");
      if (state.objects.length >= 80) throw Error("The room supports up to 80 objects.");
      addObject(t);
      return {
        id: selectedId,
        count: state.objects.length
      };
    },
  }, ];
  for (const tool of toolList) {
    try {
      Promise.resolve(context.registerTool(tool, {
        signal: lifecycle.signal
      })).catch(() => {});
    } catch {}
  }
}

/* 초기화 실패 시 사용자가 빈 화면만 보지 않도록 오류 안내를 표시합니다. */
init().catch((e) => {
  console.error(e);
  $("#scene-error").hidden = false;
  toast("3D 초기화에 실패했어요. 새로고침해 주세요.");
});
