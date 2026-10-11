"""Focused visual and interaction check for the wedding photo album."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / ".preview"
OUTPUT.mkdir(exist_ok=True)
URL = "http://127.0.0.1:5173/?open=1"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    for name, viewport in (
        ("mobile", {"width": 390, "height": 844}),
        ("desktop", {"width": 1440, "height": 1000}),
    ):
        page = browser.new_page(viewport=viewport)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        response = page.goto(URL, wait_until="networkidle")
        assert response and response.status == 200
        page.locator(".album-section").scroll_into_view_if_needed()
        page.evaluate("document.querySelector('.album-section').classList.add('is-visible')")

        cards = page.locator(".photo-card")
        expect(cards).to_have_count(7)
        assert cards.locator("img").evaluate_all(
            "images => images.every(image => image.complete && image.naturalWidth > 0)"
        )
        expect(page.locator(".album-dot")).to_have_count(7)
        expect(page.locator(".photo-card.is-active")).to_have_attribute("data-photo", "0")
        assert cards.locator("img").evaluate_all(
            "images => images.every(image => image.src.endsWith('/assets/images/photo-placeholder.svg'))"
        )

        transition = page.locator(".photo-card").first.evaluate(
            "card => getComputedStyle(card).transitionTimingFunction"
        )
        assert "cubic-bezier(0.4, 0, 0.2, 1)" in transition
        section_box = page.locator(".album-section").bounding_box()
        active_box = page.locator(".photo-card.is-active").bounding_box()
        if name == "desktop":
            assert abs(section_box["width"] - 898) < 1
            assert abs(active_box["width"] - 319.1) < 1
            assert abs(active_box["height"] - 478.4) < 1
            arrow = page.locator(".album-next")
            arrow_box = arrow.bounding_box()
            assert abs(arrow_box["width"] - 32) < 1 and abs(arrow_box["height"] - 32) < 1
            assert arrow.evaluate("button => getComputedStyle(button).zIndex") == "200"
        else:
            assert abs(section_box["width"] - 390) < 1
            assert abs(active_box["width"] - 208.6) < 1
            assert abs(active_box["height"] - 312.8) < 1
        page.locator(".album-section").screenshot(path=str(OUTPUT / f"album-{name}.png"))

        if name == "desktop":
            page.locator(".album-next").click()
        else:
            stage = page.locator("#photo-stage").bounding_box()
            x = stage["x"] + stage["width"] * 0.65
            y = stage["y"] + stage["height"] * 0.5
            page.mouse.move(x, y)
            page.mouse.down()
            page.mouse.move(x - 100, y, steps=10)
            page.mouse.up()

        expect(page.locator(".photo-card.is-active")).to_have_attribute("data-photo", "1")
        page.locator(".photo-card.is-active").click()
        expect(page.locator("#lightbox")).to_be_visible()
        expect(page.locator("#lightbox-counter")).to_have_text("2 / 7")
        page.keyboard.press("ArrowRight")
        expect(page.locator("#lightbox-counter")).to_have_text("3 / 7")
        page.keyboard.press("Escape")
        expect(page.locator("#lightbox")).to_be_hidden()
        assert not errors, errors
        page.close()

    browser.close()

print("PASS album images, 3D carousel, swipe, dots, and lightbox")
