(() => {
  "use strict";

  const config = window.WEDDING_CONFIG;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  // Incomplete dates must not prevent the opening button or music from initializing.
  const dateInput = String(config.date || "");
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateInput) ? new Date(`${dateInput}T00:00:00Z`) : null;
  const calendarDate = parsedDate && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === dateInput ? parsedDate : null;
  const dateParts = calendarDate ? dateInput.split("-").map(Number) : null;
  const receptionTimeValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(config.receptionTime || "");
  const weddingDate = calendarDate && receptionTimeValid ? new Date(`${dateInput}T${config.receptionTime}:00+07:00`) : null;
  const dateOptions = { timeZone: "Asia/Ho_Chi_Minh" };
  const storageKey = `wedding-${config.date}-${config.groom}-${config.bride}`;
  // Màn mở và nhạc do opening.js quản lý; app.js chỉ lo nội dung thiệp.
  let isOpen = false;
  let toastTimer;

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("is-visible"), 4200);
  }

  function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  // Text is assigned as textContent, including the optional guest name in the URL.
  $$("[data-text]").forEach(element => {
    if (typeof config[element.dataset.text] === "string") element.textContent = config[element.dataset.text];
  });
  const formattedDates = calendarDate ? {
    long: `${dateParts[2]} tháng ${dateParts[1]}, ${dateParts[0]}`,
    weekday: new Intl.DateTimeFormat("vi-VN", { ...dateOptions, weekday: "long" }).format(calendarDate),
    day: String(dateParts[2]).padStart(2, "0"),
    month: `Tháng ${String(dateParts[1]).padStart(2, "0")}`,
    year: String(dateParts[0]),
  } : { long: "Ngày cưới sẽ thông báo sau", weekday: "Sẽ thông báo", day: "—", month: "—", year: "—" };
  $$("[data-date]").forEach(element => { element.textContent = formattedDates[element.dataset.date]; });
  document.title = `${config.groom} & ${config.bride} — Thiệp cưới`;
  const params = new URLSearchParams(location.search);
  $("#guest-name").textContent = (params.get("guest") || "").slice(0, 100);
  $$('[data-map-address]').forEach(link => {
    const address = String(config[link.dataset.mapAddress] || "").trim();
    link.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    link.setAttribute("aria-label", `Chỉ đường tới ${link.dataset.mapLabel}: ${address}`);
  });

  // Tự cuộn nhẹ sau khi mở thiệp. Khách chạm/cuộn/gõ phím thì dừng, để yên vài giây thì cuộn tiếp.
  const autoScroll = { speed: 140 / 3, resumeDelay: 6000, pausedUntil: 0, position: 0, last: 0, running: false };
  function pauseAutoScroll() { autoScroll.pausedUntil = performance.now() + autoScroll.resumeDelay; }
  for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) window.addEventListener(type, pauseAutoScroll, { passive: true });
  function autoScrollStep(now) {
    const elapsed = autoScroll.last ? Math.min(now - autoScroll.last, 100) : 0;
    autoScroll.last = now;
    const maxY = document.documentElement.scrollHeight - innerHeight;
    // Khách tự kéo thanh cuộn hoặc bấm "về đầu trang": tiếp tục từ vị trí mới.
    if (Math.abs(window.scrollY - autoScroll.position) > 2) autoScroll.position = window.scrollY;
    const busy = document.hidden || $("dialog[open]") || document.activeElement?.matches("input, textarea, select");
    if (now >= autoScroll.pausedUntil && !busy && autoScroll.position < maxY - 1) {
      autoScroll.position = Math.min(maxY, autoScroll.position + autoScroll.speed * elapsed / 1000);
      window.scrollTo({ top: autoScroll.position, behavior: "instant" });
    }
    requestAnimationFrame(autoScrollStep);
  }
  function startAutoScroll() {
    if (autoScroll.running || reducedMotion.matches) return;
    autoScroll.running = true;
    autoScroll.position = window.scrollY;
    autoScroll.pausedUntil = performance.now() + 500;
    requestAnimationFrame(autoScrollStep);
  }

  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && isOpen) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    }
  }, { threshold: 0.06, rootMargin: "0px 0px -20px 0px" });

  // opening.js phát sự kiện này sau khi mở xong; app.js bật nội dung và hiệu ứng cuộn hiện.
  function activateInvitation() {
    if (isOpen) return;
    isOpen = true;
    document.body.classList.add("motion-ready");
    $$(".reveal").forEach(element => revealObserver.observe(element));
    startAutoScroll();
  }
  document.addEventListener("invitation:opened", activateInvitation);
  // Khi vào bằng ?open=1, opening.js mở ngay lúc tải (trước app.js), nên kích hoạt trực tiếp.
  if (params.get("open") === "1") activateInvitation();

  // The carousel uses the same perspective and 60% / 45 degree card steps as the sample.
  const cards = $$(".photo-card");
  const dots = [];
  let activePhoto = 0;
  let albumVisible = false;
  let albumHovered = false;
  let lastInteraction = 0;
  let skipPhotoClick = false;
  cards.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "album-dot";
    dot.setAttribute("aria-label", `Chuyển đến ảnh ${index + 1}`);
    dot.addEventListener("click", () => selectPhoto(index));
    $("#album-dots").append(dot);
    dots.push(dot);
  });

  function selectPhoto(index, userAction = true) {
    activePhoto = (index + cards.length) % cards.length;
    if (userAction) lastInteraction = Date.now();
    cards.forEach((card, i) => {
      let offset = (i - activePhoto + cards.length) % cards.length;
      if (offset > Math.floor(cards.length / 2)) offset -= cards.length;
      const distance = Math.abs(offset);
      card.style.transform = `translateX(${offset * 60}%) translateZ(${-distance * 150}px) rotateY(${offset * 45}deg) scale(${Math.max(.7, 1 - distance * .15)})`;
      card.style.opacity = String(Math.max(.3, 1 - distance * .25));
      card.style.zIndex = String(100 - distance);
      card.classList.toggle("is-active", distance === 0);
      card.tabIndex = distance === 0 ? 0 : -1;
      dots[i].classList.toggle("is-active", distance === 0);
      dots[i].setAttribute("aria-current", distance === 0 ? "true" : "false");
    });
  }
  selectPhoto(0, false);
  // Mỗi thẻ lấy tỉ lệ khung theo ảnh thật (kẹp 0.5–1.2) như web gốc; mặc định 2/3.
  // Khi chưa có ảnh (để phôi), dựng thẻ phôi đánh số + tỉ lệ & sắc độ khác nhau để thấy rõ hiệu ứng xoè.
  const placeholderAspects = [0.67, 1.12, 0.6, 0.78, 1.1, 0.64, 0.9];
  const placeholderHues = [350, 28, 14, 42, 344, 20, 8];
  cards.forEach((card, index) => {
    const image = $("img", card);
    const applyAspect = () => {
      if (image.naturalWidth && image.naturalHeight) {
        card.style.aspectRatio = String(Math.min(1.2, Math.max(.5, image.naturalWidth / image.naturalHeight)));
      }
    };
    const makePlaceholder = () => {
      card.classList.add("is-placeholder");
      card.style.aspectRatio = String(placeholderAspects[index % placeholderAspects.length]);
      card.style.setProperty("--ph-hue", String(placeholderHues[index % placeholderHues.length]));
      image.style.display = "none";
      if (!card.querySelector(".photo-placeholder")) {
        const ph = document.createElement("span");
        ph.className = "photo-placeholder";
        ph.innerHTML = `<b>${index + 1}</b><small>Ảnh cưới</small>`;
        card.append(ph);
      }
    };
    if (image.complete) { image.naturalWidth ? applyAspect() : makePlaceholder(); }
    else { image.addEventListener("load", applyAspect); image.addEventListener("error", makePlaceholder); }
  });
  $(".album-prev").addEventListener("click", () => selectPhoto(activePhoto - 1));
  $(".album-next").addEventListener("click", () => selectPhoto(activePhoto + 1));
  cards.forEach((card, index) => card.addEventListener("click", () => {
    if (skipPhotoClick) return;
    if (index === activePhoto) { openDialog($("#lightbox")); updateLightbox(); }
    else selectPhoto(index);
  }));
  $("#album").addEventListener("keydown", event => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      selectPhoto(activePhoto + (event.key === "ArrowRight" ? 1 : -1));
      cards[activePhoto].focus({ preventScroll: true });
    }
  });
  $("#album").addEventListener("mouseenter", () => { albumHovered = true; });
  $("#album").addEventListener("mouseleave", () => { albumHovered = false; });
  new IntersectionObserver(entries => { albumVisible = entries[0].isIntersecting; }, { threshold: .3 }).observe($("#album"));
  setInterval(() => {
    if (isOpen && albumVisible && !albumHovered && !document.hidden && !$("dialog[open]") && !$("#album").contains(document.activeElement) && !reducedMotion.matches && Date.now() - lastInteraction > 5000) selectPhoto(activePhoto + 1, false);
  }, 4500);

  function addSwipe(element, handler) {
    let start;
    element.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button !== 0) return;
      start = { x: event.clientX, y: event.clientY };
      skipPhotoClick = false;
    });
    element.addEventListener("pointerup", event => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        skipPhotoClick = true;
        handler(dx < 0 ? 1 : -1);
        setTimeout(() => { skipPhotoClick = false; }, 100);
      }
    });
    element.addEventListener("pointercancel", () => { start = null; });
    element.addEventListener("dragstart", event => event.preventDefault());
  }
  addSwipe($("#photo-stage"), direction => selectPhoto(activePhoto + direction));

  function openDialog(dialog) {
    dialog.showModal();
    document.body.classList.add("has-dialog");
  }
  $$("[data-dialog]").forEach(button => button.addEventListener("click", () => openDialog(document.getElementById(button.dataset.dialog))));
  $$("dialog").forEach(dialog => {
    $("[data-close]", dialog).addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => document.body.classList.remove("has-dialog"));
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (dialog.classList.contains("lightbox") || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });
  function updateLightbox() {
    const source = $("img", cards[activePhoto]);
    $("#lightbox-image").src = source.src;
    $("#lightbox-image").alt = source.alt;
    $("#lightbox-counter").textContent = `${activePhoto + 1} / ${cards.length}`;
  }
  function moveLightbox(direction) { selectPhoto(activePhoto + direction); updateLightbox(); }
  $(".lightbox-prev").addEventListener("click", () => moveLightbox(-1));
  $(".lightbox-next").addEventListener("click", () => moveLightbox(1));
  $("#lightbox").addEventListener("keydown", event => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault(); moveLightbox(event.key === "ArrowRight" ? 1 : -1);
    }
  });
  addSwipe($("#lightbox-image"), moveLightbox);

  // Calendar and countdown use an explicit Vietnam timezone.
  if (calendarDate) {
    $("#calendar-title").textContent = `Tháng ${dateParts[1]} / ${dateParts[0]}`;
    const firstDay = (new Date(Date.UTC(dateParts[0], dateParts[1] - 1, 1)).getUTCDay() + 6) % 7;
    const monthLength = new Date(Date.UTC(dateParts[0], dateParts[1], 0)).getUTCDate();
    for (let i = 0; i < firstDay + monthLength; i++) {
      const cell = document.createElement("span");
      const day = i - firstDay + 1;
      if (day > 0) cell.textContent = day;
      else cell.setAttribute("aria-hidden", "true");
      if (day === dateParts[2]) { cell.className = "wedding-day"; cell.setAttribute("aria-label", `${day}, ngày cưới`); }
      $("#calendar-days").append(cell);
    }
  } else {
    $(".calendar").hidden = true;
  }
  (weddingDate ? ["Ngày", "Giờ", "Phút", "Giây"] : []).forEach(label => {
    const unit = document.createElement("div");
    unit.innerHTML = `<strong>00</strong><small>${label}</small>`;
    $("#countdown").append(unit);
  });
  if (!weddingDate) {
    const message = document.createElement("p");
    message.textContent = "Ngày giờ sẽ được thông báo sau";
    $("#countdown").append(message);
  }
  $("#add-calendar").hidden = !weddingDate;
  function updateCountdown() {
    if (!weddingDate) return;
    const total = Math.max(0, Math.floor((weddingDate.getTime() - Date.now()) / 1000));
    const units = [Math.floor(total / 86400), Math.floor(total / 3600) % 24, Math.floor(total / 60) % 60, total % 60];
    $$("#countdown strong").forEach((element, index) => { element.textContent = String(units[index]).padStart(2, "0"); });
    if (total === 0) $("#countdown").setAttribute("aria-label", "Ngày cưới đã diễn ra");
  }
  updateCountdown();
  if (weddingDate && weddingDate > new Date()) setInterval(updateCountdown, 1000);

  $("#add-calendar").addEventListener("click", () => {
    if (!weddingDate) return;
    const formatDate = date => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escape = value => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, "\\$&");
    const venues = [config.groomVenue, config.brideVenue].filter(Boolean).join(" / ");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WeddingLetter//VI", "BEGIN:VEVENT", `UID:${config.date}-wedding@weddingletter.local`, `DTSTAMP:${formatDate(new Date())}`, `DTSTART:${formatDate(weddingDate)}`, `DTEND:${formatDate(new Date(weddingDate.getTime() + 3 * 3600000))}`, `SUMMARY:${escape(`Đám cưới ${config.groom} & ${config.bride}`)}`, `LOCATION:${escape(venues)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "lich-cuoi.ics"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // Câu gợi ý cho nút 🪄, không hiển thị như lời chúc.
  const wishSuggestions = [
    "Chúc mừng ngày vui của hai bạn, trăm năm hạnh phúc bền lâu!",
    "Đẹp đôi quá! Chúc hai bạn sống bên nhau đầu bạc răng long.",
    "Mừng hạnh phúc hai bạn! Chúc gia đình nhỏ luôn đầy ắp tiếng cười.",
    "Chúc cô dâu chú rể luôn giữ được nụ cười này mãi mãi nhé!",
    "Nhìn thiệp là thấy tình yêu rồi. Chúc hai bạn trăm năm viên mãn!",
    "Chúc đám cưới thật trọn vẹn và ấm áp. Hạnh phúc nhé hai bạn!",
    "Cuối cùng cũng tới ngày trọng đại, chúc mừng cặp đôi xứng lứa vừa đôi!",
    "Chúc hai bạn mãi mãi yêu thương và bên nhau trọn đời!",
  ];
  function wishElement(wish) {
    const article = document.createElement("article");
    article.className = "wish";
    const top = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = wish.name;
    const time = document.createElement("time");
    time.textContent = new Date(wish.date).toLocaleDateString("vi-VN", dateOptions);
    time.dateTime = wish.date;
    const message = document.createElement("p");
    message.textContent = wish.message;
    top.append(name, time); article.append(top, message);
    return article;
  }
  function showWishesNote(text) {
    const note = document.createElement("p");
    note.className = "wishes-note";
    note.textContent = text;
    $("#wishes").replaceChildren(note);
  }
  // Lời chúc lưu chung trên máy chủ (api/wishes.js) nên mọi khách đều thấy.
  async function loadWishes() {
    try {
      const response = await fetch("/api/wishes", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { wishes } = await response.json();
      if (!wishes.length) { showWishesNote("Chưa có lời chúc nào. Hãy là người đầu tiên gửi lời chúc nhé!"); return; }
      $("#wishes").replaceChildren(...wishes.map(wishElement));
    } catch {
      showWishesNote("Chưa tải được lời chúc. Bạn tải lại trang thử nhé.");
    }
  }
  loadWishes();
  $("#wish-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.target;
    const name = $("#wish-name").value.trim();
    const message = $("#wish-message").value.trim();
    if (!name || !message) { toast("Bạn điền tên và lời chúc nhé."); return; }
    const submit = $("button[type=submit]", form);
    submit.disabled = true;
    try {
      const response = await fetch("/api/wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, website: form.elements.website.value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { toast(data.error || "Chưa gửi được lời chúc, bạn thử lại nhé."); return; }
      if (data.wish) {
        $(".wishes-note", $("#wishes"))?.remove();
        const article = wishElement(data.wish); article.classList.add("wish-new");
        $("#wishes").prepend(article); $("#wishes").scrollTop = 0;
      }
      form.reset();
      toast("Đã gửi lời chúc. Cảm ơn bạn!");
    } catch {
      toast("Chưa gửi được lời chúc. Bạn kiểm tra mạng rồi thử lại nhé.");
    } finally {
      submit.disabled = false;
    }
  });
  let suggestion = 0;
  $("#suggest-wish").addEventListener("click", () => {
    $("#wish-message").value = wishSuggestions[suggestion++ % wishSuggestions.length];
    $("#wish-message").focus();
  });

  $("#rsvp-attendance").addEventListener("change", event => {
    const attending = event.target.value === "yes";
    $("#guest-count-field").hidden = !attending;
    $("#rsvp-count").disabled = !attending;
  });
  const savedRsvp = readStorage(`${storageKey}-rsvp`, null);
  if (savedRsvp && typeof savedRsvp.name === "string") $("#rsvp-name").value = savedRsvp.name;
  $("#rsvp-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.target);
    const name = String(data.get("name")).trim();
    if (!name) { toast("Bạn điền tên trước khi xác nhận nhé."); return; }
    const attending = data.get("attendance") === "yes";
    const saved = writeStorage(`${storageKey}-rsvp`, { name, attending, count: attending ? Number(data.get("count")) : 0, date: new Date().toISOString() });
    if (!saved) { toast("Trình duyệt chưa cho phép lưu xác nhận. Bạn thử lại nhé."); return; }
    $("#rsvp-dialog").close();
    toast("Đã lưu xác nhận trên thiết bị của bạn. Cảm ơn bạn!");
  });

  if (!config.giftAccounts.length) {
    $("#gift-accounts").innerHTML = '<div class="gift-empty"><span aria-hidden="true">❦</span><p>Thông tin mừng cưới sẽ được cô dâu chú rể cập nhật sau.</p></div>';
  } else {
    config.giftAccounts.forEach(account => {
      const card = document.createElement("div"); card.className = "gift-account";
      const title = document.createElement("h3"); title.textContent = account.label;
      card.append(title);
      [account.bank, account.name, account.number].forEach(text => { const line = document.createElement("p"); line.textContent = text; card.append(line); });
      if (account.qr) { const img = document.createElement("img"); img.src = account.qr; img.alt = `Mã QR ${account.label}`; card.append(img); }
      const copy = document.createElement("button"); copy.type = "button"; copy.textContent = "Sao chép số tài khoản";
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(account.number); toast("Đã sao chép số tài khoản."); }
        catch { toast(`Số tài khoản: ${account.number}`); }
      });
      card.append(copy); $("#gift-accounts").append(card);
    });
  }
  $("#back-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "instant" : "smooth" }));
  window.addEventListener("scroll", () => { $("#back-top").hidden = window.scrollY < 600; }, { passive: true });
})();
