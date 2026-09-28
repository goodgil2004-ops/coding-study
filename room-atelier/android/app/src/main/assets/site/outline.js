/**
 * 방 윤곽의 기하 계산과 2D 편집 화면
 * 한국어 해설판: 주석과 줄바꿈을 정리했습니다. 실제 처리 방식은 원본과 같습니다.
 */

/* 직사각형·L자형·직접 그린 방을 모두 [x,z] 꼭짓점 배열로 통일합니다. 방 중심이 원점이고 cm 단위입니다. */
export function roomOutline(r) {
  const x = r.w / 2,
    z = r.d / 2;
  if (r.shape === "custom" && r.points?.length >= 3) return r.points.map((p) => [p[0], p[1]]);
  if (r.shape === "l") {
    const a = Math.min(r.notchW || Math.round(r.w * 0.35), r.w - 100),
      b = Math.min(r.notchD || Math.round(r.d * 0.35), r.d - 100);
    return [
      [-x, -z],
      [x, -z],
      [x, z - b],
      [x - a, z - b],
      [x - a, z],
      [-x, z],
    ];
  }
  return [
    [-x, -z],
    [x, -z],
    [x, z],
    [-x, z],
  ];
}

/* 신발끈 공식을 사용한 부호 있는 면적입니다. cm²를 m²로 바꾸려면 10,000으로 나눕니다. 부호는 꼭짓점의 순서 방향을 나타냅니다. */
export function polygonArea(points) {
  return (
    points.reduce((sum, p, i) => {
      const n = points[(i + 1) % points.length];
      return sum + p[0] * n[1] - n[0] * p[1];
    }, 0) / 2
  );
}

/* 수평선을 쏘아 경계와 만나는 횟수의 홀짝으로 내부 여부를 판정합니다. 경계 위의 점은 내부로 취급합니다. */
export function pointInside(x, z, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[j],
      b = p[i],
      cross = (x - a[0]) * (b[1] - a[1]) - (z - a[1]) * (b[0] - a[0]);
    if (
      Math.abs(cross) < 0.01 &&
      x >= Math.min(a[0], b[0]) - 0.01 &&
      x <= Math.max(a[0], b[0]) + 0.01 &&
      z >= Math.min(a[1], b[1]) - 0.01 &&
      z <= Math.max(a[1], b[1]) + 0.01
    )
      return true;
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}

/* 3~20개 꼭짓점, 방 범위, 변 길이, 자기 교차, 최소 면적을 검사합니다. 마지막에는 꼭짓점 방향을 통일합니다. */
export function validateOutline(points, r) {
  if (!Array.isArray(points) || points.length < 3 || points.length > 20)
    throw Error("꼭짓점은 3~20개로 정해 주세요.");
  for (const p of points)
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      !p.every(Number.isFinite) ||
      Math.abs(p[0]) > r.w / 2 ||
      Math.abs(p[1]) > r.d / 2
    )
      throw Error("꼭짓점은 방 크기 안에 있어야 해요.");
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 5)
      throw Error("이웃한 꼭짓점은 5cm 이상 떨어뜨려 주세요.");
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      const c = points[j],
        d = points[(j + 1) % points.length];
      const p1 = cross(a, b, c),
        p2 = cross(a, b, d),
        p3 = cross(c, d, a),
        p4 = cross(c, d, b);
      if (
        p1 * p2 <= 0 &&
        p3 * p4 <= 0 &&
        Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
        Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
        Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
        Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))
      )
        throw Error("벽이 서로 교차하지 않도록 순서대로 그려 주세요.");
    }
  }
  if (Math.abs(polygonArea(points)) < 10000) throw Error("방 면적은 1m² 이상이어야 해요.");
  return polygonArea(points) > 0 ? points : points.slice().reverse();
}

/* 2D SVG 격자에서 방 윤곽을 편집하는 모달을 만듭니다. 적용 시 onApply 콜백으로 꼭짓점을 전달합니다. */
export function createOutlineEditor({
  getRoom,
  onApply
}) {
  const dialog = document.createElement("dialog");
  dialog.className = "outline-dialog";
  dialog.setAttribute("aria-label", "방 윤곽 그리기");
  dialog.innerHTML = `<div class="dialog-header"><div><span class="eyebrow">ROOM OUTLINE</span><h2>내 방의 윤곽 그리기</h2></div><button class="icon-button" id="outline-close" aria-label="윤곽 편집 닫기">✕</button></div><p class="muted">격자를 눌러 꼭짓점을 순서대로 추가하세요. 마지막 점은 첫 점과 연결됩니다. 점을 끌어 수정할 수도 있어요.</p><svg id="outline-canvas" viewBox="0 0 600 480" role="img" aria-label="방 윤곽 편집 격자"></svg><div class="outline-toolbar"><button class="button subtle" id="outline-reset">새로 그리기</button><button class="button subtle" id="outline-undo">마지막 점 취소</button><span id="outline-info"></span></div><p id="outline-error" role="status"></p><div class="dialog-footer"><span>10cm 단위 · 최대 20개 꼭짓점</span><button class="button primary" id="outline-apply">방 윤곽 적용</button></div>`;
  document.body.append(dialog);
  const q = (s) => dialog.querySelector(s);
  let points = [],
    room,
    drag = -1,
    moved = false;
  const coords = (p) => [300 + (p[0] / room.w) * 520, 240 + (p[1] / room.d) * 400];

  /* 현재 꼭짓점과 다각형을 SVG에 다시 그리고 면적을 표시합니다. */
  function render() {
    const grid = Array.from({
        length: 21
      },
      (_, i) => `<path d="M${40 + i * 26} 40V440 M40 ${40 + i * 20}H560"/>`,
    ).join("");
    q("#outline-canvas").innerHTML =
      `<g stroke="#e1e3d8" stroke-width="1">${grid}</g><rect x="40" y="40" width="520" height="400" fill="none" stroke="#a8b294"/><polygon points="${points.map((p) => coords(p).join(",")).join(" ")}" fill="#c3af8860" stroke="#b26043" stroke-width="2"/>${points
        .map((p, i) => {
          const [x, y] = coords(p);
          return `<g><circle data-point="${i}" cx="${x}" cy="${y}" r="9" fill="#b26043"/><text x="${x + 12}" y="${y - 10}" font-size="12" fill="#6a755d">${i + 1}</text></g>`;
        })
        .join(
          "",
        )}<text x="300" y="25" text-anchor="middle" font-size="14" fill="#6a755d">${room.w} cm</text><text x="300" y="470" text-anchor="middle" font-size="13" fill="#6a755d">위쪽: 방의 뒤 · 아래쪽: 방의 앞</text>`;
    q("#outline-info").textContent =
      `${points.length}개 점 · ${(Math.abs(polygonArea(points)) / 10000).toFixed(1)} m²`;
  }

  /* 포인터 화면 좌표를 SVG 좌표와 실제 cm 좌표로 변환하고 10cm 격자에 맞춥니다. */
  function fromEvent(e) {
    const rect = q("#outline-canvas").getBoundingClientRect();
    return [
      Math.round(
        Math.max(
          -room.w / 2,
          Math.min(
            room.w / 2,
            ((((e.clientX - rect.left) / rect.width) * 600 - 300) / 520) * room.w,
          ),
        ) / 10,
      ) * 10,
      Math.round(
        Math.max(
          -room.d / 2,
          Math.min(
            room.d / 2,
            ((((e.clientY - rect.top) / rect.height) * 480 - 240) / 400) * room.d,
          ),
        ) / 10,
      ) * 10,
    ].map((v, i) => Math.max(-(i ? room.d : room.w) / 2, Math.min((i ? room.d : room.w) / 2, v)));
  }

  /* 점 위에서 누르면 드래그를 시작하고, 빈 곳을 누르면 새 꼭짓점을 추가합니다. 적용 직전에 다시 검증합니다. */
  q("#outline-canvas").onpointerdown = (e) => {
    drag = e.target.dataset.point !== undefined ? Number(e.target.dataset.point) : -1;
    moved = false;
    if (drag >= 0) q("#outline-canvas").setPointerCapture(e.pointerId);
  };
  q("#outline-canvas").onpointermove = (e) => {
    if (drag < 0) return;
    points[drag] = fromEvent(e);
    moved = true;
    render();
  };
  q("#outline-canvas").onpointerup = (e) => {
    if (drag < 0 && !moved && points.length < 20) {
      points.push(fromEvent(e));
      render();
    }
    drag = -1;
    moved = false;
  };
  q("#outline-canvas").onpointercancel = () => (drag = -1);
  q("#outline-reset").onclick = () => {
    points = [];
    render();
  };
  q("#outline-undo").onclick = () => {
    points.pop();
    render();
  };
  q("#outline-close").onclick = () => dialog.close();
  q("#outline-apply").onclick = () => {
    try {
      const valid = validateOutline(points, room);
      onApply(valid);
      dialog.close();
    } catch (e) {
      q("#outline-error").textContent = e.message;
    }
  };
  return {
    open() {
      room = {
        ...getRoom()
      };
      points = roomOutline(room);
      q("#outline-error").textContent = "";
      dialog.showModal();
      render();
    },
  };
}
