/* L자 방의 면적·내부 점·경계·교차·너무 작은 면적·범위를 검증합니다. */
import assert from "node:assert/strict";
import { roomOutline, polygonArea, pointInside, validateOutline } from "../dist/outline.js";
const r = { w: 500, d: 400, shape: "l", notchW: 150, notchD: 120 };
const l = roomOutline(r);
assert.equal(polygonArea(l), 182000);
assert.equal(pointInside(200, 180, l), false);
assert.equal(pointInside(-200, 180, l), true);
assert.equal(pointInside(-250, -200, l), true);
assert.deepEqual(validateOutline(l.slice().reverse(), r), l);
assert.throws(
  () =>
    validateOutline(
      [
        [-100, -100],
        [100, 100],
        [-100, 100],
        [100, -100],
      ],
      r,
    ),
  /교차/,
);
assert.throws(
  () =>
    validateOutline(
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      r,
    ),
  /1m²/,
);
assert.throws(
  () =>
    validateOutline(
      [
        [0, 0],
        [900, 0],
        [0, 200],
      ],
      r,
    ),
  /방 크기/,
);
console.log(
  "PASS: L-room area, point containment, boundary, reversed winding, crossing walls, small area, and bounds.",
);
