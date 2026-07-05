/* ═══════════════════════════════════════════════════════════════
   KOYO — 고요 · shared site behavior (all pages)
   Lenis smooth scroll · nav · cursor · reveals · Three.js mist
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from "three";

THREE.ColorManagement.enabled = false;

export const doc = document.documentElement;
export const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const finePointer = window.matchMedia("(pointer: fine)").matches;

export function initSite() {
  if (!window.gsap || !window.ScrollTrigger) {
    doc.classList.remove("js");
    document.getElementById("preloader")?.remove();
    return null;
  }

  gsap.registerPlugin(ScrollTrigger);
  if (reduced) doc.classList.add("reduced");

  /* ── Smooth scroll ──────────────────────────────────────────── */

  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) { e.preventDefault(); return; }
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.6 });
      else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    });
  });

  /* ── Three.js · ambient mist ────────────────────────────────── */

  const mistCanvas = document.getElementById("mist-canvas");
  if (mistCanvas) {
    const uniforms = {
      uTime:  { value: 0 },
      uRes:   { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0, 0) },
    };
    const renderer = new THREE.WebGLRenderer({ canvas: mistCanvas, antialias: false, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
          float vnoise(in vec2 p){
            vec2 i = floor(p), f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
              u.y);
          }
          float fbm(vec2 p){
            float v = 0.0, a = 0.5;
            mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
            for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = m * p; a *= 0.5; }
            return v;
          }
          uniform float uTime;
          uniform vec2 uRes;
          uniform vec2 uMouse;
          varying vec2 vUv;
          void main(){
            vec2 uv = vUv;
            vec2 p = uv * vec2(uRes.x / uRes.y, 1.0);
            float t = uTime * 0.03;
            vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t * 0.7));
            vec2 r = vec2(
              fbm(p * 1.8 + q * 1.2 + vec2(1.7, 9.2) + t * 0.6),
              fbm(p * 1.8 + q * 1.2 + vec2(8.3, 2.8) - t * 0.4));
            float f = fbm(p * 1.6 + r * 1.1 + uMouse * 0.14);

            vec3 paper = vec3(0.953, 0.937, 0.906);
            vec3 mistc = vec3(0.902, 0.874, 0.806);
            vec3 jade  = vec3(0.853, 0.867, 0.798);
            vec3 gold  = vec3(0.930, 0.885, 0.774);

            vec3 col = paper;
            col = mix(col, mistc, smoothstep(0.35, 0.9, f) * 0.55);
            col = mix(col, jade,  smoothstep(0.42, 0.92, q.y) * 0.22);
            col = mix(col, gold,  smoothstep(0.46, 0.96, r.x) * 0.20);

            float breathe = 0.5 + 0.5 * sin(uTime * 0.08);
            col = mix(paper, col, 0.62 + 0.38 * breathe);

            float vig = smoothstep(1.28, 0.3, length(uv - 0.5));
            col *= mix(0.962, 1.0, vig);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    ));

    const sizeMist = () => {
      const w = Math.max(2, window.innerWidth * 0.5);
      const h = Math.max(2, window.innerHeight * 0.5);
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    };
    sizeMist();
    window.addEventListener("resize", sizeMist);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    if (finePointer) {
      window.addEventListener("pointermove", (e) => {
        mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }

    let mistVisible = true;
    const footer = document.querySelector(".footer");
    if (footer) {
      new IntersectionObserver(
        ([e]) => (mistVisible = !(e.isIntersecting && e.intersectionRatio > 0.9)),
        { threshold: [0, 0.9, 1] }
      ).observe(footer);
    }

    const renderLoop = (time) => {
      if (reduced) {
        renderer.render(scene, camera);
        gsap.ticker.remove(renderLoop);
        return;
      }
      if (document.hidden) return;
      uniforms.uTime.value = time;
      mouse.x += (mouse.tx - mouse.x) * 0.03;
      mouse.y += (mouse.ty - mouse.y) * 0.03;
      uniforms.uMouse.value.set(mouse.x, mouse.y);
      if (mistVisible) renderer.render(scene, camera);
    };
    gsap.ticker.add(renderLoop);
  }

  /* ── Custom cursor ──────────────────────────────────────────── */

  const cursor = document.getElementById("cursor");
  if (cursor && finePointer && !reduced) {
    const cx = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3" });
    const cy = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3" });
    window.addEventListener("pointermove", (e) => {
      cursor.classList.add("is-awake");
      cx(e.clientX); cy(e.clientY);
    }, { passive: true });
    document.querySelectorAll("[data-cursor]").forEach((el) => {
      el.addEventListener("pointerenter", () => cursor.classList.add("is-active"));
      el.addEventListener("pointerleave", () => cursor.classList.remove("is-active"));
    });
  } else {
    cursor?.remove();
  }

  /* ── Magnetic buttons ───────────────────────────────────────── */

  if (finePointer && !reduced) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
      el.addEventListener("pointermove", (e) => {
        const b = el.getBoundingClientRect();
        xTo((e.clientX - b.left - b.width / 2) * 0.18);
        yTo((e.clientY - b.top - b.height / 2) * 0.3);
      });
      el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
  }

  /* ── Navigation ─────────────────────────────────────────────── */

  const nav = document.getElementById("nav");
  if (nav) {
    let lastY = 0;
    const navY = gsap.quickTo(nav, "yPercent", { duration: 0.5, ease: "power3" });
    const announce = document.querySelector(".announce");
    const onScrollPos = (y) => {
      if (announce) nav.style.top = Math.max(0, announce.offsetHeight - y) + "px";
      nav.classList.toggle("is-scrolled", y > 90);
      if (!reduced) {
        if (y > 500 && y > lastY + 4) navY(-130);
        else if (y < lastY - 4 || y < 500) navY(0);
      }
      lastY = y;
    };
    if (lenis) lenis.on("scroll", ({ scroll }) => onScrollPos(scroll));
    else window.addEventListener("scroll", () => onScrollPos(window.scrollY), { passive: true });
  }

  /* ── Mobile menu ────────────────────────────────────────────── */

  const burger = document.getElementById("nav-burger");
  const mobileMenu = document.getElementById("mobile-menu");
  if (burger && mobileMenu) {
    const setMenu = (open) => {
      burger.classList.toggle("is-open", open);
      mobileMenu.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
      mobileMenu.setAttribute("aria-hidden", String(!open));
      if (lenis) open ? lenis.stop() : lenis.start();
    };
    burger.addEventListener("click", () => setMenu(!mobileMenu.classList.contains("is-open")));
    mobileMenu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        setMenu(false);
        const href = a.getAttribute("href");
        if (href.startsWith("#") && lenis) {
          const target = document.querySelector(href);
          if (target) lenis.scrollTo(target, { duration: 1.4 });
        }
      }));
  }

  /* ── Scroll reveals ─────────────────────────────────────────── */

  if (reduced) {
    gsap.set("[data-reveal]", { autoAlpha: 1 });
  } else {
    gsap.utils.toArray("[data-reveal]").forEach((el) => {
      gsap.fromTo(el,
        { autoAlpha: 0, y: 36 },
        { autoAlpha: 1, y: 0, duration: 1.35, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    });
  }

  /* refresh triggers once fonts settle */
  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

  window.__koyo = { lenis };
  return { lenis };
}
