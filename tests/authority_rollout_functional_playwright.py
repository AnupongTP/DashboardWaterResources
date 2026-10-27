"""Representative shared-template interactions outside the Mae Ka reference route."""
import copy
import json

from playwright.sync_api import sync_playwright

from authority_locked_playwright import BASE, CHROME, install_routes, ready
from authority_maeka_prototype_playwright import PNG
from authority_selection_playwright import click_marker, snapshot
from authority_rollout_jurisdiction_playwright import DATA as JURISDICTION_DATA


IMAGE_ID = 'authorityRolloutImage123456789'
DATA = copy.deepcopy(JURISDICTION_DATA)
next(row for row in DATA if row['id'] == 30025).update(
    imglink=f'https://drive.google.com/uc?export=view&id={IMAGE_ID}',
    problem='ชำรุด,น้ำเน่าเสีย')
next(row for row in DATA if row['id'] == 30026)['problem'] = 'วัชพืชปกคลุม'


def main():
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        try:
            for width, height in ((1440, 900), (768, 1024), (412, 915),
                                  (390, 844), (360, 800)):
                context = browser.new_context(viewport={'width': width, 'height': height},
                                              is_mobile=width < 500, has_touch=width < 500)
                install_routes(context, data=DATA)
                image_requests = []

                def image_route(route):
                    image_requests.append(route.request.url)
                    route.fulfill(status=200, content_type='image/png', body=PNG)

                context.route('https://lh3.googleusercontent.com/d/**', image_route)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(BASE + '/authority/tm-dok-kham-tai/', wait_until='domcontentloaded')
                ready(page, 'tm-dok-kham-tai', 7)
                assert page.locator('.kpi[data-kpi]').count() == 5
                assert all(page.locator('#' + chart).count() == 1
                           for chart in ('chartType', 'chartVol', 'chartProb'))
                assert page.locator('#tblBody tr[data-id]').count() == 7
                assert page.locator('#mapbox .leaflet-marker-icon').count() == 6
                assert page.locator('#fTambon').is_visible()
                assert page.locator('#visitorCounter').is_visible()
                assert page.locator('.dss-summary-card').count() == 4
                assert page.locator('#dssContent .dss-block').is_hidden()
                assert '🛠️ ข้อแนะนำยุทธศาสตร์การบริหารงบประมาณ' in page.locator('#dssContent').text_content()
                assert '28 แห่ง' not in page.locator('#dssContent').inner_text()
                initial = snapshot(page)

                click_marker(page, 30025)
                assert 'ดอกคำใต้-หมู่1-ทม-ยืนยันแล้ว' in page.locator('#dssTitleText').inner_text()
                assert snapshot(page) == initial
                image = page.locator('.leaflet-popup img[data-drive-id]')
                image.wait_for()
                page.wait_for_function('''() => document.querySelector('.leaflet-popup img[data-drive-id]')?.naturalWidth > 0''')
                image.click()
                assert page.locator('#imgModalBg').is_visible()
                page.locator('#imgModalClose').click()
                click_marker(page, 30030)
                assert 'ดอกคำใต้-หมู่3-override-ทม' in page.locator('#dssTitleText').inner_text()
                assert snapshot(page) == initial
                page.locator('.leaflet-popup-close-button').last.click()
                page.wait_for_function('() => state.focusId === null')
                assert snapshot(page) == initial
                assert page.locator('#dssTitleText').inner_text() == '📊 สรุปข้อมูลปัญหาตามตัวกรอง'
                assert len(image_requests) == 1, image_requests

                page.locator('#fStatus').select_option('ชำรุด')
                assert page.locator('#statCount').inner_text() == '1'
                page.locator('.kpi[data-kpi="count"]').click()
                page.locator('#fProblem').select_option('น้ำเน่าเสีย')
                assert page.locator('#statCount').inner_text() == '1'
                page.locator('.kpi[data-kpi="count"]').click()
                assert snapshot(page) == initial
                page.locator('#layerBtn').click()
                page.locator('#lpVillageNone').click()
                assert page.locator('#mapbox .leaflet-marker-icon').count() == 0
                assert snapshot(page) == initial
                page.locator('#lpVillageAll').click()
                assert page.locator('#mapbox .leaflet-marker-icon').count() == 6
                page.locator('.expand-btn[data-chart="type"]').click()
                assert page.locator('#chartModalBg').is_visible()
                page.locator('#chartModalClose').click()

                page.locator('#mapbox').scroll_into_view_if_needed()
                page.locator('.map-fullscreen-btn').click()
                assert page.locator('.card.pseudo-fullscreen').count() == 1
                page.evaluate('map.setZoom(12)')
                page.wait_for_function('() => !map._animatingZoom && map.getZoom() === 12')
                box = page.locator('#mapbox').bounding_box()
                page.mouse.move(box['x'] + box['width'] * .25,
                                box['y'] + box['height'] * .75)
                page.mouse.wheel(0, -240)
                page.wait_for_function('() => !map._animatingZoom && map.getZoom() > 12')
                page.keyboard.press('Escape')
                assert page.locator('.card.pseudo-fullscreen').count() == 0
                assert page.evaluate('map.scrollWheelZoom.enabled()')
                assert page.evaluate('document.documentElement.scrollWidth - innerWidth') <= 2
                assert not errors, errors
                results.append('tm-dok-kham-tai_' + str(width))
                context.close()

            context = browser.new_context(viewport={'width': 1440, 'height': 900})
            install_routes(context, data=DATA)
            page = context.new_page()
            page.goto(BASE + '/authority/obt-dok-kham-tai/')
            ready(page, 'obt-dok-kham-tai', 3)
            assert page.locator('#fTambon').is_hidden()
            assert page.locator('#tblBody tr[data-id]').count() == 3
            page.locator('#txtSearch').fill('หมู่2-อบต-ยืนยันแล้ว')
            assert page.locator('#statCount').inner_text() == '1'
            page.locator('.kpi[data-kpi="count"]').click()
            assert page.locator('#statCount').inner_text() == '3'
            results.append('obt-dok-kham-tai_single_tambon')
            context.close()
        finally:
            browser.close()
    print(json.dumps({'ok': True, 'tests': results, 'mockedImages': True}, ensure_ascii=False))


if __name__ == '__main__':
    main()
