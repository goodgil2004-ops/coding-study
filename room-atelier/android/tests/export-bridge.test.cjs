/* 실제 스마트폰 대신 중계 객체를 흉내 내어 JSON/GLB/PNG 바이트 보존, 실패 정리, 일반 링크 동작을 검증합니다. 기기 파일 선택 화면 테스트는 별도로 필요합니다. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(
  path.join(__dirname, "../app/src/main/assets/site/android-bridge.js"),
  "utf8",
);
function setup(blob, overrides = {}) {
  const nodes = new Map(),
    chunks = [],
    calls = [];
  let done;
  const complete = new Promise((resolve) => (done = resolve));
  class Anchor {
    click() {
      calls.push("regular-link");
    }
  }
  const bridge = {
    begin(name, type, size) {
      calls.push({ name, type, size });
      return "export-token";
    },
    chunk(token, data) {
      assert.equal(token, "export-token");
      assert.ok(data.length <= 65536);
      chunks.push(Buffer.from(data, "base64"));
      return true;
    },
    finish(token) {
      assert.equal(token, "export-token");
      calls.push("finish");
      done();
      return true;
    },
    abort(token) {
      assert.equal(token, "export-token");
      calls.push("abort");
      done();
    },
    ...overrides,
  };
  const document = {
    getElementById: (id) => nodes.get(id),
    querySelector: () => null,
    createElement: () => ({ style: {}, setAttribute() {} }),
    body: {
      append(el) {
        nodes.set(el.id, el);
      },
    },
    addEventListener() {},
  };
  const context = {
    window: { RoomAndroid: bridge, addEventListener() {} },
    RoomAndroid: bridge,
    document,
    HTMLAnchorElement: Anchor,
    Uint8Array,
    btoa,
    fetch: async () => ({ ok: true, blob: async () => blob }),
    setTimeout: () => 0,
    clearTimeout() {},
  };
  vm.runInNewContext(source, context);
  return { Anchor, chunks, calls, complete, nodes };
}
test("exports Korean JSON, GLB and PNG bytes without corruption across multiple chunks", async () => {
  for (const [name, type, bytes] of [
    [
      "내 방.room.json",
      "application/json",
      Buffer.from(JSON.stringify({ name: "나의 작은 공간", models: "가구".repeat(55000) })),
    ],
    [
      "가구.glb",
      "model/gltf-binary",
      Buffer.from(Array.from({ length: 140000 }, (_, i) => i % 256)),
    ],
    ["방.png", "image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 255, 0, 128])],
  ]) {
    const t = setup(new Blob([bytes], { type }));
    const a = new t.Anchor();
    a.href = "blob:local";
    a.download = name;
    a.click();
    await t.complete;
    assert.deepEqual(Buffer.concat(t.chunks), bytes);
    assert.deepEqual(t.calls[0], { name, type, size: bytes.length });
    assert.equal(t.calls.filter((x) => x === "finish").length, 1);
  }
});
test("a failed transfer is aborted and does not request a save destination", async () => {
  const t = setup(new Blob(["test"], { type: "application/json" }), {
    chunk() {
      return false;
    },
  });
  const a = new t.Anchor();
  a.href = "blob:local";
  a.download = "test.json";
  a.click();
  await t.complete;
  assert.ok(t.calls.includes("abort"));
  assert.ok(!t.calls.includes("finish"));
  assert.match(t.nodes.get("android-file-status").textContent, /실패/);
});
test("normal navigation still uses the browser link behavior", () => {
  const t = setup(new Blob());
  const a = new t.Anchor();
  a.href = "./index.html";
  a.download = "";
  a.click();
  assert.deepEqual(t.calls, ["regular-link"]);
});
