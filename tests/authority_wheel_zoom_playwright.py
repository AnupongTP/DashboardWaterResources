"""Native wheel zoom and surrounding interactions on the Mae Ka Authority map."""
from playwright.sync_api import sync_playwright

from authority_locked_playwright import BASE, CHROME, install_routes, ready
from authority_maeka_prototype_playwright import fixture
from authority_selection_playwright import A, B, click_marker, selected, snapshot


def zoom(page):
    return page.evaluate('map.getZoom()')


def wait_zoom(page, previous, direction):
    page.wait_for_function('([old,direction]) => !map._animatingZoom && direction * (map.getZoom() - old) > 0',
                           arg=[previous, direction])
    return zoom(page)


def main():
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        try:
            for width, height in ((1440, 900), (412, 915), (390, 844), (360, 800)):
                mobile = width < 500
                context = browser.new_context(viewport={'width': width, 'height': height},
                                              is_mobile=mobile, has_touch=mobile)
                install_routes(context, data=fixture())
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(BASE + '/authority/tt-mae-ka/', wait_until='domcontentloaded')
                ready(page, 'tt-mae-ka', 3)
                initial = snapshot(page)
                assert page.evaluate('map.scrollWheelZoom.enabled()')
                # The fixture's close markers can make fitBounds start at maxZoom.
                page.evaluate('map.setZoom(12)')
                page.wait_for_function('!map._animatingZoom && map.getZoom() === 12')
                page.locator('#mapbox').scroll_into_view_if_needed()
                box = page.locator('#mapbox').bounding_box()
                assert box and box['width'] > 100 and box['height'] > 100
                # Mouse events target clear map space, away from markers and controls.
                page.mouse.move(box['x'] + box['width'] * .25,
                                box['y'] + box['height'] * .75)
                before = zoom(page)
                page.mouse.wheel(0, -240)
                enlarged = wait_zoom(page, before, 1)
                page.mouse.wheel(0, 240)
                reduced = wait_zoom(page, enlarged, -1)

                # Scrolling the document outside the map must not change map zoom.
                page.evaluate('window.scrollTo(0, 0)')
                page.mouse.move(width * .5, 80)
                outside_zoom = zoom(page)
                page.mouse.wheel(0, 360)
                page.wait_for_function('window.scrollY > 0')
                assert zoom(page) == outside_zoom

                page.locator('#mapbox').scroll_into_view_if_needed()
                plus_before = zoom(page)
                if mobile:
                    plus_box = page.locator('.leaflet-control-zoom-in').bounding_box()
                    assert plus_box
                    page.touchscreen.tap(plus_box['x'] + plus_box['width'] / 2,
                                         plus_box['y'] + plus_box['height'] / 2)
                else:
                    page.locator('.leaflet-control-zoom-in').click()
                plus_zoom = wait_zoom(page, plus_before, 1)
                page.locator('.leaflet-control-zoom-out').click()
                wait_zoom(page, plus_zoom, -1)

                # Wheel zoom must preserve marker selection, popup, DSS, and totals.
                click_marker(page, A)
                selected(page, A)
                assert snapshot(page) == initial
                assert 'AUTH-tt-mae-ka' in page.locator('#dssTitleText').inner_text()
                popup_zoom = zoom(page)
                box = page.locator('#mapbox').bounding_box()
                page.mouse.move(box['x'] + box['width'] * .12,
                                box['y'] + box['height'] * .72)
                page.mouse.wheel(0, -120)
                wait_zoom(page, popup_zoom, 1)
                selected(page, A)
                click_marker(page, B)
                selected(page, B)
                assert snapshot(page) == initial
                assert 'MAEKA-DAMAGED' in page.locator('#dssTitleText').inner_text()
                page.locator('.leaflet-popup-close-button').last.click()
                assert page.evaluate('state.focusId') is None
                page.wait_for_function('''() => !map._popup?.isOpen() &&
                  document.querySelectorAll('#mapbox .leaflet-popup').length===0''')

                # Desktop native mouse drag/pan remains available.
                if not mobile:
                    page.locator('#mapbox').scroll_into_view_if_needed()
                    pan_before = page.evaluate('map.getCenter().lng')
                    box = page.locator('#mapbox').bounding_box()
                    pan_x = box['x'] + box['width'] * .35
                    pan_y = box['y'] + box['height'] * .75
                    assert page.evaluate('([x,y]) => document.elementFromPoint(x,y)?.closest("#mapbox") !== null',
                                         [pan_x, pan_y])
                    page.mouse.move(pan_x, pan_y)
                    page.mouse.down()
                    page.mouse.move(pan_x + 45, pan_y, steps=5)
                    page.mouse.up()
                    page.wait_for_function('old => Math.abs(map.getCenter().lng - old) > 0.000001',
                                           arg=pan_before)

                # Fullscreen mode uses the same map and wheel handler.
                page.locator('.map-fullscreen-btn').click()
                assert page.locator('#mapbox').locator('xpath=ancestor::*[contains(@class,"pseudo-fullscreen")]').count() == 1
                full_zoom = zoom(page)
                box = page.locator('#mapbox').bounding_box()
                page.mouse.move(box['x'] + box['width'] * .25,
                                box['y'] + box['height'] * .7)
                page.mouse.wheel(0, -120)
                wait_zoom(page, full_zoom, 1)
                page.keyboard.press('Escape')
                assert page.locator('.card.pseudo-fullscreen').count() == 0
                assert page.evaluate('document.documentElement.scrollWidth - innerWidth') <= 2
                assert not errors, errors
                results.append(dict(width=width, wheel_in=[before, enlarged],
                                    wheel_out=[enlarged, reduced],
                                    outside_scroll=True, controls=True, popup=True,
                                    fullscreen=True, page_errors=errors))
                context.close()
        finally:
            browser.close()
    for result in results:
        print(result)


if __name__ == '__main__':
    main()
