/**
 * 기본 도형을 조합하는 가구 제작실
 * 한국어 해설판: 주석과 줄바꿈을 정리했습니다. 실제 처리 방식은 원본과 같습니다.
 */
import * as THREE from "three";
import {
  OrbitControls
} from "three/addons/OrbitControls.js";
import {
  makeParts,
  exportGLB,
  validateParts
} from "./models.js";

/* 독립적인 모달 3D 제작실입니다. onSave 콜백으로 완성된 도형 명세와 크기를 방 편집기에 돌려줍니다. */
export function createBuilder({
  onSave,
  onMessage
}) {
  const dialog = document.createElement("dialog");
  dialog.id = "builder-dialog";
  dialog.className = "builder-dialog";
  dialog.setAttribute("aria-label", "3D 가구 제작실");

  /* 제작실 도구 목록, 3D 캔버스, 선택 도형의 속성 입력란을 구성합니다. */
  dialog.innerHTML = `<header class="builder-header"><div><span class="eyebrow">OBJECT WORKSHOP</span><h2>나만의 가구 제작실</h2></div><input id="builder-name" aria-label="제작할 가구 이름" maxlength="40" value="나만의 가구"><button class="button subtle" id="builder-export">GLB 내보내기</button><button class="icon-button" id="builder-close" aria-label="제작실 닫기">✕</button></header><div class="builder-workspace"><aside class="builder-tools"><h3>시작 형태</h3><div class="builder-presets"><button data-preset="table">책상</button><button data-preset="chair">의자</button><button data-preset="shelf">책장</button><button data-preset="empty">빈 모델</button></div><h3>도형 추가</h3><div class="primitive-buttons"><button data-shape="box">▧<span>직육면체</span></button><button data-shape="cylinder">▤<span>원기둥</span></button><button data-shape="sphere">○<span>구</span></button><button data-shape="cone">△<span>원뿔</span></button></div><h3>구성 도형 <span id="part-count"></span></h3><div id="parts-list"></div><p class="builder-hint">도형을 조합해 가구를 만드세요.<br>선택한 도형을 끌면 바닥과 평행하게 이동합니다.</p></aside><div class="builder-view"><div id="builder-canvas"></div><div class="builder-view-top"><button class="button subtle" id="builder-fit">전체 보기</button><span id="builder-size"></span></div><div class="builder-view-bottom">빈 곳 드래그: 회전 · 휠: 확대 · 치수 단위: cm</div></div><aside class="builder-properties"><h3>선택한 도형</h3><label class="field">이름<input id="part-name" maxlength="30"></label><h4>크기</h4><div class="three-fields"><label>가로<input id="part-w" type="number" min="0.1" max="1200" step="1"></label><label>높이<input id="part-h" type="number" min="0.1" max="1200" step="1"></label><label>세로<input id="part-d" type="number" min="0.1" max="1200" step="1"></label></div><h4>위치 · 도형 중심</h4><div class="three-fields"><label>X<input id="part-x" type="number" step="1"></label><label>Y · 높이<input id="part-y" type="number" step="1"></label><label>Z<input id="part-z" type="number" step="1"></label></div><h4>회전 · °</h4><div class="three-fields"><label>X<input id="part-rx" type="number" step="15"></label><label>Y<input id="part-ry" type="number" step="15"></label><label>Z<input id="part-rz" type="number" step="15"></label></div><label class="color-row">도형 색상<input type="color" id="part-color"></label><div class="object-actions"><button class="button subtle" id="part-copy">복제</button><button class="button danger" id="part-delete">삭제</button></div><div class="object-actions"><button class="button subtle" id="part-undo">되돌리기</button><button class="button subtle" id="part-redo">다시</button></div><p id="part-feedback" role="status"></p></aside></div><footer class="builder-footer"><span>모든 도형을 하나의 가구로 묶어 배치합니다.</span><button class="button primary" id="builder-save">가구 완성하고 배치</button></footer>`;
  document.body.append(dialog);
  const q = (s) => dialog.querySelector(s),
    qa = (s) => [...dialog.querySelectorAll(s)];

  /* 제작실의 장면/카메라/도형 목록은 메인 방과 별도의 상태를 사용합니다. */
  let renderer,
    scene,
    camera,
    controls,
    group,
    helper,
    parts = [],
    selected = null,
    editId = null,
    undo = [],
    redo = [];
  let index = 1;
  const shapeNames = {
    box: "직육면체",
    cylinder: "원기둥",
    sphere: "구",
    cone: "원뿔"
  };

  /* 도형 데이터 하나의 기본 구조를 만듭니다. w/h/d 및 x/y/z는 cm, rx/ry/rz는 도 단위입니다. */
  const part = (name, w, h, d, x, y, z, color = "#b39772", shape = "box") => ({
    id: `part-${index++}`,
    name,
    shape,
    w,
    h,
    d,
    x,
    y,
    z,
    rx: 0,
    ry: 0,
    rz: 0,
    color,
  });

  /* 책상·의자·책장 예제를 도형 명세로 만듭니다. 기본 제작 예제는 외부 3D 파일을 다운로드하지 않습니다. */
  function preset(kind) {
    if (parts.length) checkpoint();
    if (kind === "table") {
      parts = [
        part("상판", 120, 5, 60, 0, 72.5, 0),
        ...[-53, 53].flatMap((x) => [-23, 23].map((z) => part("다리", 6, 70, 6, x, 35, z, "#827965")), ),
      ];
    } else if (kind === "chair") {
      parts = [
        part("좌판", 46, 5, 46, 0, 44, 0),
        part("등받이", 46, 40, 5, 0, 68, -20),
        ...[-18, 18].flatMap((x) => [-18, 18].map((z) => part("다리", 4, 42, 4, x, 21, z, "#827965")), ),
      ];
    } else if (kind === "shelf") {
      parts = [
        part("왼쪽 측판", 3, 180, 30, -43.5, 90, 0),
        part("오른쪽 측판", 3, 180, 30, 43.5, 90, 0),
        ...Array.from({
            length: 6
          }, (_, i) =>
          part("선반 " + (i + 1), 84, 3, 30, 0, 1.5 + i * 35.4, 0),
        ),
      ];
    } else parts = [part("도형 1", 50, 50, 50, 0, 25, 0)];
    selected = parts[0].id;
    render();
    fit();
  }

  /* 제작실의 변경 전 도형 목록을 최대 40개 보관합니다. 방 편집기의 실행 취소 기록과 독립적입니다. */
  function checkpoint() {
    undo.push(JSON.stringify(parts));
    if (undo.length > 40) undo.shift();
    redo = [];
  }

  function feedback(s) {
    q("#part-feedback").textContent = s;
  }

  /* 다시 그릴 때 이전 도형의 기하와 재질을 해제합니다. */
  function cleanup(g) {
    g?.traverse((o) => {
      o.geometry?.dispose();
      if (o.material)
        for (const m of [].concat(o.material)) m.dispose();
    });
  }

  /* 도형 명세 → Mesh 조립 → 선택 테두리 → 목록/입력란 갱신 순서입니다. */
  function render() {
    if (!scene) return;
    if (group) {
      scene.remove(group);
      cleanup(group);
    }
    group = makeParts(parts);
    scene.add(group);
    if (helper) {
      scene.remove(helper);
      helper.dispose();
    }
    const mesh = group.children.find((m) => m.userData.partId === selected);
    if (mesh) {
      helper = new THREE.BoxHelper(mesh, "#bd6a42");
      scene.add(helper);
    } else helper = null;
    q("#parts-list").replaceChildren();
    parts.forEach((p) => {
      const b = document.createElement("button");
      b.className = "part-list-item" + (p.id === selected ? " active" : "");
      b.textContent = p.name;
      b.onclick = () => {
        selected = p.id;
        render();
      };
      q("#parts-list").append(b);
    });
    q("#part-count").textContent = parts.length;
    const p = parts.find((p) => p.id === selected);
    for (const key of ["w", "h", "d", "x", "y", "z", "rx", "ry", "rz", "name", "color"]) {
      q("#part-" + key).disabled = !p;
      if (p) q("#part-" + key).value = p[key];
    }
    q("#part-undo").disabled = !undo.length;
    q("#part-redo").disabled = !redo.length;
    if (parts.length) {
      const s = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      q("#builder-size").textContent =
        `${Math.round(s.x * 100)} × ${Math.round(s.z * 100)} × ${Math.round(s.y * 100)} cm`;
    } else q("#builder-size").textContent = "도형을 추가해 주세요";
  }

  /* 전체 도형을 감싸는 경계 상자를 구해 카메라가 모델 전체를 담도록 위치를 정합니다. */
  function fit() {
    if (!group || !parts.length) return;
    const b = new THREE.Box3().setFromObject(group),
      c = b.getCenter(new THREE.Vector3()),
      s = b.getSize(new THREE.Vector3()),
      m = Math.max(s.x, s.y, s.z, 0.6) * Math.max(1, 1 / camera.aspect);
    camera.position.copy(c).add(new THREE.Vector3(m * 1.45, m * 1.05, m * 1.65));
    controls.target.copy(c);
    controls.update();
  }

  /* 제작실을 처음 열 때 렌더러, 원근 카메라, 조명, 격자, 카메라 조작을 준비합니다. */
  function init() {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    q("#builder-canvas").append(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#f0efe9");
    scene.add(new THREE.HemisphereLight("#fff7e5", "#a9b09e", 2.7));
    const light = new THREE.DirectionalLight("#ffffff", 3);
    light.position.set(3, 7, 5);
    light.castShadow = true;
    scene.add(light);
    scene.add(new THREE.GridHelper(10, 50, "#b3b8a7", "#dedfd4"));
    camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.target.set(0, 0.5, 0);
    new ResizeObserver(() => {
      const el = q("#builder-canvas");
      if (!el.clientWidth || !el.clientHeight) return;
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      if (dialog.open && group) fit();
    }).observe(q("#builder-canvas"));

    /* 모달이 열려 있을 때만 제작실 화면을 렌더링합니다. */
    renderer.setAnimationLoop(() => {
      if (dialog.open) {
        controls.update();
        renderer.render(scene, camera);
      }
    });

    /* 드래그한 도형의 Y 높이를 유지하는 수평 평면을 사용합니다. 높이 변경은 Y 입력란에서 합니다. */
    const ray = new THREE.Raycaster(),
      ndc = new THREE.Vector2();
    let drag = null;

    function point(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    }
    renderer.domElement.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        point(e);
        const hits = ray.intersectObjects(group.children);
        if (!hits.length) return;
        selected = hits[0].object.userData.partId;
        const p = parts.find((p) => p.id === selected),
          plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -p.y / 100),
          hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
        if (hit) {
          drag = {
            id: p.id,
            plane,
            dx: p.x - hit.x * 100,
            dz: p.z - hit.z * 100,
            x: e.clientX,
            y: e.clientY,
            moved: false,
          };
          controls.enabled = false;
          renderer.domElement.setPointerCapture(e.pointerId);
        }
        render();
      },
      true,
    );
    renderer.domElement.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      if (!drag.moved) {
        checkpoint();
        drag.moved = true;
      }
      point(e);
      const hit = ray.ray.intersectPlane(drag.plane, new THREE.Vector3());
      if (!hit) return;
      const p = parts.find((p) => p.id === drag.id);
      p.x = Math.round(THREE.MathUtils.clamp(hit.x * 100 + drag.dx, -1000, 1000));
      p.z = Math.round(THREE.MathUtils.clamp(hit.z * 100 + drag.dz, -1000, 1000));
      render();
    });
    for (const event of ["pointerup", "pointercancel"])
      renderer.domElement.addEventListener(event, () => {
        drag = null;
        controls.enabled = true;
      });
  }

  /* 프리셋/도형 버튼과 속성 입력을 실제 편집 동작에 연결합니다. */
  qa("[data-preset]").forEach((b) => (b.onclick = () => preset(b.dataset.preset)));
  qa("[data-shape]").forEach(
    (b) =>
    (b.onclick = () => {
      if (parts.length >= 80) return feedback("도형은 80개까지 만들 수 있어요.");
      checkpoint();
      const p = part(
        shapeNames[b.dataset.shape],
        30,
        30,
        30,
        0,
        15,
        0,
        "#b39772",
        b.dataset.shape,
      );
      parts.push(p);
      selected = p.id;
      render();
    }),
  );
  for (const key of ["w", "h", "d", "x", "y", "z", "rx", "ry", "rz", "name", "color"])
    q("#part-" + key).onchange = (e) => {
      const p = parts.find((p) => p.id === selected);
      if (!p) return;
      const v = ["name", "color"].includes(key) ? e.target.value : Number(e.target.value);
      if (
        typeof v === "number" &&
        (!Number.isFinite(v) || Math.abs(v) > 1200 || (["w", "h", "d"].includes(key) && v < 0.1))
      ) {
        feedback("치수는 0.1–1200cm 범위로 입력해 주세요.");
        render();
        return;
      }
      checkpoint();
      p[key] = v;
      render();
      feedback("");
    };

  /* 도형 복제 시 새 ID와 약간 이동한 위치를 부여합니다. 삭제도 실행 취소할 수 있습니다. */
  q("#part-copy").onclick = () => {
    const p = parts.find((p) => p.id === selected);
    if (!p || parts.length >= 80) return;
    checkpoint();
    const n = {
      ...p,
      id: `part-${index++}`,
      name: (p.name + " 복사").slice(0, 30),
      x: p.x + 10
    };
    parts.push(n);
    selected = n.id;
    render();
  };
  q("#part-delete").onclick = () => {
    if (!selected) return;
    checkpoint();
    parts = parts.filter((p) => p.id !== selected);
    selected = parts.at(-1)?.id;
    render();
  };
  q("#part-undo").onclick = () => {
    if (!undo.length) return;
    redo.push(JSON.stringify(parts));
    parts = JSON.parse(undo.pop());
    selected = parts[0]?.id;
    render();
  };
  q("#part-redo").onclick = () => {
    if (!redo.length) return;
    undo.push(JSON.stringify(parts));
    parts = JSON.parse(redo.pop());
    selected = parts[0]?.id;
    render();
  };
  q("#builder-fit").onclick = fit;
  q("#builder-close").onclick = () => dialog.close();

  /* 제작 중인 도형 묶음을 검사하고 GLB 파일로 내보냅니다. */
  q("#builder-export").onclick = async () => {
    try {
      validateParts(parts);
      await exportGLB(group, q("#builder-name").value || "내가 만든 가구");
      feedback("GLB 파일을 내보냈어요.");
    } catch (e) {
      feedback(e.message);
    }
  };

  /* 완성된 가구의 전체 크기를 계산·검증하고 onSave를 호출합니다. */
  q("#builder-save").onclick = () => {
    try {
      const valid = validateParts(parts),
        b = new THREE.Box3().setFromObject(group),
        s = b.getSize(new THREE.Vector3()),
        dims = {
          w: +(s.x * 100).toFixed(1),
          d: +(s.z * 100).toFixed(1),
          h: +(s.y * 100).toFixed(1),
        };
      if (Math.min(dims.w, dims.d, dims.h) < 0.1 || Math.max(dims.w, dims.d, dims.h) > 1200)
        throw Error("전체 가구 크기는 0.1–1200cm 범위여야 해요.");
      onSave({
          name: q("#builder-name").value.trim() || "내가 만든 가구",
          parts: valid,
          ...dims
        },
        editId,
      );
      dialog.close();
    } catch (e) {
      feedback(e.message);
    }
  };

  /* 기존 가구가 주어지면 도형 명세를 복사해 재편집하고, 없으면 책상 프리셋으로 시작합니다. */
  return {
    open(o) {
      dialog.showModal();
      if (!renderer) init();
      editId = o?.id || null;
      undo = [];
      redo = [];
      q("#builder-name").value = o?.name || "나만의 가구";
      q("#builder-save").textContent = o ? "가구 수정 적용" : "가구 완성하고 배치";
      feedback("");
      if (o?.parts) {
        parts = structuredClone(o.parts);
        index = Math.max(...parts.map((p) => Number(p.id.split("-")[1]) || 0)) + 1;
        selected = parts[0]?.id;
        render();
        fit();
      } else preset("table");
    },
  };
}
