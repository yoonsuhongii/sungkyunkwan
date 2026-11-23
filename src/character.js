// 귀여운 로우폴리 캐릭터 (큰 머리 2.5등신) — 플레이어·다른 손님·상담사 공용
// params 로 외형을 바꿀 수 있어서, "상담사 스타일 프롬프트" → 외형 변신이 가능
import * as THREE from 'three';

// 부드러운 점토 인형 느낌의 재질 (매끈한 셰이딩)
const MATS = new Map();
const mat = (c, o = {}) => {
  const key = c + JSON.stringify(o);
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0, ...o }));
  return MATS.get(key);
};
// 공유 지오메트리 (여러 캐릭터가 같이 씀 → 가볍게)
const GEO = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
// 볼터치 텍스처
let blushTex = null;
function blush() {
  if (blushTex) return blushTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,130,140,0.75)'); gr.addColorStop(1, 'rgba(255,130,140,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  blushTex = new THREE.CanvasTexture(c); blushTex.colorSpace = THREE.SRGBColorSpace; return blushTex;
}

export const DEFAULT_LOOK = {
  skin: '#f2c9a0', hair: '#2b1d14', hairStyle: 'short', outfit: '#4dabf7', apron: null,
  accessory: 'none', accessoryColor: '#ffffff', height: 1, eyes: 'dot',
};

/**
 * 큰 머리 2.3등신 인형 캐릭터. 파츠 구조(legs/arms/head/body)는 애니메이션과 공유.
 * @returns {THREE.Group & {userData:{parts}}}
 */
export function makeCharacter(look = {}) {
  const L = { ...DEFAULT_LOOK, ...look };
  const g = new THREE.Group();
  const parts = {};
  const add = (gm, m, x, y, z, parent = g) => { const o = new THREE.Mesh(gm, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const skin = mat(L.skin), outfit = mat(L.outfit, { roughness: 0.9 }), hair = mat(L.hair, { roughness: 0.65 }), dark = mat('#2a2233', { roughness: 0.4 });
  const pants = mat(new THREE.Color(L.outfit).lerp(new THREE.Color('#2f3247'), 0.65).getStyle(), { roughness: 0.9 });

  // 다리 + 동글동글한 신발
  parts.legs = [-0.1, 0.1].map((x) => {
    const p = new THREE.Group(); p.position.set(x, 0.4, 0); g.add(p);
    add(geo('leg', () => new THREE.CapsuleGeometry(0.075, 0.2, 8, 16)), pants, 0, -0.17, 0, p);
    const shoe = add(geo('shoe', () => new THREE.SphereGeometry(0.09, 20, 14)), mat('#f4f1ea', { roughness: 0.6 }), 0, -0.34, 0.03, p);
    shoe.scale.set(1, 0.6, 1.35);
    return p;
  });
  // 몸통: 아래가 살짝 퍼지는 종 모양 (회전체)
  parts.body = add(geo('body', () => {
    const pts = [[0, 0.0], [0.2, 0.0], [0.235, 0.06], [0.23, 0.18], [0.2, 0.3], [0.15, 0.4], [0.09, 0.44], [0, 0.45]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 32);
  }), outfit, 0, 0.42, 0);
  // 옷깃(밝은 띠)
  const collar = add(geo('collar', () => new THREE.TorusGeometry(0.1, 0.025, 10, 28)), mat('#fbf7ee'), 0, 0.85, 0.01); collar.rotation.x = Math.PI / 2;
  if (L.apron) { const ap = add(geo('apron', () => new THREE.CylinderGeometry(0.236, 0.226, 0.3, 32, 1, true, -0.9, 1.8)), mat(L.apron, { side: THREE.DoubleSide }), 0, 0.57, 0.004); void ap; }
  // 팔 (어깨에서 회전) + 동그란 손
  parts.arms = [-0.2, 0.2].map((x) => {
    const p = new THREE.Group(); p.position.set(x, 0.8, 0); g.add(p);
    const sl = add(geo('arm', () => new THREE.CapsuleGeometry(0.06, 0.2, 8, 16)), outfit, 0, -0.13, 0, p);
    sl.rotation.z = x < 0 ? -0.12 : 0.12;
    add(geo('hand', () => new THREE.SphereGeometry(0.06, 20, 14)), skin, x < 0 ? -0.03 : 0.03, -0.29, 0, p);
    return p;
  });
  // 머리 (크고 매끈한 구)
  const head = new THREE.Group(); head.position.y = 1.18; g.add(head); parts.head = head;
  const skull = add(geo('head', () => new THREE.SphereGeometry(0.34, 40, 30)), skin, 0, 0, 0, head);
  skull.scale.set(1.04, 0.96, 1);
  add(geo('neck', () => new THREE.CylinderGeometry(0.07, 0.08, 0.1, 16)), skin, 0, -0.3, 0, head);
  // 귀
  [-0.33, 0.33].forEach((x) => { const e = add(geo('ear', () => new THREE.SphereGeometry(0.06, 16, 12)), skin, x, -0.02, 0, head); e.scale.set(0.6, 1, 0.8); });
  // 눈: 'line' = 웃는 눈(초승달), 'dot' = 반짝이는 동그란 눈
  [-0.115, 0.115].forEach((x) => {
    if (L.eyes === 'line') {
      const e = add(geo('eyeLine', () => new THREE.TorusGeometry(0.04, 0.011, 8, 20, Math.PI)), dark, x, 0.0, 0.322, head);
      e.rotation.z = 0; e.castShadow = false;
    } else {
      const e = add(geo('eyeDot', () => new THREE.SphereGeometry(0.038, 20, 14)), dark, x, 0.0, 0.31, head); e.scale.set(0.85, 1.1, 0.5);
      const hl = add(geo('eyeHl', () => new THREE.SphereGeometry(0.011, 10, 8)), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), x + 0.012, 0.018, 0.33, head); hl.castShadow = false;
    }
  });
  // 볼터치 (부드러운 그라데이션)
  const bm = new THREE.MeshBasicMaterial({ map: blush(), transparent: true, depthWrite: false });
  [-0.19, 0.19].forEach((x) => { const c = add(geo('blush', () => new THREE.PlaneGeometry(0.13, 0.09)), bm, x, -0.08, 0.3, head); c.rotation.y = x * 1.6; c.castShadow = false; });
  // 입 (작은 미소)
  const mouth = add(geo('mouth', () => new THREE.TorusGeometry(0.028, 0.008, 8, 16, Math.PI)), mat('#8a3b3b'), 0, -0.085, 0.322, head);
  mouth.rotation.z = Math.PI; mouth.castShadow = false;
  // 머리카락
  const hs = L.hairStyle;
  if (hs !== 'bald') { const cap = add(geo('hairCap', () => new THREE.SphereGeometry(0.355, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2.05)), hair, 0, 0.02, -0.015, head); cap.scale.set(1.04, 0.98, 1.02); cap.rotation.x = -0.18; }
  if (hs === 'short' || hs === 'long' || hs === 'ponytail') { const bang = add(geo('bang', () => new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), hair, 0, 0.16, 0.18, head); bang.scale.set(1.5, 0.55, 0.9); bang.rotation.x = 0.5; }
  if (hs === 'bun') add(geo('bun', () => new THREE.SphereGeometry(0.13, 24, 16)), hair, 0, 0.34, -0.1, head);
  if (hs === 'long') { const l = add(geo('long', () => new THREE.CapsuleGeometry(0.28, 0.25, 8, 24)), hair, 0, -0.16, -0.12, head); l.scale.set(1.1, 1, 0.55); }
  if (hs === 'ponytail') { const t = add(geo('pony', () => new THREE.CapsuleGeometry(0.075, 0.22, 8, 16)), hair, 0, -0.04, -0.37, head); t.rotation.x = 0.5; }
  if (hs === 'perm') for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2; add(geo('curl', () => new THREE.SphereGeometry(0.1, 16, 12)), hair, Math.cos(a) * 0.27, 0.17 + Math.sin(i * 1.7) * 0.05, Math.sin(a) * 0.23 - 0.05, head); }
  if (hs === 'spiky') for (let i = 0; i < 7; i++) { const c = add(geo('spike', () => new THREE.ConeGeometry(0.07, 0.18, 12)), hair, (i - 3) * 0.08, 0.33, -0.02, head); c.rotation.z = (i - 3) * 0.15; }
  // 액세서리
  const ac = mat(L.accessoryColor);
  switch (L.accessory) {
    case 'glasses':
      [-0.115, 0.115].forEach((x) => { const r = add(geo('glass', () => new THREE.TorusGeometry(0.065, 0.01, 8, 24)), dark, x, 0.0, 0.335, head); r.castShadow = false; });
      break;
    case 'headscarf': { const b = add(geo('scarf', () => new THREE.TorusGeometry(0.33, 0.06, 12, 32)), ac, 0, 0.13, 0, head); b.rotation.x = Math.PI / 2.2; add(geo('knot', () => new THREE.SphereGeometry(0.07, 12, 10)), ac, 0.13, 0.15, -0.31, head); break; }
    case 'hat': add(geo('brim', () => new THREE.CylinderGeometry(0.48, 0.48, 0.03, 40)), ac, 0, 0.24, 0, head); add(geo('crownHat', () => new THREE.CylinderGeometry(0.24, 0.27, 0.22, 32)), ac, 0, 0.35, 0, head); break;
    case 'beanie': { const bn = add(geo('beanie', () => new THREE.SphereGeometry(0.37, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.2)), ac, 0, 0.04, 0, head); void bn; add(geo('pom', () => new THREE.SphereGeometry(0.08, 16, 12)), ac, 0, 0.4, 0, head); break; }
    case 'catears': [-0.19, 0.19].forEach((x) => { const e = add(geo('catear', () => new THREE.ConeGeometry(0.1, 0.18, 16)), ac, x, 0.32, 0, head); e.rotation.z = -x * 1.1; }); break;
    case 'flower': for (let k = 0; k < 5; k++) { const a = k * 1.256; add(geo('petal', () => new THREE.SphereGeometry(0.035, 12, 8)), ac, 0.22 + Math.cos(a) * 0.04, 0.22 + Math.sin(a) * 0.04, 0.14, head); } add(geo('fcenter', () => new THREE.SphereGeometry(0.025, 10, 8)), mat('#ffd43b'), 0.22, 0.22, 0.16, head); break;
    case 'towel': {
      [-0.22, 0.22].forEach((x) => add(geo('towelB', () => new THREE.SphereGeometry(0.15, 20, 14)), ac, x, 0.22, -0.02, head));
      const b = add(geo('towelR', () => new THREE.TorusGeometry(0.33, 0.05, 10, 32)), ac, 0, 0.09, 0, head); b.rotation.x = Math.PI / 2;
      break;
    }
    case 'crown': add(geo('crownG', () => new THREE.CylinderGeometry(0.17, 0.19, 0.13, 8, 1, true)), mat('#ffd23f', { metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }), 0, 0.36, 0, head); break;
    case 'hanbok': add(geo('skirt', () => new THREE.ConeGeometry(0.33, 0.4, 32, 1, true)), mat(L.accessoryColor, { side: THREE.DoubleSide, roughness: 0.9 }), 0, 0.42, 0, g); break;
    // 갓: 반투명한 검은 챙 + 높은 모자
    case 'gat': {
      const gm = mat('#16141a', { transparent: true, opacity: 0.88, roughness: 0.5 });
      add(geo('gatBrim', () => new THREE.CylinderGeometry(0.6, 0.6, 0.015, 48)), gm, 0, 0.27, 0, head).castShadow = false;
      add(geo('gatCrown', () => new THREE.CylinderGeometry(0.17, 0.2, 0.3, 32)), gm, 0, 0.42, 0, head);
      [-1, 1].forEach((s) => { const st = add(geo('gatStrap', () => new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6)), mat('#2a2233'), s * 0.3, 0.05, 0.06, head); st.rotation.z = s * 0.12; });
      break;
    }
    // 유건: 유생이 쓰던 검은 두건
    case 'yugeon': {
      const ym = mat('#1d1b22', { roughness: 0.85 });
      const cap = add(geo('yugeon', () => new THREE.SphereGeometry(0.37, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.3)), ym, 0, 0.05, -0.01, head); cap.scale.set(1.02, 1.12, 1.02);
      const ridge = add(geo('yugeonR', () => new THREE.BoxGeometry(0.05, 0.12, 0.42)), ym, 0, 0.42, -0.03, head); void ridge;
      [-1, 1].forEach((s) => { const f = add(geo('yugeonF', () => new THREE.BoxGeometry(0.16, 0.2, 0.03)), ym, s * 0.09, 0.12, -0.36, head); f.rotation.z = s * 0.15; });
      break;
    }
    default: break;
  }
  // 도포: 발목까지 내려오는 긴 옷 + 허리끈(세조대)
  if (L.robe) {
    add(geo('robe', () => new THREE.CylinderGeometry(0.2, 0.34, 0.62, 32, 1, true)), mat(L.outfit, { side: THREE.DoubleSide, roughness: 0.92 }), 0, 0.36, 0, g);
    const belt = add(geo('belt', () => new THREE.TorusGeometry(0.205, 0.018, 8, 32)), mat(L.belt || '#c92a2a'), 0, 0.66, 0, g); belt.rotation.x = Math.PI / 2;
    add(geo('beltTail', () => new THREE.CapsuleGeometry(0.014, 0.28, 4, 8)), mat(L.belt || '#c92a2a'), 0.08, 0.5, 0.2, g);
  }
  // 수염 (훈장님)
  if (L.beard) {
    const bm2 = mat(L.beard, { roughness: 0.9 });
    const b = add(geo('beard', () => new THREE.ConeGeometry(0.11, 0.3, 20)), bm2, 0, -0.27, 0.22, head); b.rotation.x = Math.PI + 0.35;
    [-1, 1].forEach((s) => { const m = add(geo('mous', () => new THREE.CapsuleGeometry(0.018, 0.1, 4, 8)), bm2, s * 0.05, -0.06, 0.32, head); m.rotation.z = s * 1.2; });
  }
  g.scale.setScalar(L.height || 1);
  g.userData.parts = parts;
  g.userData.look = L;
  return g;
}

export function animateCharacter(c, { walking = false, phase = 0, seated = false, wave = false, talk = false, cheer = false, cook = false, hold = false, grab = false }, now) {
  const p = c.userData.parts;
  if (!p) return;
  const sw = walking ? Math.sin(phase) * 0.6 : 0;
  if (seated) { p.legs.forEach((l) => { l.rotation.x = -1.4; }); }
  else { p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw; }
  if (wave) { p.arms[1].rotation.x = -2.7 + Math.sin(now / 110) * 0.35; p.arms[0].rotation.x = -sw * 0.7; }
  else if (cheer) { p.arms.forEach((a, i) => { a.rotation.x = -2.5 + Math.sin(now / 140 + i) * 0.3; }); }
  else if (cook) { p.arms[0].rotation.x = -1.3 + Math.sin(now / 90) * 0.35; p.arms[1].rotation.x = -1.0 + Math.cos(now / 120) * 0.25; }
  else if (grab) { p.arms[0].rotation.x = -0.3; p.arms[1].rotation.x = -2.2 + Math.sin(now / 200) * 0.2; }
  else if (hold) { p.arms.forEach((a) => { a.rotation.x = -1.35; }); }
  else { p.arms[0].rotation.x = -sw * 0.7 + (seated ? -0.6 : 0); p.arms[1].rotation.x = sw * 0.7 + (seated ? -0.6 : 0); }
  p.head.rotation.z = talk ? Math.sin(now / 160) * 0.06 : 0;
  p.head.position.y = 1.18 + (talk ? Math.abs(Math.sin(now / 120)) * 0.015 : 0) + (walking ? Math.abs(Math.sin(phase)) * 0.02 : 0);
}

// ---------------- 이름표 스프라이트 ----------------
export function nameSprite(text, { bg = 'rgba(20,16,40,0.7)', fg = '#fff', scale = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.font = '700 46px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
  const w = Math.min(500, g.measureText(text).width + 44);
  g.fillStyle = bg;
  g.beginPath(); g.roundRect ? g.roundRect((512 - w) / 2, 8, w, 80, 40) : g.rect((512 - w) / 2, 8, w, 80); g.fill();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false }));
  s.scale.set(1.6 * scale, 0.3 * scale, 1);
  s.renderOrder = 10;
  return s;
}

// ---------------- 손님 외형 자동 생성 ----------------
const SKINS = ['#ffe0c7', '#f2c9a0', '#e8b48a', '#d49b6e', '#b97f55'];
const HAIRS = ['#2b1d14', '#1a1a1a', '#5a3a22', '#8a5a2b', '#c9a06b', '#e8e1d6', '#d65a5a', '#6b5bd6'];
const OUTFITS = ['#ff8fab', '#74c0fc', '#ffd43b', '#8ce99a', '#b197fc', '#ffa94d', '#f1f3f5', '#495057', '#e599f7', '#63e6be'];
const STYLES = ['short', 'short', 'bun', 'long', 'ponytail', 'perm', 'spiky'];
const ACC = ['none', 'none', 'none', 'glasses', 'beanie', 'hat', 'towel', 'catears', 'flower'];
const ADJ = ['잠 못 드는', '야근한', '퇴근길', '혼술하는', '생각 많은', '출출한', '비 맞은', '첫차 기다리는', '마음 복잡한', '산책 나온', '고민 많은', '심심한'];
const ANIMAL = ['고양이', '수달', '여우', '곰', '토끼', '펭귄', '너구리', '다람쥐', '부엉이', '오리', '강아지', '판다'];
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];
export function randomLook(r = Math.random) {
  return {
    skin: pick(SKINS, r), hair: pick(HAIRS, r), hairStyle: pick(STYLES, r), outfit: pick(OUTFITS, r),
    accessory: pick(ACC, r), accessoryColor: pick(OUTFITS, r), height: 0.95 + r() * 0.1,
  };
}
export const randomName = (r = Math.random) => `${pick(ADJ, r)} ${pick(ANIMAL, r)}`;

// ---------------- 말풍선 ----------------
export function bubbleSprite(text, { bg = 'rgba(246,240,228,0.92)', fg = '#1d1a24' } = {}) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 200;
  const g = c.getContext('2d');
  const font = '600 34px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
  g.font = font;
  // 줄바꿈 (최대 3줄)
  const lines = []; let line = '';
  for (const ch of String(text)) {
    if (g.measureText(line + ch).width > 440) { lines.push(line); line = ch; if (lines.length === 3) break; } else line += ch;
  }
  if (lines.length < 3 && line) lines.push(line);
  if (lines.length === 3 && text.length > lines.join('').length) lines[2] = lines[2].slice(0, -1) + '…';
  const w = Math.min(500, Math.max(...lines.map((l) => g.measureText(l).width)) + 48), h = lines.length * 44 + 32;
  const x0 = (512 - w) / 2, y0 = 200 - h - 22;
  g.fillStyle = bg;
  g.beginPath(); g.roundRect ? g.roundRect(x0, y0, w, h, 26) : g.rect(x0, y0, w, h); g.fill();
  g.beginPath(); g.moveTo(246, y0 + h); g.lineTo(266, y0 + h); g.lineTo(256, 196); g.fill();
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, 256, y0 + 38 + i * 44));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, color: 0xbdb6aa }));
  s.scale.set(1.8, 0.7, 1); s.renderOrder = 11;
  s.center.set(0.5, 0);
  return s;
}

// ---------------- 유생 외형·이름 ----------------
export const ROBES = ['#e9f1ec', '#cfe3dc', '#4a6fa5', '#f4f1ea', '#3b5b92', '#f3c6cf', '#d8cfe8', '#2f3b52'];
const BELTS = ['#c92a2a', '#1c3d6e', '#5c3a8a', '#2b5a3a', '#7a5a2b'];
const SCHOLAR_ADJ = ['부지런한', '졸린', '성실한', '밤샘한', '첫차 탄', '꾸벅꾸벅', '열공하는', '눈 반짝', '조용한', '느긋한', '야무진', '배고픈'];
const SCHOLAR_N = ['유생', '선비', '서생', '학동', '유생', '책벌레'];
export function randomScholar(r = Math.random) {
  return {
    skin: pick(SKINS, r), hair: pick(HAIRS.slice(0, 5), r), hairStyle: pick(['bun', 'bun', 'short', 'long', 'ponytail'], r),
    outfit: pick(ROBES, r), robe: true, belt: pick(BELTS, r),
    accessory: pick(['yugeon', 'yugeon', 'gat', 'none', 'none'], r), accessoryColor: '#1d1b22', height: 0.95 + r() * 0.1,
    eyes: r() < 0.3 ? 'line' : 'dot',
  };
}
export const scholarName = (r = Math.random) => `${pick(SCHOLAR_ADJ, r)} ${pick(SCHOLAR_N, r)}`;
export const HUNJANG_LOOK = { skin: '#efc49c', hair: '#e8e4dc', hairStyle: 'bun', outfit: '#f6f3ea', robe: true, belt: '#3b5b92', accessory: 'gat', beard: '#efece6', eyes: 'line', height: 1.06 };
