// Opening and audio initialize independently of the invitation's editable content.
(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const opening = $("#opening");
  const button = $("#open-invitation");
  const effects = $("#opening-effects");
  const audio = $("#wedding-audio");
  const chime = $("#opening-chime");
  const musicButton = $("#music-toggle");
  const musicHint = $("#music-hint");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const openingDuration = 1780;
  const openingScale = openingDuration / 1680;
  opening.style.setProperty("--opening-scale", openingScale);
  const heartPath = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
  const heartSVG = () => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${heartPath}"/></svg>`;
  let state = "closed";
  let musicWanted = false;
  let musicAttempt = 0;
  let musicRetryController;
  $("#wedding").inert = true;

  // Bảng màu hồng/magenta như ảnh cánh hoa hồng thật (gốc nhạt, mép đậm).
  const petalColors = [
    { pale: "#ffe6f0", mid: "#f06595", deep: "#c2185b", edge: "#8f1046" },
    { pale: "#ffe0ec", mid: "#ec5f8f", deep: "#b01a57", edge: "#850f44" },
    { pale: "#ffeaf3", mid: "#f576a5", deep: "#d6336c", edge: "#9d174d" },
    { pale: "#ffdce9", mid: "#e84d82", deep: "#ad1457", edge: "#7d0e40" },
  ];
  // Vài dáng cánh khác nhau: tròn, nghiêng, rộng, thuôn.
  const petalShapes = [
    "M50 110C22 98 6 74 7 46 8 24 26 8 48 14 49 9 51 9 52 14 74 8 92 24 93 46 94 74 78 98 50 110Z",
    "M48 110C18 96 4 70 10 42 14 22 34 8 54 16 76 10 94 28 90 52 86 78 72 98 48 110Z",
    "M50 109C20 97 5 72 8 44 10 26 27 12 44 18 47 10 53 10 56 18 73 12 90 26 92 44 95 72 80 97 50 109Z",
    "M50 110C26 100 8 78 9 50 10 28 28 10 50 16 72 10 90 28 91 50 92 78 74 100 50 110Z",
  ];

  function rosePetalSVG(index, color, shape) {
    const id = `rp${index}`;
    return `<svg viewBox="0 0 100 112" aria-hidden="true">`
      + `<defs><radialGradient id="${id}" cx="48%" cy="86%" r="82%">`
      + `<stop offset="0" stop-color="${color.pale}"/>`
      + `<stop offset=".22" stop-color="${color.mid}"/>`
      + `<stop offset=".58" stop-color="${color.deep}"/>`
      + `<stop offset="1" stop-color="${color.edge}"/>`
      + `</radialGradient></defs>`
      + `<path d="${shape}" fill="url(#${id})"/>`
      + `<g fill="none" stroke="${color.edge}" stroke-opacity=".2" stroke-width="1.1" stroke-linecap="round">`
      + `<path d="M50 104C49 78 48 52 48 24"/><path d="M50 102C42 80 34 58 27 41"/>`
      + `<path d="M50 102C58 80 66 58 73 41"/><path d="M50 101C38 84 27 67 19 53"/>`
      + `<path d="M50 101C62 84 73 67 81 53"/></g>`
      + `<path d="M31 33C41 20 59 20 69 33 57 29 43 29 31 33Z" fill="#fff" opacity=".2"/>`
      + `</svg>`;
  }

  if (!reducedMotion.matches) {
    const petals = $("#opening-petals");
    for (let i = 0; i < 35; i++) {
      const petal = document.createElement("span");
      const depth = i % 6;
      const variant = i % 4;
      const color = petalColors[i % petalColors.length];
      const startRotation = Math.round(Math.random() * 300 - 150);
      // Lớp gần (depth 0) là cánh lớn, mờ bokeh ở tiền cảnh.
      const size = depth === 0 ? 50 + Math.random() * 34 : 18 + Math.random() * 30;
      petal.className = `rose-petal rose-petal-${variant + 1} petal-depth-${depth}`;
      petal.style.cssText = [
        `left:${Math.random() * 100}%`,
        `--petal-size:${size}px`,
        `--petal-duration:${8.5 + Math.random() * 8}s`,
        `--petal-delay:-${Math.random() * 16}s`,
        `--petal-drift:${Math.round(Math.random() * 210 - 105)}px`,
        `--petal-sway:${Math.round(35 + Math.random() * 90)}px`,
        `--petal-turn:${Math.round(360 + Math.random() * 720)}deg`,
        `--petal-start:${startRotation}deg`,
      ].join(";");
      petal.innerHTML = rosePetalSVG(i, color, petalShapes[variant]);
      petals.append(petal);
    }
  }

  function cancelMusicRetry() {
    musicRetryController?.abort();
    musicRetryController = undefined;
  }

  function retryMusicOnGesture() {
    if (musicRetryController) return;
    musicRetryController = new AbortController();
    const retry = event => {
      if (!musicWanted || state === "closed" || musicButton.contains(event.target)) return;
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      playMusic();
    };
    for (const type of ["click", "keydown"]) {
      document.addEventListener(type, retry, { capture: true, signal: musicRetryController.signal });
    }
  }

  function updateMusic() {
    const playing = !audio.paused && !audio.error;
    musicButton.classList.toggle("is-playing", playing);
    musicButton.setAttribute("aria-pressed", String(playing));
    musicButton.setAttribute("aria-label", playing ? "Tắt nhạc nền" : "Bật nhạc nền");
  }

  async function playMusic() {
    musicWanted = true;
    const attempt = ++musicAttempt;
    audio.muted = false;
    audio.volume = 0.8;
    musicButton.setAttribute("aria-busy", "true");
    try {
      if (audio.error) audio.load();
      // Called synchronously from the click, before waiting for any animation or fetch.
      await audio.play();
      if (attempt !== musicAttempt) return;
      cancelMusicRetry();
      musicHint.hidden = true;
    } catch (error) {
      if (attempt !== musicAttempt || !musicWanted) return;
      if (error.name === "NotAllowedError") {
        musicHint.textContent = "Chạm để bật nhạc";
        musicHint.hidden = false;
        retryMusicOnGesture();
      } else if (error.name !== "AbortError") {
        cancelMusicRetry();
        musicHint.textContent = "Nhạc chưa tải được · Chạm để thử lại";
        musicHint.hidden = false;
      }
    } finally {
      if (attempt === musicAttempt) {
        musicButton.removeAttribute("aria-busy");
        updateMusic();
      }
    }
  }

  audio.addEventListener("play", updateMusic);
  audio.addEventListener("pause", updateMusic);
  musicButton.addEventListener("click", () => {
    if (audio.paused) {
      playMusic();
    } else {
      musicWanted = false;
      ++musicAttempt;
      cancelMusicRetry();
      musicHint.hidden = true;
      musicButton.removeAttribute("aria-busy");
      audio.pause();
      chime.pause();
    }
  });

  function createSealRing() {
    const ring = document.createElement("span");
    ring.className = "seal-ring";
    effects.append(ring);
  }

  // Hai cụm hoa góc phóng to bung ra rồi mờ dần (dragon-fly-forward của trang gốc).
  function createFlowerFly() {
    document.querySelectorAll(".invitation-cover .cover-flower").forEach(flower => {
      const rect = flower.getBoundingClientRect();
      if (!rect.width) return;
      const mirror = flower.classList.contains("cover-flower-right");
      const fly = document.createElement("img");
      fly.src = flower.currentSrc || flower.src;
      fly.alt = "";
      fly.setAttribute("aria-hidden", "true");
      fly.className = "flower-fly";
      // Kích thước thật (chưa xoay) + tâm của hoa, rồi keyframe xoay 25° cho khớp hoa trên thiệp.
      fly.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height / 2}px;width:${flower.offsetWidth}px;height:${flower.offsetHeight}px;--fly-scale-x:${mirror ? -1 : 1}`;
      effects.append(fly);
    });
  }

  // Tim bắn toả từ tâm dấu niêm (hiệu ứng cũ), kèm vài đốm bokeh kem.
  const burstColors = ["#a8323b", "#c9a24a", "#7a1f26", "#f3e8de"];
  function createHeartBurst() {
    const seal = $(".wax-seal").getBoundingClientRect();
    effects.style.setProperty("--origin-x", `${seal.left + seal.width / 2}px`);
    effects.style.setProperty("--origin-y", `${seal.top + seal.height / 2}px`);
    createSealRing();
    for (let i = 0; i < 32; i++) {
      const angle = 2 * Math.PI * i / 32 + (Math.random() - .5) * .4;
      const radius = 25 + 60 * Math.random();
      const bokeh = i % 4 === 0;
      const particle = document.createElement("span");
      particle.className = `petal-burst${bokeh ? " is-bokeh" : ""}`;
      particle.style.cssText = [
        `--dx:${(Math.cos(angle) * radius * 5).toFixed(1)}px`,
        `--dy:${(Math.sin(angle) * radius * 5).toFixed(1)}px`,
        `--rot-start:${((Math.random() - .5) * 30).toFixed(1)}deg`,
        `--rot-end:${((Math.random() - .5) * 360).toFixed(1)}deg`,
        `--delay:${(.15 * openingScale * Math.random()).toFixed(3)}s`,
        `--size:${(bokeh ? 22 + 14 * Math.random() : 12 + 14 * Math.random()).toFixed(1)}px`,
        `color:${burstColors[i % burstColors.length]}`,
      ].join(";");
      if (!bokeh) particle.innerHTML = heartSVG();
      effects.append(particle);
    }
  }

  function finishOpening() {
    if (state === "open") return;
    state = "open";
    opening.hidden = true;
    opening.setAttribute("aria-hidden", "true");
    effects.querySelectorAll(".petal-burst,.seal-ring,.flower-fly").forEach(element => element.remove());
    $("#wedding").inert = false;
    document.body.classList.remove("is-closed");
    document.body.classList.add("invitation-open");
    $("#floating-controls").hidden = false;
    button.removeAttribute("aria-busy");
    document.dispatchEvent(new CustomEvent("invitation:opened"));
  }

  function openInvitation(immediate = false) {
    if (state !== "closed") return;
    state = "opening";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    // Both sounds start within the original user gesture, including on touch screens.
    playMusic();
    if (immediate) {
      finishOpening();
      return;
    }
    chime.muted = false;
    chime.volume = 0.55;
    chime.play().catch(() => {});
    $("#open-button-label").textContent = "Đang mở thiệp…";
    window.scrollTo(0, 0);
    if (reducedMotion.matches) {
      opening.classList.add("is-revealing");
      setTimeout(finishOpening, 180);
    } else {
      // Slow the whole sequence by 0.1s, keeping the flowers and reveal in sync.
      createHeartBurst();
      createFlowerFly();
      opening.classList.add("is-breaking");
      setTimeout(() => opening.classList.add("is-flying"), 576 * openingScale);
      setTimeout(() => {
        opening.classList.add("is-revealing");
        document.body.classList.add("is-entering");
      }, 984 * openingScale);
      setTimeout(() => {
        finishOpening();
        const hero = $(".hero");
        hero.setAttribute("tabindex", "-1");
        hero.focus({ preventScroll: true });
        document.body.classList.remove("is-entering");
      }, openingDuration);
    }
    // Keep the normal URL unchanged, so reloading always offers the opening again.
  }

  button.addEventListener("click", () => openInvitation());
  if (new URLSearchParams(location.search).get("open") === "1") openInvitation(true);
})();
