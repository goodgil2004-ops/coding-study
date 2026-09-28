/* 실제 GLB/glTF/OBJ/STL 예제를 읽고 치수 보정·누락 파일·도형 입력 검사를 검증합니다. Node.js 24에서 실행했습니다. */
import { registerHooks } from "node:module";
import fs from "node:fs";
import assert from "node:assert/strict";
const vendor = new URL("../dist/vendor/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "three")
      return { url: new URL("three.module.js", vendor).href, shortCircuit: true };
    if (specifier.startsWith("three/addons/"))
      return {
        url: new URL(specifier.slice("three/addons/".length), vendor).href,
        shortCircuit: true,
      };
    return nextResolve(specifier, context);
  },
});
globalThis.ProgressEvent = class ProgressEvent {
  constructor(type, options = {}) {
    this.type = type;
    Object.assign(this, options);
  }
};
const { parseModel, modelDimensions, normalizeModel, validateParts, makeParts } = await import(
  "../dist/models.js"
);
const THREE = await import("three");
function data(name) {
  return (
    "data:application/octet-stream;base64," +
    fs.readFileSync(new URL("./fixtures/" + name, import.meta.url)).toString("base64")
  );
}
for (const format of ["glb", "gltf", "obj", "stl"]) {
  const record = {
    format,
    data: data("sample-desk." + format),
    resources: format === "gltf" ? { "sample-desk.bin": data("sample-desk.bin") } : {},
  };
  const m = await parseModel(record);
  assert.ok(m.children.length > 0);
  const dims = modelDimensions(m, format);
  assert.ok(dims.w > dims.d && dims.w > dims.h);
  const normalized = normalizeModel(m, { w: 123, d: 67, h: 81, id: "test" });
  const box = new THREE.Box3().setFromObject(normalized),
    size = box.getSize(new THREE.Vector3());
  assert.ok(
    Math.abs(size.x - 1.23) < 1e-5 &&
      Math.abs(size.y - 0.81) < 1e-5 &&
      Math.abs(size.z - 0.67) < 1e-5,
  );
  assert.ok(Math.abs(box.min.y) < 1e-5);
  console.log("PASS:", format, "parsed and exact dimensions normalized");
}
await assert.rejects(
  () => parseModel({ format: "gltf", data: data("sample-desk.gltf"), resources: {} }),
  /sample-desk.bin/,
);
const parts = validateParts([
  {
    id: "part-1",
    name: "base",
    shape: "box",
    w: 100,
    h: 10,
    d: 50,
    x: 0,
    y: 30,
    z: 0,
    rx: 0,
    ry: 45,
    rz: 0,
    color: "#b59774",
  },
]);
assert.equal(makeParts(parts).children.length, 1);
assert.throws(() => validateParts([{ ...parts[0], w: -1 }]), /치수/);
console.log("PASS: missing resources and malformed parts rejected");
