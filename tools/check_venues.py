"""Focused browser check for the two wedding venue cards."""
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
        section = page.locator(".venue-section")
        section.scroll_into_view_if_needed()
        page.evaluate("document.querySelector('.venue-section').classList.add('is-visible')")

        expect(page.locator(".venue-card")).to_have_count(2)
        expect(page.locator(".venue-card").nth(0)).to_contain_text("Nhà trai")
        expect(page.locator(".venue-card").nth(1)).to_contain_text("Nhà gái")
        expect(page.locator("[data-map-address]")).to_have_count(2)
        assert page.locator("[data-map-address]").evaluate_all(
            "links => links.every(link => link.href.startsWith('https://www.google.com/maps/search/?api=1&query='))"
        )
        expect(page.locator(".dresscode")).to_have_count(0)
        actual_columns = page.locator(".venue-list").evaluate(
            "list => getComputedStyle(list).gridTemplateColumns"
        )
        if name == "mobile":
            assert " " not in actual_columns
        else:
            assert len(actual_columns.split()) == 2
        section.screenshot(path=str(OUTPUT / f"venues-{name}.png"))
        assert not errors, errors
        page.close()
    browser.close()

print("PASS two venue cards, map links, responsive layout, and no dress code")
