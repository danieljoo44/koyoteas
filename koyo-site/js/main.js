/* ═══════════════════════════════════════════════════════════════
   KOYO — 고요 · home page choreography
   (shared behavior lives in common.js, cart in shop.js)
   ═══════════════════════════════════════════════════════════════ */

import { initSite, reduced } from "./common.js";
import { initShop } from "./shop.js";

const site = initSite();

if (site) {
  const { lenis } = site;
  initShop({ lenis });

  /* ── Preloader → hero intro ─────────────────────────────────── */

  const heroEls = gsap.utils.toArray("[data-hero]");
  const heroKr = document.querySelector(".hero-kr");
  gsap.set(heroKr, { autoAlpha: 0 });

  const heroIntro = gsap.timeline({ paused: true })
    .to(heroKr, { autoAlpha: 1, y: 0, duration: 1.4, ease: "expo.out",
                  startAt: { y: 18 } })
    .to(heroEls, { autoAlpha: 1, y: 0, duration: 1.1, ease: "power3.out",
                   stagger: 0.09, startAt: { y: 22 } }, 0.3);

  const preloader = document.getElementById("preloader");
  if (reduced) {
    preloader.remove();
    gsap.set([heroKr, ...heroEls], { autoAlpha: 1, clearProps: "transform" });
  } else {
    if (lenis) lenis.stop();
    gsap.timeline({
      onComplete: () => { preloader.remove(); if (lenis) lenis.start(); },
    })
      .to(".preloader-mark", { opacity: 1, duration: 0.55, ease: "power2.out" }, 0.15)
      .to(".preloader-kr",   { opacity: 1, duration: 0.7,  ease: "power2.out" }, 0.4)
      .to(".preloader-def",  { opacity: 1, duration: 0.6,  ease: "power2.out" }, 0.65)
      .to(".preloader-inner", { opacity: 0, y: -26, duration: 0.55, ease: "power2.in" }, 1.7)
      .to(preloader, { yPercent: -100, duration: 1.0, ease: "expo.inOut",
                       onStart: () => heroIntro.play() }, 2.0);
  }

  /* ── The Specimens · vertical drift ─────────────────────────── */

  if (!reduced && window.matchMedia("(min-width: 981px)").matches) {
    gsap.utils.toArray(".spec-panel").forEach((panel) => {
      gsap.fromTo(panel.querySelector(".spec-leaf"),
        { y: 46, rotation: -2.5 },
        { y: -46, rotation: 2.5, ease: "none",
          scrollTrigger: { trigger: panel, start: "top bottom", end: "bottom top", scrub: 0.8 } });
    });
  }

  /* ── Manifesto · word-by-word scrub ─────────────────────────── */

  const manifesto = document.getElementById("manifesto");
  (function splitWords(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((piece) => {
          if (/^\s+$/.test(piece) || piece === "") {
            frag.appendChild(document.createTextNode(piece));
          } else {
            const s = document.createElement("span");
            s.className = "w";
            s.textContent = piece;
            frag.appendChild(s);
          }
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) splitWords(child);
    });
  })(manifesto);

  if (!reduced) {
    gsap.to(manifesto.querySelectorAll(".w"), {
      opacity: 1,
      stagger: 0.045,
      ease: "none",
      scrollTrigger: { trigger: manifesto, start: "top 80%", end: "bottom 52%", scrub: 0.5 },
    });
  } else {
    gsap.set(manifesto.querySelectorAll(".w"), { opacity: 1 });
  }

  /* ── Story · cinematic film window ──────────────────────────── */

  if (!reduced) {
    gsap.fromTo(".story-film video, .story-film img", { scale: 1.12 }, {
      scale: 1, ease: "none",
      scrollTrigger: { trigger: ".story-film", start: "top 90%", end: "bottom 40%", scrub: 0.6 },
    });
  }


  /* ── Story · field slideshow ────────────────────────────────── */

  const slides = gsap.utils.toArray(".story-slides img");
  if (slides.length > 1) {
    const box = document.querySelector(".story-slides");
    const cap = document.getElementById("story-caption");
    const idx = document.getElementById("story-slide-n");
    const total = document.getElementById("story-slide-total");
    if (total) total.textContent = String(slides.length).padStart(2, "0");
    let cur = 0;
    let inView = true;
    const label = (next) => {
      cap.textContent = slides[next].dataset.caption;
      if (idx) idx.textContent = String(next + 1).padStart(2, "0");
    };
    const go = () => {
      const next = (cur + 1) % slides.length;
      if (reduced) {
        gsap.set(slides[cur], { autoAlpha: 0 });
        gsap.set(slides[next], { autoAlpha: 1 });
        label(next);
      } else {
        gsap.to(slides[cur], { autoAlpha: 0, duration: 1.4, ease: "power2.inOut" });
        gsap.to(slides[next], { autoAlpha: 1, duration: 1.4, ease: "power2.inOut" });
        gsap.to(cap, { opacity: 0, duration: 0.45, ease: "power1.in", onComplete: () => {
          label(next);
          gsap.to(cap, { opacity: 1, duration: 0.45, ease: "power1.out" });
        } });
      }
      cur = next;
    };
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { rootMargin: "10%" })
      .observe(box);
    box.style.cursor = "pointer";
    box.addEventListener("click", go);
    if (!reduced) setInterval(() => { if (inView) go(); }, 9000);
  }

  // phones get the lighter hero rendition
  const heroVid = document.querySelector(".hero-film video");
  if (heroVid && window.matchMedia("(max-width: 640px)").matches) {
    heroVid.src = "assets/video/hero-film-mobile.mp4";
  }

  // let the footage breathe slowly, and only play what is on screen
  document.querySelectorAll(".story-film video, .hero-film video").forEach((video) => {
    video.playbackRate = 0.85;
    if (reduced) { video.removeAttribute("autoplay"); video.pause(); return; }
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { rootMargin: "20%" }).observe(video);
  });

  /* ── Newsletter form ────────────────────────────────────────── */

  const form = document.getElementById("letter-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const thanks = document.getElementById("letter-thanks");
    gsap.to(form, {
      autoAlpha: 0, y: -12, duration: 0.5, ease: "power2.in",
      onComplete: () => {
        form.style.display = "none";
        thanks.style.display = "block";
        gsap.fromTo(thanks, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" });
      },
    });
  });
}
