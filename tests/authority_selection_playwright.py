"""Authority prototype: record selection must not change the filtered dataset."""
import json
import re
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

from authority_locked_playwright import BASE, CHROME, install_routes, ready, wait_kpi
from authority_maeka_prototype_playwright import fixture, IMAGE_ID, PNG


SHOTS = Path(tempfile.mkdtemp(prefix='authority-selection-'))
A, B, NO_COORD = 70002, 71001, 72001


def snapshot(page):
    # Scoped template: 8 executive KPI cards + the two executive charts replace the 5-KPI/3-chart layout.
    return page.evaluate('''() => ({
      kpis:[...document.querySelectorAll('#execKpi .kpi-card .kv')].map(el=>el.textContent),
      table:[...document.querySelectorAll('#tblBody tr[data-id]')].map(row=>row.dataset.id),
      charts:['c_status_pie','c_base_vol_type'].map(id=>{const chart=Chart.getChart(id);
        return {labels:[...chart.data.labels],values:[...chart.data.datasets[0].data]};})
    })''')


def selected(page, record_id):
    assert page.evaluate('state.focusId') == record_id
    assert page.locator('#tblBody tr.selected').count() == 1
    assert page.locator('#tblBody tr.selected').get_attribute('data-id') == str(record_id)
    assert page.locator('#map .leaflet-marker-icon.dss-selected').count() == (0 if record_id == NO_COORD else 1)


def overview(page, expected):
    page.wait_for_function('''() => !map._popup?.isOpen() &&
      document.querySelectorAll('#map .leaflet-popup').length === 0''')
    assert page.evaluate('state.focusId') is None
    assert page.locator('#tblBody tr.selected').count() == 0
    assert page.locator('#map .leaflet-marker-icon.dss-selected').count() == 0
    assert snapshot(page) == expected


def pick_row(page, record_id):
    page.locator('.main-nav button[data-view="detail"]').click()
    page.locator('.tab-btn[data-tab="table"]').click()
    page.locator(f'#tblBody tr[data-id="{record_id}"]').click()
    page.wait_for_function('() => document.getElementById("view-exec").classList.contains("active")')


def click_marker(page, record_id):
    # the map sits below the KPI cards now; a visitor scrolls to it before clicking, so lazy popup images load
    page.locator('#heroMapStage').scroll_into_view_if_needed()
    page.evaluate('''id => markerRefs[id].getElement().dispatchEvent(
      new MouseEvent('click',{bubbles:true,cancelable:true}))''', record_id)
    page.wait_for_function('id => state.focusId===id && map._popup?._source?.authorityRecordId===id',
                           arg=record_id)


def main():
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        try:
            for width, height in ((1440, 900), (768, 1024), (412, 915), (390, 844), (360, 800)):
                context = browser.new_context(viewport={'width': width, 'height': height},
                                              is_mobile=width < 500, has_touch=width < 500)
                install_routes(context, data=fixture())
                image_requests = []

                def image_route(route):
                    image_requests.append(route.request.url)
                    route.fulfill(status=200, content_type='image/png', body=PNG)

                context.route(re.compile(r'^https://(?:lh3\.googleusercontent\.com/d/|drive\.google\.com/(?:thumbnail|uc)\?)'), image_route)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(BASE + '/authority/tt-mae-ka/', wait_until='domcontentloaded')
                ready(page, 'tt-mae-ka', 3)
                initial = snapshot(page)
                assert initial['kpis'][0] == '3' and len(initial['table']) == 3
                if width in (1440, 390):
                    page.screenshot(path=str(SHOTS / f'overview-{width}.png'), full_page=True)

                # Marker A -> B must never replace aggregate panels with one row.
                popup_events = page.evaluate('''() => {
                  window.selectionPopupEvents=[];
                  map.on('popupclose', e=>window.selectionPopupEvents.push({kind:'close',
                    id:e.popup._source?.authorityRecordId,focus:state.focusId,
                    count:document.querySelector('#execKpi .kpi-card:first-child .kv').textContent}));
                  map.on('popupopen', e=>window.selectionPopupEvents.push({kind:'open',
                    id:e.popup._source?.authorityRecordId,focus:state.focusId}));
                  return true;
                }''')
                assert popup_events
                click_marker(page, A)
                selected(page, A)
                assert 'AUTH-tt-mae-ka' in page.locator('.leaflet-popup').first.text_content()
                assert snapshot(page) == initial
                if width == 1440:
                    page.screenshot(path=str(SHOTS / 'popup-a-1440.png'), full_page=True)
                click_marker(page, B)
                selected(page, B)
                page.wait_for_function('''() => document.querySelectorAll('.leaflet-popup').length === 1''')  # A fades out ~200ms
                assert 'MAEKA-DAMAGED' in page.locator('.leaflet-popup').first.text_content()
                assert 'AUTH-tt-mae-ka' not in page.locator('.leaflet-popup').first.text_content()
                assert snapshot(page) == initial
                events = page.evaluate('window.selectionPopupEvents')
                assert any(e['kind'] == 'close' and e['id'] == A for e in events), events
                assert any(e['kind'] == 'open' and e['id'] == B and e['focus'] == B for e in events), events
                assert not any(e['kind'] == 'close' and e['id'] == A and e['focus'] is None for e in events), events
                if width in (1440, 390):
                    page.screenshot(path=str(SHOTS / f'popup-b-{width}.png'), full_page=True)
                assert len(image_requests) == 1, image_requests
                assert page.locator('.leaflet-popup img[data-drive-id]').get_attribute('referrerpolicy') == 'no-referrer'
                page.evaluate('window.__SCOPED_MAP__.rebuild()')
                selected(page, B)
                page.wait_for_function('''() => document.querySelectorAll('.leaflet-popup').length === 1''')
                assert len(image_requests) == 1, image_requests
                click_marker(page, A)
                click_marker(page, B)
                page.evaluate('''id => markerRefs[id].getElement().dispatchEvent(
                  new MouseEvent('click',{bubbles:true,cancelable:true}))''', B)
                overview(page, initial)  # Leaflet toggles the already open popup closed.
                click_marker(page, B)
                selected(page, B)
                assert len(image_requests) == 1, image_requests

                # Modal close affects the modal only, then popup X clears selection.
                page.locator('.leaflet-popup img[data-drive-id]').click()
                assert page.locator('#imgModalBg').is_visible()
                page.locator('#imgModalClose').click()
                selected(page, B)
                assert 'MAEKA-DAMAGED' in page.locator('.leaflet-popup').first.text_content()
                page.locator('.leaflet-popup-close-button').last.dispatch_event('click')  # sticky header can cover the X after Playwright's auto-scroll
                overview(page, initial)
                if width == 1440:
                    page.screenshot(path=str(SHOTS / 'overview-restored-1440.png'), full_page=True)

                # Table switches directly; the unlocated record retains details and a clear action.
                pick_row(page, A)
                selected(page, A)
                pick_row(page, B)
                selected(page, B)
                assert snapshot(page) == initial
                pick_row(page, NO_COORD)
                selected(page, NO_COORD)
                page.wait_for_function('''() => document.querySelectorAll('.leaflet-popup').length === 0''')
                assert snapshot(page) == initial
                page.locator('#efReset').click()  # no DSS reset button any more; a filter reset drops the selection
                overview(page, initial)

                # Search is a data filter; map layers only change visible markers.
                click_marker(page, B)
                page.locator('#efSearch').fill('DAMAGED')
                wait_kpi(page, '1')
                filtered = snapshot(page)
                # D2: executive filters never touch the detail-tab table, so only the KPI set narrows here.
                assert filtered['kpis'][0] == '1' and filtered['table'] == initial['table']
                overview(page, filtered)
                click_marker(page, B)
                assert snapshot(page) == filtered
                page.locator('.leaflet-popup-close-button').last.dispatch_event('click')  # sticky header can cover the X after Playwright's auto-scroll
                overview(page, filtered)
                page.locator('#efSearch').fill('NO-MATCH-RESOURCE')
                wait_kpi(page, '0')
                assert page.locator('#execKpi .kpi-card:first-child .kv').inner_text() == '0'
                page.locator('#efReset').click()
                overview(page, initial)
                click_marker(page, B)
                page.locator('#efStatus').select_option('broken')
                wait_kpi(page, '1')
                overview(page, snapshot(page))
                page.locator('#efReset').click()
                overview(page, initial)
                click_marker(page, B)
                page.locator('#efProblem').select_option('ชำรุด')
                wait_kpi(page, '1')
                overview(page, snapshot(page))
                page.locator('#efReset').click()
                overview(page, initial)
                click_marker(page, B)
                page.locator('#efType').select_option(index=1)
                page.wait_for_function('() => document.querySelector("#execKpi .kpi-card:first-child .kv").textContent.trim() !== "3"')
                overview(page, snapshot(page))
                page.locator('#efReset').click()
                overview(page, initial)
                # The map layer panel only changes visible markers (tambon layer replaces the old village layer, D11).
                page.locator('#mlcToggle').click()
                click_marker(page, B)
                page.locator('#mlcToggle').click()
                page.locator('#mlcTbNone').click()
                overview(page, initial)
                assert page.locator('#map .leaflet-marker-icon').count() == 0
                page.locator('#mlcTbAll').click()
                assert page.locator('#map .leaflet-marker-icon').count() == 2

                # Leaflet's other normal close paths return to the same overview.
                click_marker(page, A)
                if page.locator('#mlcPanel').evaluate('(panel) => panel.classList.contains("open")'):
                    page.locator('#mlcToggle').click()
                map_height = page.locator('#map').bounding_box()['height']
                page.locator('#map').click(position={'x': 40, 'y': map_height - 40}, force=True)
                overview(page, initial)
                click_marker(page, A)
                page.keyboard.press('Escape')
                overview(page, initial)
                assert not errors, errors
                assert page.evaluate('document.documentElement.scrollWidth - innerWidth') <= 2
                results.append(f'viewport_{width}_selection_filters_popup_close')
                context.close()
        finally:
            browser.close()
    print(json.dumps({'ok': True, 'tests': results, 'screenshots': str(SHOTS)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
