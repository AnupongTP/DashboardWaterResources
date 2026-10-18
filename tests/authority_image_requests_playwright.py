"""Trace the actual Authority popup image requests with isolated Google responses."""
import json
import re

from playwright.sync_api import sync_playwright

from authority_locked_playwright import BASE, CHROME, by_slug, install_routes, ready, record

FILE_ID = 'testAuthorityImage1234567890123'
ORIGINAL = f'https://drive.google.com/uc?export=view&id={FILE_ID}'
PRIMARY = f'https://lh3.googleusercontent.com/d/{FILE_ID}=w1000'
THUMBNAIL = f'https://drive.google.com/thumbnail?id={FILE_ID}&sz=w1000'
PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082')
DATA = [record(71559, 'IMAGE-REQUEST-PROBE', by_slug['tt-mae-ka']['authority'],
               by_slug['tt-mae-ka']['tambon'], by_slug['tt-mae-ka']['moo'], image=ORIGINAL)]


def run_case(browser, mode):
    context = browser.new_context(viewport={'width': 1440, 'height': 900})
    install_routes(context, data=DATA)
    requests, initiators, page_errors = [], [], []
    phase = ['initial']

    def image_route(route):
        url = route.request.url
        requests.append({'phase': phase[0], 'url': url, 'method': route.request.method})
        succeeds = (mode == 'primary-success' and url == PRIMARY) or \
                   (mode == 'thumbnail-success' and url == THUMBNAIL)
        if succeeds:
            route.fulfill(status=200, content_type='image/png', body=PNG)
        else:
            route.fulfill(status=403, content_type='text/html',
                          headers={'X-Content-Type-Options': 'nosniff'},
                          body='<html>image unavailable</html>')

    context.route(re.compile(r'^https://(?:lh3\.googleusercontent\.com/d/|drive\.google\.com/(?:thumbnail|uc)\?)'), image_route)
    page = context.new_page()
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    cdp = context.new_cdp_session(page)
    cdp.send('Network.enable')

    def network_event(event):
        url = event.get('request', {}).get('url', '')
        if FILE_ID not in url:
            return
        initiator = event.get('initiator', {})
        frames = initiator.get('stack', {}).get('callFrames', [])
        initiators.append({'url': url, 'type': initiator.get('type'),
                           'functions': [frame.get('functionName') for frame in frames[:4]]})

    cdp.on('Network.requestWillBeSent', network_event)
    page.goto(BASE + '/authority/tt-mae-ka/', wait_until='domcontentloaded')
    ready(page, 'tt-mae-ka', 1)
    scripts = page.evaluate('''() => [...document.scripts].map(s=>s.src).filter(Boolean)''')
    assert any('/assets/authority-app.js' in url for url in scripts), scripts
    assert not any('/assets/maeka-app.js' in url for url in scripts), scripts
    assert page.evaluate('''() => typeof authorityImageError==='function' &&
        typeof authorityImageRetry==='function' && typeof handleImgFallback==='undefined' ''')
    page.evaluate('''() => {
      window.__authorityImageHandlerCalls=[];
      for(const name of ['driveImgTag','authorityImageError','authorityImageRetry']){
        const original=window[name];
        window[name]=function(...args){
          window.__authorityImageHandlerCalls.push({name,stack:(new Error().stack||'').split('\\n').slice(1,5)});
          return original.apply(this,args);
        };
      }
    }''')

    def open_popup():
        page.locator('#tblBody tr').first.click()
        return page.locator('#mapbox .leaflet-popup:visible').last

    popup = open_popup()
    image = popup.locator('img[data-drive-id]')
    assert image.get_attribute('referrerpolicy') == 'no-referrer'
    if mode == 'primary-success':
        page.wait_for_function('''() => document.querySelector('#mapbox .leaflet-popup img[data-drive-id]')?.naturalWidth === 1''')
        assert image.get_attribute('src') == PRIMARY
        assert [item['url'] for item in requests] == [PRIMARY], requests
        image.click()
        page.wait_for_function('''() => document.querySelector('#imgModalImg')?.naturalWidth === 1''')
        assert page.locator('#imgModalImg').evaluate('(image) => image.referrerPolicy') == 'no-referrer'
        assert page.locator('#imgModalBg').is_visible()
        page.locator('#imgModalClose').click()
        phase[0] = 'reopen'
        popup.locator('.leaflet-popup-close-button').click()
        open_popup().locator('img[data-drive-id]').wait_for()
        phase[0] = 'rerender'
        page.evaluate('renderAll()')
        open_popup().locator('img[data-drive-id]').wait_for()
        page.wait_for_timeout(250)
        assert all(item['url'] == PRIMARY for item in requests), requests
    else:
        fallback = popup.locator('.authority-image-fallback')
        fallback.wait_for(state='visible')
        assert [item['url'] for item in requests] == [PRIMARY], requests
        assert fallback.locator('a').get_attribute('href') == ORIGINAL
        assert page.locator('#imgModalBg').is_hidden()
        phase[0] = 'reopen-after-failure'
        popup.locator('.leaflet-popup-close-button').click()
        popup = open_popup()
        popup.locator('.authority-image-fallback').wait_for(state='visible')
        phase[0] = 'rerender-after-failure'
        page.evaluate('renderAll()')
        popup = open_popup()
        popup.locator('.authority-image-fallback').wait_for(state='visible')
        assert [item['url'] for item in requests] == [PRIMARY], requests
        phase[0] = 'user-thumbnail-click'
        popup.locator('.authority-image-fallback button').click()
        if mode == 'thumbnail-success':
            page.wait_for_function('''() => document.querySelector('#mapbox .leaflet-popup img[data-drive-id]')?.naturalWidth === 1''')
            assert [item['url'] for item in requests] == [PRIMARY, THUMBNAIL], requests
            popup.locator('img[data-drive-id]').click()
            page.wait_for_function('''() => document.querySelector('#imgModalImg')?.naturalWidth === 1''')
            assert page.locator('#imgModalBg').is_visible()
            page.locator('#imgModalClose').click()
        else:
            popup.locator('.authority-image-fallback').wait_for(state='visible')
            assert [item['url'] for item in requests] == [PRIMARY, THUMBNAIL], requests
            phase[0] = 'user-original-endpoint-click'
            popup.locator('.authority-image-fallback button').click()
            popup.locator('.authority-image-fallback').wait_for(state='visible')
            assert [item['url'] for item in requests] == [PRIMARY, THUMBNAIL, ORIGINAL], requests
            assert popup.locator('.authority-image-fallback button').is_hidden()
            assert popup.locator('.authority-image-fallback a').get_attribute('href') == ORIGINAL
            phase[0] = 'reopen-after-all-fail'
            popup.locator('.leaflet-popup-close-button').click()
            popup = open_popup()
            popup.locator('.authority-image-fallback').wait_for(state='visible')
            page.evaluate('renderAll()')
            open_popup().locator('.authority-image-fallback').wait_for(state='visible')
            assert [item['url'] for item in requests] == [PRIMARY, THUMBNAIL, ORIGINAL], requests
            assert page.locator('#imgModalBg').is_hidden()

    assert not page_errors, page_errors
    handler_calls = page.evaluate('window.__authorityImageHandlerCalls')
    assert handler_calls[0]['name'] == 'driveImgTag', handler_calls
    if mode != 'primary-success':
        assert sum(call['name'] == 'authorityImageRetry' for call in handler_calls) == \
            (1 if mode == 'thumbnail-success' else 2), handler_calls
    result = {'mode': mode, 'scripts': scripts, 'requests': requests,
              'initiators': initiators, 'handler_calls': handler_calls,
              'page_errors': page_errors}
    context.close()
    return result


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        try:
            results = [run_case(browser, mode) for mode in
                       ('primary-success', 'thumbnail-success', 'all-fail')]
        finally:
            browser.close()
    print(json.dumps({'ok': True, 'results': results}, ensure_ascii=False))


if __name__ == '__main__':
    main()
