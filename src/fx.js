// 하늘 효과: 구름 · 번개 · 굵은 비 · 무지개 · 오로라 · 반딧불 · 별똥별 · 바람
// 프롬프트로 고른 날씨가 "그대로" 보이도록 하는 부분
import * as THREE from 'three';

const rnd = Math.random;
function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

// 날씨 이름 → 기본 효과값 (프롬프트에서 따로 지정하면 그게 우선)
export function fxDefaults(weather) {
  return ({
    clear: { clouds: 0.1 }, cloudy: { clouds: 0.75 }, rain: { clouds: 0.85, rain: 0.7 }, storm: { clouds: 1, rain: 1, lightning: true, wind: 0.6 },
    snow: { clouds: 0.6 }, blizzard: { clouds: 0.9, wind: 1 }, fog: { clouds: 0.5 }, petals: { clouds: 0.15, wind: 0.2 }, leaves: { clouds: 0.2, wind: 0.3 },
  })[weather] || { clouds: 0.1 };
}

export function buildFx(scene, { high = true } = {}) {
  const root = new THREE.Group(); scene.add(root);

  // ---- 구름: 부드러운 덩어리 스프라이트
  const cloudTex = tex(256, 128, (g, w, h) => {
    for (let i = 0; i < 14; i++) {
      const x = 40 + rnd() * 176, y = 50 + rnd() * 40, r = 22 + rnd() * 34;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
  const clouds = new THREE.Group(); root.add(clouds);
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0, depthWrite: false, fog: false, color: '#ffffff' });
  for (let i = 0; i < (high ? 46 : 28); i++) {
    const s = new THREE.Sprite(cloudMat);
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 220;
    s.position.set(Math.cos(a) * r, 55 + rnd() * 55, Math.sin(a) * r);
    const sc = 70 + rnd() * 90; s.scale.set(sc * 2, sc, 1);
    clouds.add(s);
  }

  // ---- 굵은 비 (선으로 그려야 빗줄기처럼 보임)
  const NR = high ? 2600 : 1300;
  const rainPos = new Float32Array(NR * 6);
  for (let i = 0; i < NR; i++) { const x = (rnd() - 0.5) * 60, y = rnd() * 24, z = (rnd() - 0.5) * 60; rainPos.set([x, y, z, x, y - 0.6, z], i * 6); }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#b9c9dc', transparent: true, opacity: 0.55, depthWrite: false }));
  rain.frustumCulled = false; rain.visible = false; root.add(rain);

  // ---- 번개: 들쭉날쭉한 줄기 + 화면 번쩍
  const boltMat = new THREE.LineBasicMaterial({ color: '#f4f2ff', transparent: true, opacity: 1, toneMapped: false });
  let bolt = null;
  function makeBolt(cam, look) {
    if (bolt) { root.remove(bolt); bolt.geometry.dispose(); }
    // 지금 보고 있는 방향 앞쪽 하늘에 떨어지게
    const fwd = look ? Math.atan2(look.x, look.z) : rnd() * Math.PI * 2;
    const a = fwd + (rnd() - 0.5) * 1.4, d = 70 + rnd() * 70;
    const base = new THREE.Vector3(cam.x + Math.sin(a) * d, 0, cam.z + Math.cos(a) * d);
    const pts = []; let p = base.clone().setY(95); pts.push(p.clone());
    while (p.y > 2) { p = p.clone().add(new THREE.Vector3((rnd() - 0.5) * 9, -(5 + rnd() * 7), (rnd() - 0.5) * 9)); pts.push(p.clone()); if (rnd() < 0.25) { const b = p.clone().add(new THREE.Vector3((rnd() - 0.5) * 14, -8, (rnd() - 0.5) * 14)); pts.push(b, p.clone()); } }
    const segs = []; for (let i = 0; i < pts.length - 1; i++) segs.push(pts[i], pts[i + 1]);
    bolt = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs), boltMat); bolt.frustumCulled = false; root.add(bolt);
    return base;
  }

  // ---- 무지개
  const rainbow = new THREE.Mesh(new THREE.TorusGeometry(170, 9, 8, 96, Math.PI), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: { op: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float op; varying vec2 vUv;
      vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }
      void main(){ float t = fract(vUv.y); float band = smoothstep(0.0,0.15,t)*smoothstep(0.5,0.35,t); gl_FragColor = vec4(mix(vec3(1.0), hue(t*1.4), 0.85), band * op); }`,
  }));
  rainbow.position.set(0, -70, -280); rainbow.scale.setScalar(1.25); root.add(rainbow);
  const rainbow2 = rainbow.clone(); rainbow2.position.set(0, -70, 280); rainbow2.rotation.y = Math.PI; root.add(rainbow2); // 마루에 앉아 마당 쪽을 볼 때도 보이게

  // ---- 오로라: 커튼처럼 흔들리는 띠
  const auroraMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 }, op: { value: 0 } },
    vertexShader: `uniform float t; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x*0.025 + t*0.4)*18.0 + sin(p.x*0.06 - t*0.7)*6.0; p.y += sin(p.x*0.03 + t*0.3)*6.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
    fragmentShader: `uniform float t; uniform float op; varying vec2 vUv;
      void main(){ float a = smoothstep(0.0,0.25,vUv.y) * (1.0 - vUv.y); float rays = 0.6 + 0.4*sin(vUv.x*90.0 + t*1.5)*sin(vUv.x*37.0 - t);
        vec3 c = mix(vec3(0.15,1.0,0.55), vec3(0.65,0.3,1.0), smoothstep(0.35,1.0,vUv.y)); gl_FragColor = vec4(c * a * rays * op, 1.0); }`,
  });
  const aurora = new THREE.Group(); root.add(aurora);
  [-1, 1].forEach((side) => [230, 270, 300].forEach((z, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(520, 90, 120, 1), auroraMat); m.position.set(i * 60 - 60, 95 + i * 12, side * z); aurora.add(m); }));

  // ---- 반딧불
  const NF = 160, ffPos = new Float32Array(NF * 3), ffSeed = [];
  for (let i = 0; i < NF; i++) { ffSeed.push([(rnd() - 0.5) * 30, rnd() * 2.2 + 0.3, -6 + rnd() * 20, rnd() * 6]); }
  const ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const dot = tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const ffMat = new THREE.PointsMaterial({ color: '#d8ff7a', size: 0.22, map: dot, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const fireflies = new THREE.Points(ffGeo, ffMat); fireflies.frustumCulled = false; root.add(fireflies);

  // ---- 별똥별
  const meteors = [];
  for (let i = 0; i < 4; i++) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, toneMapped: false, fog: false })); l.frustumCulled = false; root.add(l); meteors.push({ l, life: 0 }); }

  const fx = { clouds: 0, rain: 0, lightning: false, rainbow: false, aurora: false, fireflies: false, meteors: false, wind: 0 };
  const cur = { clouds: 0, rainbow: 0, aurora: 0, ff: 0, flash: 0 };
  let nextBolt = 3, nextMeteor = 1, onThunder = null;

  function apply(th) {
    const d = fxDefaults(th.weather);
    Object.assign(fx, { clouds: 0.1, rain: 0, lightning: false, rainbow: false, aurora: false, fireflies: false, meteors: false, wind: 0 }, d, th.fx || {});
    if (fx.lightning && !fx.rain) fx.rain = 0.9;
    rain.visible = fx.rain > 0;
    rain.material.opacity = 0.3 + fx.rain * 0.4;
    nextBolt = 1.5;
  }

  // night: 0~1, palette: 시간대 색, cam: 카메라 위치
  function update(dt, now, cam, night, tint, look) {
    const t = now / 1000, k = Math.min(1, dt * 1.2);
    cur.clouds += (fx.clouds - cur.clouds) * k;
    cur.rainbow += ((fx.rainbow ? 1 : 0) - cur.rainbow) * k * 0.6;
    cur.aurora += ((fx.aurora ? 1 : 0) * Math.max(0.35, night) - cur.aurora) * k * 0.6;
    cur.ff += ((fx.fireflies ? 1 : 0) - cur.ff) * k;
    // 구름
    clouds.rotation.y += dt * (0.004 + fx.wind * 0.02);
    cloudMat.opacity = Math.min(0.95, cur.clouds * 1.05);
    cloudMat.color.set(tint).lerp(new THREE.Color('#3c4350'), Math.max(0, cur.clouds - 0.55) * 1.6);
    // 비
    if (rain.visible) {
      const p = rainGeo.attributes.position.array, sp = (22 + fx.rain * 10) * dt, wx = fx.wind * 6 * dt;
      for (let i = 0; i < NR; i++) {
        const j = i * 6;
        p[j] += wx; p[j + 1] -= sp; p[j + 3] += wx; p[j + 4] -= sp;
        if (p[j + 4] < 0) { const x = cam.x + (rnd() - 0.5) * 60, y = 16 + rnd() * 10, z = cam.z + (rnd() - 0.5) * 60; p.set([x, y, z, x - fx.wind * 0.25, y - 0.7, z], j); }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    // 번개
    cur.flash = Math.max(0, cur.flash - dt * 3.5);
    if (fx.lightning) {
      nextBolt -= dt;
      if (nextBolt <= 0) {
        nextBolt = 3 + rnd() * 7;
        const at = makeBolt(cam, look); cur.flash = 1; boltMat.opacity = 1;
        const dist = Math.hypot(at.x - cam.x, at.z - cam.z);
        onThunder?.(dist / 120); // 멀수록 천둥이 늦게
      }
    }
    if (bolt) { boltMat.opacity = cur.flash > 0.05 ? (Math.sin(t * 60) > -0.3 ? cur.flash : 0.2) : 0; bolt.visible = boltMat.opacity > 0.02; }
    // 무지개 · 오로라 · 반딧불
    rainbow.material.uniforms.op.value = cur.rainbow * 0.85 * (1 - night * 0.8);
    rainbow.visible = rainbow2.visible = cur.rainbow > 0.01;
    auroraMat.uniforms.t.value = t; auroraMat.uniforms.op.value = cur.aurora * 0.9; aurora.visible = cur.aurora > 0.01;
    ffMat.opacity = cur.ff * (0.4 + night * 0.6); fireflies.visible = cur.ff > 0.01;
    if (fireflies.visible) {
      for (let i = 0; i < NF; i++) { const [x, y, z, ph] = ffSeed[i]; ffPos.set([x + Math.sin(t * 0.3 + ph) * 1.2, y + Math.sin(t * 0.7 + ph * 2) * 0.4, z + Math.cos(t * 0.25 + ph) * 1.2], i * 3); }
      ffGeo.attributes.position.needsUpdate = true;
      ffMat.size = 0.18 + Math.sin(t * 3) * 0.04;
    }
    // 별똥별
    if (fx.meteors) {
      nextMeteor -= dt;
      if (nextMeteor <= 0) {
        nextMeteor = 0.8 + rnd() * 2.5;
        const m = meteors.find((x) => x.life <= 0);
        if (m) { const a = rnd() * Math.PI * 2; m.from = new THREE.Vector3(Math.cos(a) * 200, 140 + rnd() * 60, -120 - rnd() * 150); m.dir = new THREE.Vector3(-0.8 + rnd() * 0.3, -0.45, rnd() * 0.3).normalize(); m.life = 1; }
      }
    }
    meteors.forEach((m) => {
      if (m.life <= 0) { m.l.material.opacity = 0; return; }
      m.life -= dt * 1.4; const head = m.from.clone().addScaledVector(m.dir, (1 - m.life) * 160);
      const tail = head.clone().addScaledVector(m.dir, -28);
      m.l.geometry.setFromPoints([tail, head]); m.l.material.opacity = Math.sin(Math.max(0, m.life) * Math.PI);
    });
    return { clouds: cur.clouds, flash: cur.flash, wind: fx.wind };
  }

  return { debug: { cur, rainbow, aurora, auroraMat }, apply, update, fx, strikeNow() { nextBolt = 0; }, set onThunder(f) { onThunder = f; } };
}
