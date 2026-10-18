"""Real MarkerCluster integration with mocked data and external services."""
import json

from playwright.sync_api import sync_playwright

from authority_locked_playwright import BASE, CHROME, by_slug, install_routes, ready, record
from authority_selection_playwright import click_marker, snapshot


entry = by_slug['obt-mae-sai']
DATA = []
for index in range(140):
    row = record(80000 + index, f'MAE-SAI-{index}', entry['authority'],
                 entry['tambon'], entry['moo'])
    row['lat'] = 19.15 + (index % 14) * .001
    row['lng'] = 99.80 + (index // 14) * .006
    row['type'] = 'ฝาย' if index < 70 else 'บ่อบาดาล'
    DATA.append(row)
DATA[1]['lat'], DATA[1]['lng'] = DATA[0]['lat'], DATA[0]['lng']
without_coords = record(80150, 'MAE-SAI-NO-COORD', entry['authority'],
                        entry['tambon'], entry['moo'])
without_coords['lat'] = without_coords['lng'] = None
DATA.append(without_coords)
other = by_slug['tt-mae-ka']
DATA.append(record(80999, 'OTHER-AUTHORITY', other['authority'],
                   other['tambon'], other['moo']))
small = by_slug['tt-mae-chai']
DATA.append(record(81000, 'SMALL-AUTHORITY', small['authority'],
                   small['tambon'], small['moo']))


def context_with_plugin(browser, width=1440, height=900):
    context = browser.new_context(viewport={'width': width, 'height': height},
                                  is_mobile=width < 500, has_touch=width < 500)
    install_routes(context, data=DATA)
    # The standard fixture stubs clustering; these integration cases load the
    # project's actual pinned plugin. Dataset, tiles, images and counters remain mocked.
    context.route('**/leaflet.markercluster.js', lambda route: route.continue_())
    context.route('**/MarkerCluster.css', lambda route: route.continue_())
    return context


def cluster_geometry(page, selector):
    return page.evaluate('''selector => {
      const icons=[...document.querySelectorAll(selector + ' .leaflet-marker-icon svg')];
      return icons.map(svg=>{
        const icon=svg.parentElement, path=svg.querySelector('path');
        const box=svg.getBoundingClientRect(), shape=path.getBoundingClientRect();
        const anchorY=-parseFloat(icon.style.marginTop);
        return {count:Number(svg.querySelector('text').textContent),
          insetTop:shape.top-box.top, insetLeft:shape.left-box.left,
          insetRight:box.right-shape.right, insetBottom:box.bottom-shape.bottom,
          tipError:Math.abs(shape.bottom-(box.top+anchorY)),
          viewBox:svg.getAttribute('viewBox'), overflow:getComputedStyle(svg).overflow};
      });
    }''', selector)


def assert_unclipped(geometry):
    assert geometry, 'No cluster SVG rendered'
    assert all(icon['viewBox'] == '-2 -2 28 38' and icon['overflow'] == 'hidden'
               and icon['insetTop'] > 1 and icon['insetLeft'] > 1
               and icon['insetRight'] > 1 and icon['insetBottom'] > 1
               and icon['tipError'] < 1 for icon in geometry), geometry


def main():
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        try:
            for width, height in ((1440, 900), (390, 844), (360, 800)):
                context = context_with_plugin(browser, width, height)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(BASE + '/authority/obt-mae-sai/', wait_until='domcontentloaded')
                ready(page, 'obt-mae-sai', 141)
                page.wait_for_function('''() => typeof markersLayer.zoomToShowLayer==='function'
                  && markersLayer.getLayers().length===140 && !map._animatingZoom &&
                  markersLayer._inZoomAnimation===0 &&
                  document.querySelector('#mapbox .leaflet-marker-icon svg')''')
                page.evaluate('map.setZoom(10)')
                page.wait_for_function('''() => map.getZoom()===10 && !map._animatingZoom &&
                  markersLayer._inZoomAnimation===0''')
                initial = snapshot(page)
                marker_stamp = page.evaluate('L.stamp(markerRefs[80000])')
                assert page.evaluate('markersLayer.getLayers().length') == 140
                assert page.locator('#tblBody tr[data-id]').count() == 141
                assert 'OTHER-AUTHORITY' not in page.locator('#tblBody').inner_text()
                geometry = cluster_geometry(page, '#mapbox')
                assert_unclipped(geometry)
                assert any(icon['count'] > 10 for icon in geometry)
                zoom_before = page.evaluate('map.getZoom()')
                page.locator('#mapbox .leaflet-marker-icon:has(svg)').first.click()
                page.wait_for_function('''before => map.getZoom() > before &&
                  !map._animatingZoom && markersLayer._inZoomAnimation===0''', arg=zoom_before)
                assert snapshot(page) == initial
                results.append(f'authority_cluster_zoom_{width}')

                page.locator('#layerBtn').click()
                page.locator('#lpTypeList input[data-v="ฝาย"]').uncheck()
                page.wait_for_function('() => markersLayer.getLayers().length===70')
                assert page.evaluate('markersLayer._topClusterLevel.getChildCount()') == 70
                assert snapshot(page) == initial
                page.locator('#lpTypeList input[data-v="ฝาย"]').check()
                page.wait_for_function('() => markersLayer.getLayers().length===140')
                page.locator('#lpTypeNone').click()
                page.wait_for_function('() => markersLayer.getLayers().length === 0')
                assert snapshot(page) == initial
                page.locator('#tblBody tr[data-id="80000"]').click()
                assert page.evaluate('state.focusId') == 80000
                assert page.locator('#mapbox .leaflet-popup').count() == 0
                assert snapshot(page) == initial
                if not page.locator('#lpTypeAll').is_visible():
                    page.locator('#layerBtn').click()
                page.locator('#lpTypeAll').click()
                page.wait_for_function('() => markersLayer.getLayers().length === 140')
                assert page.evaluate('L.stamp(markerRefs[80000])') == marker_stamp
                assert snapshot(page) == initial
                results.append(f'authority_map_only_filter_{width}')

                page.locator('#tblBody tr[data-id="80001"]').click()
                page.wait_for_function('''() => map._popup?._source?.authorityRecordId === 80001''')
                assert page.evaluate('markerRefs[80001].getLatLng().equals(markerRefs[80000].getLatLng())')
                assert snapshot(page) == initial
                page.locator('.leaflet-popup-close-button').last.click()
                page.wait_for_function('() => state.focusId === null')
                assert snapshot(page) == initial
                page.locator('#tblBody tr[data-id="80150"]').click()
                assert page.evaluate('state.focusId') == 80150
                page.wait_for_function('''() => !map._popup?.isOpen() &&
                  document.querySelectorAll('#mapbox .leaflet-popup').length===0''')
                assert snapshot(page) == initial
                click_marker(page, 80000)
                click_marker(page, 80002)
                assert page.evaluate('state.focusId') == 80002
                assert snapshot(page) == initial
                page.locator('.leaflet-popup-close-button').last.click()
                page.wait_for_function('() => state.focusId === null')
                assert snapshot(page) == initial
                page.locator('.map-fullscreen-btn').click()
                assert page.locator('.card.pseudo-fullscreen').count() == 1
                page.keyboard.press('Escape')
                assert page.locator('.card.pseudo-fullscreen').count() == 0
                assert page.evaluate('document.documentElement.scrollWidth-innerWidth') <= 2
                assert not errors, errors
                results.append(f'authority_selection_fullscreen_{width}')
                if width == 1440:
                    page.evaluate('map.setZoom(10)')
                    page.wait_for_function('''() => map.getZoom()===10 && !map._animatingZoom &&
                      markersLayer._inZoomAnimation===0''')
                    page.evaluate('''() => {
                      document.querySelector('#tblBody tr[data-id="80000"]').click();
                      document.querySelector('#tblBody tr[data-id="80001"]').click();
                    }''')
                    page.wait_for_function('''() => map._popup?._source?.authorityRecordId===80001''')
                    assert page.evaluate('state.focusId') == 80001
                    results.append('stale_table_callback_ignored')
                    page.locator('.leaflet-popup-close-button').last.click()
                    page.wait_for_function('() => state.focusId===null')
                    page.evaluate('''() => map.setView(markerRefs[80000].getLatLng(),15,{animate:false})''')
                    page.wait_for_function('''() => map.getZoom()===15 &&
                      markersLayer._inZoomAnimation===0''')
                    spider_cluster = page.evaluate('''() => {
                      const parent=markersLayer.getVisibleParent(markerRefs[80000]);
                      if(!(parent instanceof L.MarkerCluster) || !parent._icon) return null;
                      return {count:parent.getChildCount(),same:
                        parent.getAllChildMarkers().includes(markerRefs[80001])};
                    }''')
                    assert spider_cluster and spider_cluster['same'], spider_cluster
                    page.evaluate('''() => markersLayer.getVisibleParent(markerRefs[80000])._icon
                      .dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}))''')
                    page.wait_for_function('''() => markersLayer._spiderfied &&
                      markerRefs[80000].getElement() && markerRefs[80001].getElement()''')
                    click_marker(page, 80000)
                    assert snapshot(page) == initial
                    results.append('identical_coordinates_spiderfy')
                context.close()

            for slug, count, markers in (('tt-mae-ka', 1, 1),
                                         ('tt-mae-chai', 1, 1),
                                         ('obt-khue-wiang', 0, 0)):
                context = context_with_plugin(browser)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(BASE + '/authority/' + slug + '/', wait_until='domcontentloaded')
                ready(page, slug, count)
                assert page.evaluate('markersLayer.getLayers().length') == markers
                assert page.locator('#mapbox .leaflet-marker-icon svg').count() == 0
                assert not errors, errors
                results.append('small_or_empty_' + slug)
                context.close()

            context = context_with_plugin(browser)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(BASE + '/index.html', wait_until='domcontentloaded')
            page.wait_for_function('''() => document.querySelector('#map .leaflet-marker-icon svg')''')
            geometry = cluster_geometry(page, '#map')
            assert_unclipped(geometry)
            sizes = page.evaluate('''() => [5,25,140].map(count => {
              const icon=window.WaterClusterIcon('#0a5fb4','#29b6f6')({getChildCount:()=>count});
              return {size:icon.options.iconSize,anchor:icon.options.iconAnchor,
                label:icon.options.html.match(/<text[^>]*>(\\d+)<\\/text>/)?.[1]};
            })''')
            assert [item['label'] for item in sizes] == ['5', '25', '140'], sizes
            assert sizes[0]['size'][0] < sizes[1]['size'][0] < sizes[2]['size'][0], sizes
            assert all(item['anchor'][0] == item['size'][0]/2 and
                       item['anchor'][1] < item['size'][1] for item in sizes), sizes
            tile_zoom = page.evaluate('''() => Math.max(...[...document.querySelectorAll('#map .leaflet-tile')]
              .map(tile=>Number(tile.src.match(/\\/tile\\/(\\d+)\\//)?.[1]||0)))''')
            page.evaluate('''() => {
              const icons=[...document.querySelectorAll('#map .leaflet-marker-icon:has(svg)')];
              icons.sort((a,b)=>Number(b.querySelector('text').textContent)-
                Number(a.querySelector('text').textContent));
              icons[0].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
            }''')
            page.wait_for_function('''old => [...document.querySelectorAll('#map .leaflet-tile')]
              .some(tile=>Number(tile.src.match(/\\/tile\\/(\\d+)\\//)?.[1]||0)>old)''',
              arg=tile_zoom)
            assert not errors, errors
            results.append('provincial_cluster_geometry_and_zoom')
            context.close()
        finally:
            browser.close()
    print(json.dumps({'ok': True, 'tests': results, 'mockedExternalServices': True},
                     ensure_ascii=False))


if __name__ == '__main__':
    main()
