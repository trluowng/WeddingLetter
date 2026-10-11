"""Verify real audio playback and recovery from blocked autoplay."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
URL = os.environ.get("WEDDING_TEST_URL", "http://127.0.0.1:5173")
OUTPUT = Path(__file__).resolve().parents[1] / ".preview"
OUTPUT.mkdir(exist_ok=True)

def expect_playing(page):
    page.wait_for_function("""() => {
        const audio = document.querySelector('#wedding-audio');
        return !audio.paused && !audio.muted && audio.volume > 0 && audio.currentTime > .2 && !audio.error;
    }""")
    expect(page.locator("#music-toggle")).to_have_attribute("aria-pressed", "true")
    expect(page.locator("#music-hint")).to_be_hidden()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--autoplay-policy=user-gesture-required"])
    for label, options in [
        ("desktop", {"viewport": {"width": 1440, "height": 1000}}),
        ("mobile", {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True}),
    ]:
        context = browser.new_context(**options)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(URL, wait_until="networkidle")
        assert page.locator(".rose-petal").count() == 28
        assert page.locator(".ambient-heart").count() == 0
        assert page.locator(".rose-petal").first.evaluate("e=>getComputedStyle(e).animationName") == "rose-petal-fall"
        page.wait_for_function("document.querySelector('#wedding-audio').readyState >= 2")
        assert page.locator("#wedding-audio").evaluate("a=>a.paused")
        page.locator("#open-invitation").click()
        expect(page.locator("#opening")).to_have_class("opening is-unsealing")
        assert page.locator(".burst-particle").count() == 32
        page.wait_for_function("document.querySelector('#opening-chime').currentTime > .1")
        assert page.locator(".opening-core").evaluate("e=>getComputedStyle(e).animationName") == "heart-unlock"
        page.wait_for_timeout(350)
        page.screenshot(path=str(OUTPUT / f"opening-effect-{label}.png"))
        expect_playing(page)
        expect(page.locator("#opening")).to_be_hidden()
        assert page.locator(".burst-particle").count() == 0
        assert "open=1" not in page.url
        page.locator("#music-toggle").click()
        page.locator(".save-the-date").click()
        assert page.locator("#wedding-audio").evaluate("a=>a.paused")
        page.locator("#music-toggle").click()
        expect_playing(page)
        print(f"PASS {label}: preloaded, opening starts audible playback, pause remains paused, resume", flush=True)
        page.reload(wait_until="networkidle")
        expect(page.locator("#opening")).to_be_visible()
        assert page.locator("#wedding-audio").evaluate("a=>a.paused")
        print(f"PASS {label}: heart burst and opening chime, transition cleanup, reload shows the cover", flush=True)
        assert not errors, errors
        context.close()

    context = browser.new_context()
    # Force the policy rejection deterministically, while still using the real decoder after a gesture.
    context.add_init_script("""{
      const originalPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (!navigator.userActivation.isActive) return Promise.reject(new DOMException('Gesture required', 'NotAllowedError'));
        return originalPlay.call(this);
      };
    }""")
    page = context.new_page()
    for action in ["#music-toggle", ".save-the-date"]:
        page.goto(URL + "/?open=1", wait_until="networkidle")
        expect(page.locator("#opening")).to_be_hidden()
        expect(page.locator("#music-hint")).to_be_visible()
        page.locator(action).click()
        expect_playing(page)
        page.locator("#music-toggle").click()
        page.locator(".save-the-date").click()
        assert page.locator("#wedding-audio").evaluate("a=>a.paused")
        print(f"PASS direct/reloaded invitation: blocked autoplay retries via {action}, respects pause", flush=True)

    # Check decoded signal, not merely the media element's paused flag.
    signal = page.evaluate("""async () => {
      const context = new AudioContext();
      const bytes = await (await fetch('assets/audio/wedding.mp3')).arrayBuffer();
      const buffer = await context.decodeAudioData(bytes);
      const data = buffer.getChannelData(0);
      const peak = data.slice(0, buffer.sampleRate * 2).reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
      await context.close();
      return { seconds: buffer.duration, firstTwoSecondsPeak: peak };
    }""")
    assert signal["seconds"] > 10 and signal["firstTwoSecondsPeak"] > .005, signal
    print("PASS decoded music has a non-silent intro:", signal, flush=True)
    context.close()

    # Optional page features can fail without breaking the opening or sound.
    context = browser.new_context()
    context.route("**/app.js*", lambda route: route.fulfill(status=200, content_type="text/javascript", body="throw new Error('Simulated optional content failure');"))
    page = context.new_page()
    page.goto(URL, wait_until="networkidle")
    page.locator("#open-invitation").click()
    expect_playing(page)
    expect(page.locator("#opening")).to_be_hidden()
    assert not page.locator("#wedding").evaluate("el=>el.inert")
    print("PASS opening and music survive an unrelated content script error", flush=True)
    context.close()

    context = browser.new_context(reduced_motion="reduce")
    page = context.new_page()
    page.goto(URL, wait_until="networkidle")
    page.locator("#open-invitation").click()
    expect(page.locator("#opening")).to_be_hidden()
    assert page.locator(".burst-particle").count() == 0
    expect_playing(page)
    print("PASS reduced motion retains music and opens without particles", flush=True)
    context.close()

    context = browser.new_context()
    page = context.new_page()
    page.goto((Path(__file__).resolve().parents[1] / "index.html").as_uri(), wait_until="load")
    page.locator("#open-invitation").click()
    expect_playing(page)
    print("PASS opening index.html directly also plays music", flush=True)
    browser.close()
