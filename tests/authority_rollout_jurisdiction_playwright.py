"""Independent expected IDs for legacy, overlap, multi-Tambon and zero-data routes."""
import copy
import json

from playwright.sync_api import sync_playwright

from authority_locked_playwright import BASE, CHROME, by_slug, install_routes, ready, record
from playwright_dashboard_test import SYNTHETIC


IDS = {30001, 30002, 30003, 30004, 30005, 30025, 30026, 30027,
       30029, 30030, 30031, 30032, 30035}
DATA = [copy.deepcopy(row) for row in SYNTHETIC if row['id'] in IDS]
MAEKA = by_slug['tt-mae-ka']
DATA.append(record(31001, 'MAEKA-LEGACY', None, 'แม่กา', 1))
next(row for row in DATA if row['id'] == 30027).update(lat=None, lng=None)

# Explicit expectations are drawn from the master-jurisdiction boundary cases in
# playwright_dashboard_test.py, not from the Authority adapter under test.
EXPECTED = {
    'tt-mae-ka': {31001},
    'tm-dok-kham-tai': {30001, 30002, 30003, 30025, 30027, 30030, 30032},
    'obt-dok-kham-tai': {30004, 30026, 30031},
    'obt-khue-wiang': set(),
}
EXCLUDED = {30005, 30029, 30035}


def displayed_ids(page):
    return {int(value) for value in page.locator('#tblBody tr[data-id]').evaluate_all(
        'rows => rows.map(row => row.dataset.id)')}


def marker_count(page):
    return page.evaluate('window.__SCOPED_MAP__.layer().getLayers().length')


def wait_ids(page, expected):
    # detail-tab filters apply after an input debounce; poll the rendered table instead of sleeping
    page.wait_for_function('exp => { const ids = [...document.querySelectorAll("#tblBody tr[data-id]")]'
                           '.map(r => Number(r.dataset.id)).sort().join(","); return ids === exp; }',
                           arg=','.join(str(i) for i in sorted(expected)), timeout=10000)


def main():
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        try:
            context = browser.new_context(viewport={'width': 1440, 'height': 900})
            install_routes(context, data=DATA)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            for slug, expected in EXPECTED.items():
                page.goto(BASE + '/authority/' + slug + '/', wait_until='domcontentloaded')
                ready(page, slug, len(expected))
                actual = displayed_ids(page)
                assert actual == expected, (slug, actual, expected)
                assert not (actual & EXCLUDED), (slug, actual)
                assert page.evaluate('window.__AUTHORITY_PAGE__.unresolved') >= len(EXCLUDED)
                assert page.locator('#visitorCounter').is_visible()
                if not expected:
                    assert page.locator('#authorityEmptyNotice').is_visible()
                    assert marker_count(page) == 0
                else:
                    assert page.locator('#authorityEmptyNotice').count() == 0
                results.append({'slug': slug, 'ids': sorted(actual)})

            page.goto(BASE + '/authority/tm-dok-kham-tai/')
            ready(page, 'tm-dok-kham-tai', 7)
            # Filters live in the detail tab (D2); the Moo dropdown was removed (D11) so Moo is covered by search.
            page.locator('.main-nav button[data-view="detail"]').click()
            assert page.locator('#fTambon').is_visible()
            assert not page.locator('#fMoo').is_visible()
            page.locator('#fTambon').fill('สว่างอารมณ์')
            page.locator('#fTambonListbox [role="option"]', has_text='สว่างอารมณ์').first.click()
            wait_ids(page, {30001})
            page.locator('#fTambon').fill('บุญเกิด')
            page.locator('#fTambonListbox [role="option"]', has_text='บุญเกิด').first.click()
            wait_ids(page, {30002})
            page.locator('#fTambonClear').click()
            page.locator('#searchBox').fill('ทม.ดอกคำใต้-สว่างอารมณ์')
            wait_ids(page, {30001})
            page.locator('#searchBox').fill('')
            wait_ids(page, EXPECTED['tm-dok-kham-tai'])
            # A confirmed record without coordinates still appears in the table
            # (highlighted), but creates no map marker.
            page.locator('.tab-btn[data-tab="table"]').click()
            page.locator('#tblBody tr[data-id="30027"]').click()
            assert page.locator('#tblBody tr.selected').get_attribute('data-id') == '30027'
            assert displayed_ids(page) == EXPECTED['tm-dok-kham-tai']
            assert marker_count(page) == 6
            results.append({'filters': 'multi-Tambon composite Moo, search, no-coordinate focus'})
            assert not errors, errors
            context.close()
        finally:
            browser.close()
    print(json.dumps({'ok': True, 'results': results}, ensure_ascii=False))


if __name__ == '__main__':
    main()
