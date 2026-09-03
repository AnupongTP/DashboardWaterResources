from playwright.sync_api import sync_playwright
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:4173/index.html'
DATA = json.loads((ROOT / 'site/data/waterresources.initial.json').read_text(encoding='utf-8'))
VERSION = 'playwright-round3-map-stretch-v1'


def install_api_fixture(page):
    version_payload = json.dumps({
        'version': VERSION,
        'updatedAt': '2026-09-03T00:00:00Z',
        'count': len(DATA),
    }, ensure_ascii=False)
    data_payload = json.dumps({
        'version': VERSION,
        'updatedAt': '2026-09-03T00:00:00Z',
        'data': DATA,
    }, ensure_ascii=False)
    page.route('**/api/waterresources/version', lambda route: route.fulfill(
        status=200, content_type='application/json; charset=utf-8', body=version_payload
    ))
    page.route('**/api/waterresources', lambda route: route.fulfill(
        status=200, content_type='application/json; charset=utf-8', body=data_payload
    ))


def wait_ready(page):
    page.goto(BASE, wait_until='domcontentloaded', timeout=60000)
    page.wait_for_function("() => window.AreaResponsibility && document.querySelector('#execKpi .kpi-card')", timeout=30000)
    page.wait_for_selector('#heroMapStage .leaflet-container', timeout=30000)
    page.wait_for_timeout(250)


def desktop_metrics(page):
    return page.evaluate("""() => {
      const left=document.querySelector('.exec-hero-cards').getBoundingClientRect();
      const card=document.querySelector('.exec-hero-map').getBoundingClientRect();
      const stage=document.querySelector('#heroMapStage').getBoundingClientRect();
      const map=document.querySelector('#map').getBoundingClientRect();
      const hero=document.querySelector('.exec-hero').getBoundingClientRect();
      return {
        leftHeight:left.height,
        cardHeight:card.height,
        stageHeight:stage.height,
        mapHeight:map.height,
        heroHeight:hero.height,
        alignSelf:getComputedStyle(document.querySelector('.exec-hero-map')).alignSelf,
        observer:!!window.__heroMapResizeObserver,
        mapSize: window.map && window.map.getSize ? [window.map.getSize().x, window.map.getSize().y] : null
      };
    }""")


def test_desktop(browser):
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    install_api_fixture(page)
    wait_ready(page)

    m = desktop_metrics(page)
    assert m['alignSelf'] == 'stretch', m
    assert m['observer'] is True, m
    # Map card and KPI column share the same flex-row height on desktop.
    assert abs(m['cardHeight'] - m['leftHeight']) <= 3, m
    assert abs(m['heroHeight'] - max(m['cardHeight'], m['leftHeight'])) <= 3, m
    # The map itself must consume the newly available vertical space.
    assert m['stageHeight'] > 430, m
    assert m['mapHeight'] > 430, m

    # If the Top-10 list is expandable, opening it must stretch the map again and
    # Leaflet must recompute its internal pixel size rather than leaving blank tiles.
    toggle = page.locator('#kpiDetail .kpi-detail-toggle')
    if toggle.count():
        before = m
        toggle.click()
        page.wait_for_timeout(260)
        expanded = desktop_metrics(page)
        assert expanded['leftHeight'] > before['leftHeight'] + 20, (before, expanded)
        assert abs(expanded['cardHeight'] - expanded['leftHeight']) <= 3, expanded
        assert expanded['mapHeight'] > before['mapHeight'] + 20, (before, expanded)
        if expanded['mapSize']:
            assert abs(expanded['mapSize'][1] - expanded['mapHeight']) <= 3, expanded

        page.locator('#kpiDetail .kpi-detail-toggle').click()
        page.wait_for_timeout(260)
        collapsed = desktop_metrics(page)
        assert abs(collapsed['cardHeight'] - collapsed['leftHeight']) <= 3, collapsed
        assert collapsed['mapHeight'] < expanded['mapHeight'] - 20, (expanded, collapsed)

    if errors:
        raise AssertionError('Desktop JavaScript page errors: ' + ' | '.join(errors))
    page.close()


def test_mobile(browser, width):
    page = browser.new_page(viewport={'width': width, 'height': 900}, is_mobile=True)
    errors = []
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    install_api_fixture(page)
    wait_ready(page)
    m = page.evaluate("""() => {
      const card=document.querySelector('.exec-hero-map').getBoundingClientRect();
      const stage=document.querySelector('#heroMapStage').getBoundingClientRect();
      const map=document.querySelector('#map').getBoundingClientRect();
      return {
        viewport:innerWidth,
        cardLeft:card.left,
        cardRight:card.right,
        stageHeight:stage.height,
        mapHeight:map.height,
        alignSelf:getComputedStyle(document.querySelector('.exec-hero-map')).alignSelf
      };
    }""")
    # Desktop stretch rule must not leak into the single-column mobile layout.
    assert m['alignSelf'] != 'stretch', (width, m)
    assert m['cardLeft'] >= -1 and m['cardRight'] <= width + 1, (width, m)
    assert 325 <= m['stageHeight'] <= 430, (width, m)
    assert 325 <= m['mapHeight'] <= 430, (width, m)
    if errors:
        raise AssertionError(f'{width}px JavaScript page errors: ' + ' | '.join(errors))
    page.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            test_desktop(browser)
            for width in (360, 390, 412):
                test_mobile(browser, width)
        finally:
            browser.close()
    print('PASS round3_map_stretch_playwright desktop + mobile 360/390/412')


if __name__ == '__main__':
    main()
