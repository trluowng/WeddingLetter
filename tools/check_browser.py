"""Browser smoke check. Requires Python Playwright and a running local server."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / ".preview"
OUTPUT.mkdir(exist_ok=True)
URL = "http://127.0.0.1:5173"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    page = context.new_page()
    errors = []
    failed = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda response: failed.append(f"{response.status} {response.url}") if response.status >= 400 else None)
    response = page.goto(URL, wait_until="networkidle")
    assert response.status == 200
    page.evaluate("document.fonts.ready")
    page.screenshot(path=str(OUTPUT / "desktop-cover.png"))
    expect(page.locator("#opening")).to_be_visible()
    assert page.locator("#wedding").evaluate("el => el.inert")
    page.get_by_role("button", name="Mở thiệp", exact=True).click()
    expect(page.locator("#opening")).to_be_hidden()
    assert not page.locator("#wedding").evaluate("el => el.inert")
    page.wait_for_function("!document.querySelector('#wedding-audio').paused")
    page.locator("#music-toggle").click()
    assert page.locator("#wedding-audio").evaluate("el => el.paused")
    page.screenshot(path=str(OUTPUT / "desktop-top.png"))

    page.locator("#album").scroll_into_view_if_needed()
    page.locator(".album-next").click()
    assert page.locator(".photo-card.is-active").get_attribute("data-photo") == "1"
    page.wait_for_timeout(1200)
    page.locator(".photo-card.is-active").click()
    expect(page.locator("#lightbox")).to_be_visible()
    page.keyboard.press("ArrowRight")
    expect(page.locator("#lightbox-counter")).to_have_text("3 / 7")
    page.keyboard.press("Escape")
    expect(page.locator("#lightbox")).to_be_hidden()

    with page.expect_download() as download_info:
        page.locator("#add-calendar").click()
    download = download_info.value
    calendar = Path(download.path()).read_text(encoding="utf-8")
    assert "DTSTART:20260103T110000Z" in calendar
    assert "BEGIN:VCALENDAR" in calendar

    page.locator('[data-dialog="rsvp-dialog"]').click()
    page.locator("#rsvp-name").fill("Khách kiểm tra")
    page.locator("#rsvp-count").fill("2")
    page.locator("#rsvp-form button[type=submit]").click()
    expect(page.locator("#rsvp-dialog")).to_be_hidden()
    saved = page.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.endsWith('-rsvp'))))")
    assert saved["name"] == "Khách kiểm tra" and saved["count"] == 2

    page.locator("#wish-name").fill("Khách kiểm tra")
    page.locator("#wish-message").fill('<img src=x onerror="alert(1)"> Chúc hai bạn hạnh phúc!')
    page.locator("#wish-form button[type=submit]").click()
    expect(page.locator("#wishes .wish").first).to_contain_text("Khách kiểm tra")
    assert page.locator("#wishes .wish").first.locator("img").count() == 0
    page.reload(wait_until="networkidle")
    page.locator("#open-invitation").click()
    expect(page.locator("#opening")).to_be_hidden()
    expect(page.locator("#wishes .wish").first).to_contain_text("Khách kiểm tra")
    page.locator('[data-dialog="gift-dialog"]').click()
    expect(page.locator("#gift-dialog")).to_be_visible()
    page.keyboard.press("Escape")

    page.evaluate("localStorage.clear()")
    for width, height in [(1440, 1000), (768, 1024), (390, 844), (320, 740)]:
        page.set_viewport_size({"width": width, "height": height})
        page.goto(URL + "/?open=1", wait_until="networkidle")
        page.evaluate("document.querySelectorAll('.reveal').forEach(e=>e.classList.add('is-visible'))")
        for y in range(0, page.evaluate("document.body.scrollHeight"), 600):
            page.evaluate("y => window.scrollTo(0,y)", y)
            page.wait_for_timeout(40)
        page.wait_for_timeout(700)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Overflow at {width}"
        broken = page.locator("#wedding img").evaluate_all("els=>els.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src)")
        assert not broken, broken
        page.evaluate("window.scrollTo(0,0)")
        page.screenshot(path=str(OUTPUT / f"page-{width}.png"), full_page=True)
        print(f"PASS responsive {width}px, all images loaded", flush=True)

    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(URL, wait_until="networkidle")
    page.screenshot(path=str(OUTPUT / "mobile-cover.png"))
    page.get_by_role("button", name="Mở thiệp", exact=True).click()
    expect(page.locator("#opening")).to_be_hidden()
    page.locator("#album").scroll_into_view_if_needed()
    page.wait_for_timeout(1000)
    stage = page.locator("#photo-stage").bounding_box()
    x, y = stage["x"] + stage["width"] * .65, stage["y"] + stage["height"] * .5
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x - 100, y, steps=10)
    page.mouse.up()
    assert page.locator(".photo-card.is-active").get_attribute("data-photo") == "1"
    print("PASS opening, audio, carousel, swipe, lightbox, calendar, RSVP, wishes, persistence, gift modal", flush=True)
    assert not errors, errors
    assert not failed, failed
    print("PASS no browser errors or missing assets", flush=True)
    context.close()

    reduced = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    page = reduced.new_page()
    page.goto(URL, wait_until="networkidle")
    assert page.locator(".rose-petal").count() == 0
    page.get_by_role("button", name="Mở thiệp", exact=True).click()
    expect(page.locator("#opening")).to_be_hidden()
    assert page.locator(".hero-photo-float").evaluate("e => getComputedStyle(e).animationName") == "none"
    print("PASS reduced motion", flush=True)
    browser.close()
