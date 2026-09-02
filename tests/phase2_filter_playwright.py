from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:4173/index.html'
MUEANG_AUTHORITIES = {
    'ทม.พะเยา','ทต.แม่กา','อบต.แม่นาเรือ','อบต.แม่ใส','อบต.บ้านตุ่น','ทต.บ้านสาง',
    'ทต.สันป่าม่วง','ทต.บ้านต๋อม','ทต.บ้านต๊ำ','ทต.ท่าจำปี','ทต.แม่ปืม','ทต.บ้านใหม่'
}
MAECHAI_AUTHORITIES = {
    'ทต.แม่ใจ','ทต.รวมใจพัฒนา','ทต.ศรีถ้อย','อบต.แม่สุก','ทต.ป่าแฝก','ทต.บ้านเหล่า','ทต.เจริญราษฎร์'
}
MUEANG_TAMBONS = {
    'แม่กา','แม่นาเรือ','แม่ใส','บ้านตุ่น','บ้านสาง','สันป่าม่วง','บ้านต๋อม','บ้านต๊ำ','ท่าจำปี','เทศบาลเมือง','แม่ปืม','บ้านใหม่'
}
MAECHAI_TAMBONS = {'เจริญราษฎร์','แม่สุก','ป่าแฝก','บ้านเหล่า','แม่ใจ','ศรีถ้อย'}


def option_values(page, selector):
    return page.locator(selector + ' option').evaluate_all("els => els.map(e => e.value).filter(Boolean)")


def combobox_values(page, input_sel, list_sel):
    page.locator(input_sel).focus()
    page.wait_for_function("sel => !document.querySelector(sel).hidden", list_sel)
    vals = page.locator(list_sel + ' [role=option]').evaluate_all("els => els.map(e => e.dataset.value)")
    page.locator(input_sel).press('Escape')
    return vals


def wait_ready(page):
    page.goto(BASE, wait_until='domcontentloaded', timeout=60000)
    page.wait_for_function("() => window.AreaResponsibility && document.querySelector('#efDistrict option[value=\"เมืองพะเยา\"]')", timeout=30000)
    page.wait_for_selector('#execKpi .kpi-card', timeout=30000)


def test_desktop(browser):
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page_errors = []
    page.on('pageerror', lambda exc: page_errors.append(str(exc)))
    wait_ready(page)

    assert page.locator('#efDistrict').count() == 1
    assert page.locator('#fDistrict').count() == 1
    assert page.locator('#dfDistrict').count() == 1
    body = page.locator('body').inner_text()
    assert 'อปท./เทศบาล' not in body
    assert 'ทุก อปท./เทศบาล' not in body

    page.select_option('#efDistrict', 'เมืองพะเยา')
    page.wait_for_timeout(120)
    assert set(option_values(page, '#efAuthority')) == MUEANG_AUTHORITIES
    assert set(combobox_values(page, '#efTambon', '#efTambonListbox')) == MUEANG_TAMBONS

    page.select_option('#efAuthority', 'ทต.แม่กา')
    page.wait_for_timeout(120)
    assert combobox_values(page, '#efTambon', '#efTambonListbox') == ['แม่กา']
    first_kpi = page.locator('#execKpi .kpi-card .kv').first.inner_text().strip()
    assert first_kpi not in ('0', ''), 'Mae Ka should resolve legacy rows even with blank LocalAuthority'

    page.select_option('#efDistrict', 'แม่ใจ')
    page.wait_for_timeout(120)
    assert page.input_value('#efAuthority') == ''
    assert set(option_values(page, '#efAuthority')) == MAECHAI_AUTHORITIES
    assert set(combobox_values(page, '#efTambon', '#efTambonListbox')) == MAECHAI_TAMBONS

    page.select_option('#efAuthority', 'ทต.แม่ใจ')
    page.wait_for_timeout(120)
    page.locator('#efTambon').focus()
    page.wait_for_function("() => !document.querySelector('#efTambonListbox').hidden")
    names = page.locator('#efTambonListbox [role=option]').evaluate_all("els => els.map(e => e.dataset.value)")
    scopes = page.locator('#efTambonListbox [role=option]').evaluate_all("els => Object.fromEntries(els.map(e => [e.dataset.value, e.dataset.scope || '']))")
    assert names == ['แม่ใจ','ศรีถ้อย']
    assert 'ม.2, 3, 10 ทั้งหมู่' in scopes['แม่ใจ'] and 'ม.1, 5 บางพื้นที่' in scopes['แม่ใจ']
    assert 'ม.2, 3 ทั้งหมู่' in scopes['ศรีถ้อย'] and 'ม.1, 4, 7, 11 บางพื้นที่' in scopes['ศรีถ้อย']
    page.locator('#efTambon').press('Escape')

    page.click('.main-nav button[data-view="detail"]')
    page.wait_for_selector('#view-detail.active')
    page.select_option('#fDistrict', 'เมืองพะเยา')
    page.wait_for_timeout(100)
    assert set(option_values(page, '#fAuthority')) == MUEANG_AUTHORITIES
    assert set(combobox_values(page, '#fTambon', '#fTambonListbox')) == MUEANG_TAMBONS
    page.select_option('#fAuthority', 'อบต.แม่นาเรือ')
    page.wait_for_timeout(100)
    assert combobox_values(page, '#fTambon', '#fTambonListbox') == ['แม่นาเรือ']

    page.click('.tab-btn[data-tab="damaged"]')
    page.wait_for_selector('#panel-damaged.active')
    page.select_option('#dfDistrict', 'แม่ใจ')
    page.wait_for_timeout(100)
    assert set(option_values(page, '#dfAuthority')) == MAECHAI_AUTHORITIES
    assert set(combobox_values(page, '#dfTambon', '#dfTambonListbox')) == MAECHAI_TAMBONS

    result = page.evaluate("""() => {
      const A=window.AreaResponsibility;
      return {
        mae1:A.resolveAuthority({tambon:'แม่ใจ',moo:1}),
        mae2:A.resolveAuthority({tambon:'แม่ใจ',moo:2}),
        mae4:A.resolveAuthority({tambon:'แม่ใจ',moo:4}),
        sri4:A.resolveAuthority({tambon:'ศรีถ้อย',moo:4}),
        sri5:A.resolveAuthority({tambon:'ศรีถ้อย',moo:5}),
        ying1:A.resolveAuthority({tambon:'แม่อิง',moo:1}),
        ying4:A.resolveAuthority({tambon:'แม่อิง',moo:4})
      };
    }""")
    assert result['mae1']['authority'] is None and result['mae1']['confidence'] == 'ambiguous'
    assert result['mae2']['authority'] == 'ทต.แม่ใจ'
    assert result['mae4']['authority'] == 'ทต.รวมใจพัฒนา'
    assert result['sri4']['authority'] is None and result['sri4']['confidence'] == 'ambiguous'
    assert result['sri5']['authority'] == 'ทต.ศรีถ้อย'
    assert result['ying1']['authority'] == 'ทต.ดงเจน'
    assert result['ying4']['authority'] == 'อบต.แม่อิง'

    if page_errors:
        raise AssertionError('JavaScript page errors: ' + ' | '.join(page_errors))
    page.close()


def test_mobile(browser, width):
    page = browser.new_page(viewport={"width": width, "height": 900}, is_mobile=True)
    page_errors = []
    page.on('pageerror', lambda exc: page_errors.append(str(exc)))
    wait_ready(page)
    page.select_option('#efDistrict', 'เมืองพะเยา')
    page.wait_for_timeout(100)
    metrics = page.evaluate("""() => {
      const ids=['efDistrict','efAuthority','efTambonBox','efType','efReset'];
      const els=ids.map(id=>document.getElementById(id));
      return {viewport:innerWidth, boxes:els.map(el=>{const r=el.getBoundingClientRect();return {id:el.id,left:r.left,right:r.right,width:r.width};})};
    }""")
    for box in metrics['boxes']:
        assert box['left'] >= -1, (width, box)
        assert box['right'] <= width + 1, (width, box)
        assert box['width'] > 0, (width, box)
    bar = page.locator('.exec-filter-bar').bounding_box()
    assert bar and bar['x'] >= -1 and bar['x'] + bar['width'] <= width + 1
    if page_errors:
        raise AssertionError(f'{width}px JavaScript page errors: ' + ' | '.join(page_errors))
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
    print('PASS phase2_filter_playwright desktop + mobile 360/390/412')


if __name__ == '__main__':
    main()
