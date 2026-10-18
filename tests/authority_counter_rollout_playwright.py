"""Counter namespaces, daily deduplication, and production-host write guard."""
import json

from playwright.sync_api import sync_playwright

from authority_locked_playwright import BASE, CHROME, DATA, install_routes, ready
from authority_parity_playwright import ACTIVE, PREVIEW, COUNTER, install_virtual_host


SLUGS = ('tt-mae-ka', 'tm-phayao', 'tt-ban-sang')
NAMESPACES = {
    'tt-mae-ka': 'pyo-water-maeka-dashboard',
    'tm-phayao': 'pyo-water-authority-tm-phayao',
    'tt-ban-sang': 'pyo-water-authority-tt-ban-sang',
}
KEYS = {
    'tt-mae-ka': 'pyoMaeKaVisitDate',
    'tm-phayao': 'pyoAuthorityVisitDate:tm-phayao',
    'tt-ban-sang': 'pyoAuthorityVisitDate:tt-ban-sang',
}
TOTALS = dict(zip(SLUGS, (246, 31, 52)))
COUNTRIES = dict(zip(SLUGS, (12, 3, 5)))


def counter_mock(context, calls, *, fail=False):
    def handler(route):
        url = route.request.url
        calls.append(url)
        if fail is True or (fail == 'country' and '/hit/' in url and '/country-' in url):
            route.fulfill(status=503, content_type='application/json', body='{}')
            return
        slug = next((slug for slug, namespace in NAMESPACES.items()
                     if '/' + namespace + '/' in url), None)
        assert slug, url
        value = TOTALS[slug] if url.endswith('/total-views') else (
            COUNTRIES[slug] if url.endswith('/country-TH') else 0)
        route.fulfill(status=200, content_type='application/json',
                      body=json.dumps({'value': value}))
    context.route(COUNTER + '**', handler)
    context.route('https://ipwho.is/**', lambda route: route.fulfill(
        status=200, content_type='application/json',
        body='{"success":true,"country_code":"TH"}'))


def hits(calls):
    return [url for url in calls if '/hit/' in url]


def visit(page, host, slug):
    page.goto(host + '/authority/' + slug + '/', wait_until='domcontentloaded')
    ready(page, slug, 1 if slug != 'tt-mae-ka' else 2)
    page.wait_for_function('expected => document.querySelector("#vcTotal")?.textContent === expected',
                           arg=str(TOTALS[slug]))
    page.locator('#vcToggle').click()
    page.wait_for_function('expected => document.querySelector("#vcCountryList")?.textContent.includes(expected)',
                           arg=str(COUNTRIES[slug]))
    assert 'ไทย' in page.locator('#vcCountryList').inner_text()
    assert page.locator('#visitorCounter').is_visible()


def main():
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
        try:
            context = browser.new_context()
            install_virtual_host(context, ACTIVE, DATA)
            calls = []
            counter_mock(context, calls)
            page = context.new_page()
            for slug in SLUGS:
                visit(page, ACTIVE, slug)
                namespace = NAMESPACES[slug]
                assert len([url for url in hits(calls) if '/' + namespace + '/' in url]) == 2
                assert page.evaluate('key => localStorage.getItem(key)', KEYS[slug]) == \
                    page.evaluate('new Date().toISOString().slice(0,10)')
            assert len(set(NAMESPACES.values())) == 3
            assert len(set(KEYS.values())) == 3
            assert len(hits(calls)) == 6
            identities = page.evaluate('''() => AuthorityRoutes.entries.map(entry =>
              visitorCounterIdentity(entry))''')
            assert len(identities) == 29
            assert len({value['namespace'] for value in identities}) == 29
            assert len({value['visitKey'] for value in identities}) == 29
            assert all(value['namespace'] != 'pyo-water-dashboard-2026' for value in identities)
            visit(page, ACTIVE, 'tm-phayao')
            visit(page, ACTIVE, 'tt-mae-ka')
            assert len(hits(calls)) == 6, hits(calls)
            assert all(page.evaluate('key => localStorage.getItem(key)', key)
                       for key in KEYS.values())
            results.append('hosted_three_namespaces_independent_keys_daily_dedup_country')
            page.goto(ACTIVE + '/authority/not-an-authority/')
            page.wait_for_selector('#authorityFailure')
            assert len(hits(calls)) == 6
            results.append('invalid_route_no_hit')
            context.close()

            context = browser.new_context()
            install_virtual_host(context, PREVIEW, DATA)
            calls = []
            counter_mock(context, calls)
            page = context.new_page()
            for slug in SLUGS:
                visit(page, PREVIEW, slug)
            assert not hits(calls), hits(calls)
            results.append('preview_read_only')
            context.close()

            context = browser.new_context()
            install_routes(context, data=DATA)
            calls = []
            counter_mock(context, calls)
            page = context.new_page()
            for slug in SLUGS:
                visit(page, BASE, slug)
            assert not hits(calls), hits(calls)
            results.append('localhost_read_only')
            context.close()

            context = browser.new_context()
            install_virtual_host(context, ACTIVE, DATA)
            calls = []
            counter_mock(context, calls, fail=True)
            page = context.new_page()
            page.goto(ACTIVE + '/authority/tm-phayao/')
            ready(page, 'tm-phayao', 1)
            page.wait_for_function('() => document.querySelector("#vcTotal")?.textContent === "—"')
            assert page.locator('#visitorCounter').is_visible()
            assert page.evaluate('localStorage.getItem("pyoAuthorityVisitDate:tm-phayao")') is None
            assert len(hits(calls)) == 1, hits(calls)
            results.append('service_failure_page_survives')
            context.close()

            context = browser.new_context()
            install_virtual_host(context, ACTIVE, DATA)
            calls = []
            counter_mock(context, calls, fail='country')
            page = context.new_page()
            page.goto(ACTIVE + '/authority/tm-phayao/')
            ready(page, 'tm-phayao', 1)
            page.wait_for_function('() => document.querySelector("#vcTotal")?.textContent === "—"')
            today = page.evaluate('new Date().toISOString().slice(0,10)')
            assert page.evaluate('localStorage.getItem("pyoAuthorityVisitDate:tm-phayao")') == today
            assert len(hits(calls)) == 2
            page.reload()
            ready(page, 'tm-phayao', 1)
            page.wait_for_function('() => document.querySelector("#vcTotal")?.textContent === "31"')
            assert len(hits(calls)) == 2, hits(calls)
            results.append('country_failure_does_not_repeat_total')
            context.close()
        finally:
            browser.close()
    print(json.dumps({'ok': True, 'tests': results}, ensure_ascii=False))


if __name__ == '__main__':
    main()
