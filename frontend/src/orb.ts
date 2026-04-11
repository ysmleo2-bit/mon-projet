import * as THREE from "three";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const STATE_RGB: Record<OrbState, [number, number, number]> = {
  idle:      [0.08, 0.22, 0.36],
  listening: [0.00, 0.74, 0.83],
  thinking:  [0.49, 0.30, 1.00],
  speaking:  [0.00, 0.90, 1.00],
};

const VERT = /* glsl */`
  attribute float aScale;
  attribute float aRandom;
  uniform float uTime;
  uniform float uAudio;
  uniform float uSpeed;
  varying float vAlpha;

  void main() {
    vec3 p = position;

    // Organic surface noise
    float n =
      sin(p.x * 3.2 + uTime) *
      cos(p.y * 2.8 + uTime * 0.7) *
      sin(p.z * 3.5 + uTime * 1.1);

    float d = n * (0.04 + uAudio * 0.28);
    p += normalize(p) * d;

    // Breathe with audio
    p *= 1.0 + uAudio * 0.12 * aRandom;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float sz = aScale * (2.8 + uAudio * 5.0);
    gl_PointSize = sz * (280.0 / -mv.z);

    vAlpha = 0.35 + aScale * 0.65 + uAudio * 0.35;
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    if (d > 0.5) discard;
    float alpha = (1.0 - d * 2.0) * vAlpha;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export class OrbVisualizer {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly material: THREE.ShaderMaterial;
  private readonly particles: THREE.Points;
  private readonly clock = new THREE.Clock();
  private raf: number | null = null;
  private _audioLevel = 0;
  private _state: OrbState = "idle";

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
    this.camera.position.z = 3;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const COUNT = 3200;
    const positions = new Float32Array(COUNT * 3);
    const scales = new Float32Array(COUNT);
    const randoms = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      // Fibonacci sphere
      const phi = Math.acos(1 - (2 * (i + 0.5)) / COUNT);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 0.85 + Math.random() * 0.25;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      scales[i]  = Math.random();
      randoms[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aScale",   new THREE.BufferAttribute(scales, 1));
    geo.setAttribute("aRandom",  new THREE.BufferAttribute(randoms, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime:  { value: 0 },
        uAudio: { value: 0 },
        uSpeed: { value: 0.3 },
        uColor: { value: new THREE.Color(...STATE_RGB.idle) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geo, this.material);
    this.scene.add(this.particles);

    window.addEventListener("resize", () => this._resize());
    this._resize();
  }

  setState(state: OrbState): void {
    this._state = state;
    const [r, g, b] = STATE_RGB[state];
    (this.material.uniforms.uColor.value as THREE.Color).setRGB(r, g, b);
  }

  setAudioLevel(level: number): void {
    this._audioLevel = Math.max(0, Math.min(1, level));
  }

  start(): void {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this._render();
    };
    tick();
  }

  stop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  private _render(): void {
    const t = this.clock.getElapsedTime();
    const dt = this.clock.getDelta();

    // Smooth audio
    const target = this._state === "idle" ? 0.02 : this._audioLevel;
    const cur = this.material.uniforms.uAudio.value as number;
    this.material.uniforms.uAudio.value = cur + (target - cur) * 0.08;

    // Speed by state
    const speeds: Record<OrbState, number> = {
      idle: 0.25, listening: 0.55, thinking: 1.1, speaking: 0.7,
    };
    this.material.uniforms.uTime.value = t * speeds[this._state];

    // Slow drift
    this.particles.rotation.y += dt * 0.08;
    this.particles.rotation.x += dt * 0.04;

    this.renderer.render(this.scene, this.camera);
  }

  private _resize(): void {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
