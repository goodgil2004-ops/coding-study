// Dimensions are centimetres; meshes below use unit proportions.
/** 추가 가구 목록. w/d/h와 offset을 계산할 때의 단위는 cm입니다.
 * desktop=true인 소품은 선택한 책상 또는 첫 책상의 높이에 배치됩니다.
 * offset은 책상과 물건 크기의 차이에 곱할 상대 위치입니다. */
export const deskItems = [{
  type: 'washer',
  name: '드럼 세탁기',
  w: 60,
  d: 65,
  h: 85,
  color: '#f0f0ec',
  category: 'appliances'
}, {
  type: 'microwave',
  name: '전자레인지',
  w: 48,
  d: 38,
  h: 28,
  color: '#eeeee9',
  category: 'appliances'
}, {
  type: 'drawers',
  name: '화이트 3단 서랍장',
  w: 40,
  d: 50,
  h: 62,
  color: '#eeeae3',
  category: 'work'
}, {
  type: 'pc',
  name: '화이트 컴퓨터 본체',
  w: 28,
  d: 45,
  h: 46,
  color: '#e9e9e6',
  category: 'deskdecor',
  desktop: true,
  offset: [0.34, 0]
}, {
  type: 'monitor',
  name: '27인치 모니터',
  w: 62,
  d: 22,
  h: 46,
  color: '#ededeb',
  category: 'deskdecor',
  desktop: true,
  offset: [0, -0.24]
}, {
  type: 'laptop',
  name: '오픈 노트북',
  w: 33,
  d: 25,
  h: 23,
  color: '#aeb5bc',
  category: 'deskdecor',
  desktop: true,
  offset: [-0.32, 0]
}, {
  type: 'keyboard',
  name: '기계식 키보드',
  w: 36,
  d: 14,
  h: 3,
  color: '#efebe4',
  category: 'deskdecor',
  desktop: true,
  offset: [0, 0.24]
}, {
  type: 'mouse',
  name: '무선 마우스',
  w: 7,
  d: 12,
  h: 4,
  color: '#eeeeec',
  category: 'deskdecor',
  desktop: true,
  offset: [0.22, 0.24]
}, {
  type: 'speakers',
  name: '데스크 스피커 한 쌍',
  w: 78,
  d: 14,
  h: 20,
  color: '#e4e2dc',
  category: 'deskdecor',
  desktop: true,
  offset: [0, -0.25]
}, {
  type: 'riser',
  name: '모니터 받침대',
  w: 70,
  d: 23,
  h: 10,
  color: '#c6ae8b',
  category: 'deskdecor',
  desktop: true,
  offset: [0, -0.24]
}, {
  type: 'deskmat',
  name: '와이드 데스크 매트',
  w: 80,
  d: 35,
  h: 0.4,
  color: '#919f9e',
  category: 'deskdecor',
  desktop: true,
  offset: [0, 0.18]
}, {
  type: 'lamp',
  name: '슬림 데스크 조명',
  w: 20,
  d: 30,
  h: 43,
  color: '#dddcd6',
  category: 'deskdecor',
  desktop: true,
  offset: [-0.36, -0.18]
}, {
  type: 'headphones',
  name: '헤드셋과 거치대',
  w: 20,
  d: 18,
  h: 30,
  color: '#b7b9b6',
  category: 'deskdecor',
  desktop: true,
  offset: [0.34, 0.2]
}, {
  type: 'books',
  name: '책과 북엔드',
  w: 25,
  d: 17,
  h: 24,
  color: '#9eac9e',
  category: 'deskdecor',
  desktop: true,
  offset: [-0.3, -0.2]
}, ];
// 저장 파일 검증과 속성 패널에서 사용하는 종류 → 표시 이름 표입니다.
export const deskKinds = Object.fromEntries(deskItems.map(o => [o.type, o.name]));
// 책상 회전까지 고려해 상대 좌표를 방의 X/Z 좌표로 바꿉니다.
// 이후 책상을 움직일 때 소품이 자동으로 따라가는 부모·자식 관계는 아닙니다.
export function placeOnDesk(item, desk) {
  if (!item.desktop || !desk) return {};
  const [ox, oz] = item.offset || [0, 0], a = desk.rotation * Math.PI / 180;
  const x = ox * Math.max(0, desk.w - item.w),
    z = oz * Math.max(0, desk.d - item.d);
  return {
    x: desk.x + x * Math.cos(a) + z * Math.sin(a),
    z: desk.z - x * Math.sin(a) + z * Math.cos(a),
    y: (desk.y || 0) + desk.h,
    rotation: desk.rotation
  };
}
/** 정규화된 비율로 도형을 조립합니다. box/cyl은 app.js가 전달하는 생성 함수입니다.
 * 실제 cm 치수는 makeFurniture의 최종 바운딩 박스 정규화에서 적용됩니다.
 * 지원하지 않는 종류에는 false를 반환해 기존 가구 생성 분기로 넘깁니다. */
export function buildDeskItem(type, {
  box,
  cyl
}, c) {
  const dark = '#303940',
    screen = '#243d4c',
    silver = '#899398';
  if (type === 'washer') {
    box(1, .96, .96, c, 0, .52, -.02, .018);
    for (const x of [-.36, .36])
      for (const z of [-.34, .34]) box(.12, .04, .12, dark, x, .02, z);
    box(.95, .14, .025, '#dedfdb', 0, .89, .475);
    box(.25, .025, .03, silver, -.29, .91, .5);
    box(.22, .065, .026, dark, .28, .9, .497);
    box(.13, .012, .01, '#93c6ba', .28, .907, .515);
    const dial = cyl(.047, .047, .035, silver, .03, .91, .515);
    dial.rotation.x = Math.PI / 2;
    dial.scale.z = .7;
    for (const [radius, col, z] of [
        [.355, silver, .493],
        [.302, dark, .521],
        [.25, '#617780', .54]
      ]) {
      const door = cyl(radius, radius, .026, col, 0, .44, z);
      door.rotation.x = Math.PI / 2;
      door.scale.z = .7;
    }
    box(.045, .12, .055, c, .285, .45, .565, .01);
    box(.17, .075, .02, '#dedfdb', .33, .115, .48);
  } else if (type === 'microwave') {
    box(1, .94, .95, c, 0, .53, 0, .025);
    for (const x of [-.35, .35])
      for (const z of [-.32, .32]) box(.1, .06, .12, dark, x, .03, z);
    box(.73, .75, .025, dark, -.105, .53, .489, .015);
    box(.57, .55, .015, '#46535b', -.12, .53, .508);
    for (let j = 0; j < 7; j++) box(.52, .008, .008, '#64737a', -.12, .31 + j * .073, .52);
    box(.035, .54, .065, silver, .23, .53, .54);
    box(.16, .15, .02, dark, .38, .77, .489);
    box(.09, .018, .012, '#9ecabd', .38, .77, .507);
    for (const y of [.5, .28]) {
      const dial = cyl(.052, .052, .028, silver, .38, y, .51);
      dial.rotation.x = Math.PI / 2;
      dial.scale.z = 1.7;
    }
  } else if (type === 'drawers') {
    box(1, .94, 1, c, 0, .51, 0);
    box(.88, .06, .85, dark, 0, .03, 0);
    for (let i = 0; i < 3; i++) {
      box(.94, .285, .035, c, 0, .205 + i * .305, .518);
      box(.4, .022, .045, silver, 0, .265 + i * .305, .55);
    }
  } else if (type === 'pc') {
    box(1, 1, 1, c);
    box(.025, .81, .83, '#50646e', .512, .53, 0);
    box(.85, .9, .024, dark, 0, .52, .512);
    for (let i = 0; i < 3; i++) {
      const f = cyl(.32, .32, .028, '#accdd1', 0, .23 + i * .28, .535);
      f.rotation.x = Math.PI / 2;
      const hub = cyl(.1, .1, .035, dark, 0, .23 + i * .28, .55);
      hub.rotation.x = Math.PI / 2;
    }
    box(.12, .022, .024, '#8dd4cc', .31, .94, .537);
  } else if (type === 'monitor') {
    box(.55, .045, .95, c, 0, .023, 0);
    box(.045, .36, .15, silver, 0, .2, -.12);
    box(1, .64, .12, dark, 0, .68, -.13, .014);
    box(.95, .575, .012, screen, 0, .686, -.063);
    box(.55, .012, .012, '#769dad', -.15, .45, -.055);
  } else if (type === 'laptop') {
    box(1, .045, 1, c, 0, .023, 0, .012);
    box(.87, .01, .36, dark, 0, .052, -.02);
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 11; i++) box(.057, .008, .055, '#899397', -.375 + i * .075, .061, -.15 + j * .075);
    box(.32, .005, .22, silver, 0, .05, .31);
    box(1, .95, .055, c, 0, .51, -.475);
    box(.93, .81, .012, screen, 0, .54, -.44);
  } else if (type === 'keyboard') {
    box(1, .45, 1, c, 0, .225, 0, .045);
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 12; i++) box(.062, .45, .15, (j === 0 || i === 0) ? '#a5bbb8' : '#faf8ef', -.45 + i * .081, .675, -.4 + j * .195, .018);
  } else if (type === 'mouse') {
    box(1, .88, 1, c, 0, .44, 0, .2);
    box(.018, .025, .45, silver, 0, .892, -.22);
    box(.13, .11, .18, dark, 0, .94, -.12, .02);
  } else if (type === 'speakers') {
    for (const x of [-.42, .42]) {
      box(.16, 1, 1, c, x, .5, 0, .025);
      for (const [y, r] of [
          [.34, .059],
          [.77, .032]
        ]) {
        const f = cyl(r, r, .028, dark, x, y, .515);
        f.rotation.x = Math.PI / 2;
        f.scale.y = 1;
        f.scale.z = 4;
      }
    }
  } else if (type === 'riser') {
    box(1, .2, 1, c, 0, .9, 0, .02);
    for (const x of [-.44, .44]) box(.065, .8, .88, c, x, .4, 0);
  } else if (type === 'deskmat') {
    box(1, 1, 1, c, 0, .5, 0, .04);
  } else if (type === 'lamp') {
    cyl(.42, .48, .055, c, 0, .027, 0);
    cyl(.035, .035, .85, silver, 0, .48, -.28);
    box(.9, .06, .28, c, 0, .96, 0);
    box(.78, .016, .22, '#fff3c8', 0, .92, 0);
  } else if (type === 'headphones') {
    box(.8, .05, .85, c, 0, .025, 0, .07);
    box(.05, .82, .08, silver, 0, .46, 0);
    box(.62, .045, .22, c, 0, .88, 0);
    box(.78, .065, .24, dark, 0, .96, 0, .025);
    for (const x of [-.36, .36]) {
      box(.06, .42, .22, dark, x, .77, 0);
      box(.2, .32, .42, c, x, .49, 0, .07);
    }
  } else if (type === 'books') {
    for (let i = 0; i < 5; i++) {
      const x = -.35 + i * .17,
        h = .76 + (i % 3) * .1;
      box(.145, h, .9, i % 2 ? c : '#cfb9a1', x, h / 2, 0);
      box(.1, h * .84, .015, '#eee7d9', x, h / 2, .457);
    }
    for (const x of [-.47, .47]) box(.025, .62, 1, silver, x, .31, 0);
  } else return false;
  return true;
}
