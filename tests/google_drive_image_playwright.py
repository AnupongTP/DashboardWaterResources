"""Image failure handling on the real dashboard with isolated API/image responses."""
import json
import os
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

from authority_locked_playwright import ACTIVE, BASE, by_slug, record

FILE_ID = '1BtsSqbXTdQ_Z6AOoz4I0ExtqH_y3mzH0'
ORIGINAL = f'https://drive.google.com/uc?export=view&id={FILE_ID}'
PRIMARY = f'https://lh3.googleusercontent.com/d/{FILE_ID}=w500'
THUMBNAIL = f'https://drive.google.com/thumbnail?id={FILE_ID}&sz=w400'
VERSION = '"image-render-fixture"'
PNG = bytes.fromhex(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
    '0000000d49444154081d63f8cfc0f01f000160023f49c2ff9f0000000049454e44ae426082'
)
maeka = by_slug['tt-mae-ka']
DATA = [record(71559, 'IMAGE-FAILURE-FIXTURE', maeka['authority'],
               maeka['tambon'], maeka['moo'], problem='น้ำเน่าเสีย ชำรุด', image=ORIGINAL)]


def run_case(browser, path, *, mode, width):
    context = browser.new_context(viewport={'width': width, 'height': 900})
    image_requests = []
    page_errors = []

    def handle(route):
        url = route.request.url
        if url == ACTIVE + '/api/waterresources/version':
            route.fulfill(status=200, content_type='application/json',
                          headers={'Access-Control-Allow-Origin': '*'},
                          body=json.dumps({'version': VERSION, 'count': 1}))
        elif url == ACTIVE + '/api/waterresources':
            route.fulfill(status=200, content_type='application/json',
                          headers={'Access-Control-Allow-Origin': '*'},
                          body=json.dumps({'version': VERSION, 'count': 1, 'data': DATA}, ensure_ascii=False))
        elif urlparse(url).hostname in ('lh3.googleusercontent.com', 'drive.google.com'):
            image_requests.append(url)
            if url == PRIMARY and mode == 'primary':
                route.fulfill(status=200, content_type='image/png', body=PNG)
            elif url == THUMBNAIL and mode == 'secondary':
                route.fulfill(status=200, content_type='image/png', body=PNG)
            else:
                route.fulfill(status=429 if url == PRIMARY else 403,
                              content_type='text/html', body='<html>Image unavailable</html>')
        elif 'leaflet.markercluster.js' in url:
            route.fulfill(status=200, content_type='application/javascript',
                          body='L.markerClusterGroup = () => L.featureGroup();')
        elif url.startswith(BASE + '/'):
            route.continue_()
        else:
            route.abort()

    context.route('**/*', handle)
    page = context.new_page()
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    page.goto(BASE + path, wait_until='domcontentloaded')
    page.wait_for_function('() => document.querySelector("#countNote") && '
                           'document.querySelector("#countNote").textContent.includes("1 จาก 1")')
    if path.startswith('/authority/'):
        assert page.evaluate('window.__AUTHORITY_PAGE__.authority') == maeka['authority']

    page.evaluate('window.showSiteCard(71559)')
    if mode != 'primary':
        page.locator('#siteCardBody .water-image-fallback').wait_for(state='visible')
        assert 'ไม่สามารถแสดงภาพ' in page.locator('#siteCardBody').inner_text()
        assert page.locator('#siteCardBody .water-image-fallback a').get_attribute('href') == ORIGINAL
        assert page.locator('#siteCardBody .water-image-fallback button').is_visible()
        assert page.locator('#siteCardBody img').first.evaluate('e => getComputedStyle(e).display') == 'none'
        assert image_requests == [PRIMARY], image_requests

        # A redraw and other image components must not retry a failed ID automatically.
        page.evaluate('window.showSiteCard(71559)')
        assert page.locator('#siteCardBody img[src]').count() == 0
        page.locator('#siteCardModal').evaluate("e => e.classList.remove('open')")
        page.locator('#map .leaflet-marker-icon').first.click(force=True)
        assert page.locator('.leaflet-popup-content .water-image-fallback').is_visible()
        assert page.locator('.leaflet-popup-content .water-image-fallback a').get_attribute('href') == ORIGINAL
        page.evaluate("window.setCrossFilter('problem','น้ำเน่าเสีย')")
        assert page.locator('#wqSiteDetail .water-image-fallback.compact').count() == 1
        page.locator('.main-nav button[data-view="detail"]').click()
        page.locator('.tab-btn[data-tab="gallery"]').click()
        assert page.locator('#galleryGrid .water-image-fallback').first.is_visible()
        page.locator('#galleryGrid .gcard').first.click()
        assert page.locator('#modalContent .water-image-fallback').is_visible()
        assert image_requests == [PRIMARY], image_requests

        # The old automatic secondary URL is now available only after one explicit click.
        page.locator('#modalContent .water-image-fallback button').click()
        if mode == 'secondary':
            page.wait_for_function('() => document.querySelector("#modalContent img")?.naturalWidth === 1')
            assert page.locator('#modalContent .water-image-fallback').is_hidden()
            assert image_requests == [PRIMARY, THUMBNAIL], image_requests
            page.evaluate('window.showSiteCard(71559)')
            page.wait_for_function('() => document.querySelector("#siteCardBody img")?.naturalWidth === 1')
            assert page.locator('#siteCardBody img').get_attribute('src') == THUMBNAIL
            assert image_requests.count(PRIMARY) == 1, image_requests
        else:
            page.locator('#modalContent .water-image-fallback').wait_for(state='visible')
            assert image_requests == [PRIMARY, THUMBNAIL], image_requests
            page.locator('#modalContent .water-image-fallback button').click()
            page.locator('#modalContent .water-image-fallback').wait_for(state='visible')
            assert image_requests == [PRIMARY, THUMBNAIL, ORIGINAL], image_requests
            assert page.locator('#modalContent .water-image-fallback button').count() == 0 or not page.locator('#modalContent .water-image-fallback button').is_visible()
            assert page.locator('#modalContent .water-image-fallback a').get_attribute('href') == ORIGINAL
            page.evaluate('window.showSiteCard(71559)')
            assert image_requests == [PRIMARY, THUMBNAIL, ORIGINAL], image_requests
    else:
        page.wait_for_function('() => document.querySelector("#siteCardBody img")?.naturalWidth === 1')
        assert page.locator('#siteCardBody .water-image-fallback').is_hidden()
        page.locator('#siteCardModal').evaluate("e => e.classList.remove('open')")
        page.locator('#map .leaflet-marker-icon').first.click(force=True)
        page.locator('.leaflet-popup-content img').scroll_into_view_if_needed()
        page.wait_for_function('() => document.querySelector(".leaflet-popup-content img")?.naturalWidth === 1')
        page.evaluate("window.setCrossFilter('problem','น้ำเน่าเสีย')")
        assert page.locator('#wqSiteDetail img[data-drive-id]').count() == 1
        page.locator('.main-nav button[data-view="detail"]').click()
        page.locator('.tab-btn[data-tab="gallery"]').click()
        page.locator('#galleryGrid .gcard').first.click()
        page.wait_for_function('() => document.querySelector("#modalContent img")?.naturalWidth === 1')
        assert page.locator('#modalContent .water-image-fallback').is_hidden()
        assert image_requests and all(url == PRIMARY for url in image_requests), image_requests
        assert page.locator('img[src^="https://drive.google.com/uc"]').count() == 0

    assert not page_errors, page_errors
    assert page.evaluate('document.documentElement.scrollWidth - innerWidth') <= 2
    result = {'path': path, 'mode': mode, 'width': width,
              'image_requests': image_requests, 'page_errors': page_errors}
    context.close()
    return result


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True,
            executable_path=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'))
        results = [run_case(browser, '/', mode='primary', width=1440),
                   run_case(browser, '/authority/tt-mae-ka/', mode='secondary', width=390),
                   run_case(browser, '/', mode='all-fail', width=360)]
        browser.close()
    print(json.dumps({'ok': True, 'results': results}, ensure_ascii=False))


if __name__ == '__main__':
    main()
