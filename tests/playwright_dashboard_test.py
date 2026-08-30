#!/usr/bin/env python3
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
SCREENSHOTS = ROOT / 'tests' / 'screenshots'
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
BASE_DATA = json.loads((SITE / 'data' / 'waterresources.initial.json').read_text(encoding='utf-8'))
INDEX = (SITE / 'index.html').read_text(encoding='utf-8')
AREA_JS = (SITE / 'assets' / 'area-responsibility.js').read_text(encoding='utf-8')
COMBO_JS = (SITE / 'assets' / 'tambon-combobox.js').read_text(encoding='utf-8')

MASTER_TAMBONS = [
    'แม่กา','แม่นาเรือ','แม่ใส','บ้านตุ่น','บ้านสาง','สันป่าม่วง','บ้านต๋อม','บ้านต๊ำ','ท่าจำปี','เทศบาลเมือง',
    'เจริญราษฎร์','แม่ปืม','แม่สุก','ป่าแฝก','บ้านเหล่า','บ้านใหม่','แม่ใจ','ศรีถ้อย',
    'สว่างอารมณ์','บุญเกิด','ดอกคำใต้','ดอนศรีชุม','คือเวียง','บ้านปิน','จำป่าหวาย','บ้านถ้ำ','แม่อิง','สันโค้ง','ดงเจน'
]


def rec(i, tambon, moo, name, owner='ทดสอบ', village='ทดสอบ', problem='ใช้งานได้', local_authority=None):
    item = {
        'id': i, 'dt': '2026-08-25 01:00', 'lat': 19.1 + (i % 9) * .001,
        'lng': 99.9 + (i % 9) * .001, 'name': name, 'owner': owner,
        'phone': None, 'type': 'ฝาย', 'width': 1, 'length': 1, 'depth': 1,
        'depthnet': 1, 'tambon': tambon, 'village': village, 'moo': moo,
        'problem': problem, 'imglink': None, 'volume': 1, 'note': None,
        'status': 'ตรวจสอบแล้ว'
    }
    if local_authority is not None:
        item['localAuthority'] = local_authority
    return item


SYNTHETIC = [
    rec(30001, 'สว่างอารมณ์', 1, 'ทม.ดอกคำใต้-สว่างอารมณ์'),
    rec(30002, 'บุญเกิด', 1, 'ทม.ดอกคำใต้-บุญเกิด'),
    rec(30003, 'ดอกคำใต้', 7, 'ทม.ดอกคำใต้-หมู่7'),
    rec(30004, 'ดอกคำใต้', 5, 'อบต.ดอกคำใต้-หมู่5'),
    # WaterOwner intentionally looks authoritative: resolver must still not guess an overlapping moo.
    rec(30005, 'ดอกคำใต้', 1, 'ดอกคำใต้-หมู่1-เขตซ้อน', 'เทศบาลเมืองดอกคำใต้'),
    rec(30006, 'ดอนศรีชุม', 8, 'ดอนศรีชุม-หมู่8-บางส่วน', 'อบต.ดอนศรีชุม'),
    # New LocalAuthority field resolves overlap only when explicitly supplied and compatible.
    rec(30025, 'ดอกคำใต้', 1, 'ดอกคำใต้-หมู่1-ทม-ยืนยันแล้ว', local_authority='ทม.ดอกคำใต้'),
    rec(30026, 'ดอกคำใต้', 2, 'ดอกคำใต้-หมู่2-อบต-ยืนยันแล้ว', local_authority='อบต.ดอกคำใต้'),
    rec(30027, 'ดอนศรีชุม', 8, 'ดอนศรีชุม-หมู่8-ทม-ยืนยันแล้ว', local_authority='ทม.ดอกคำใต้'),
    rec(30028, 'ดอนศรีชุม', 9, 'ดอนศรีชุม-หมู่9-อบต-ยืนยันแล้ว', local_authority='อบต.ดอนศรีชุม'),
    # Allowed authority name but incompatible Tambon+Moo: browser resolver must reject it.
    rec(30029, 'ดอกคำใต้', 1, 'ดอกคำใต้-หมู่1-อปทผิด', local_authority='อบต.แม่อิง'),
    # v1.2: a single exact mapping is only a suggestion; explicit same-tambon overrides are valid.
    rec(30030, 'ดอกคำใต้', 3, 'ดอกคำใต้-หมู่3-override-ทม', local_authority='ทม.ดอกคำใต้'),
    rec(30031, 'ดอกคำใต้', 7, 'ดอกคำใต้-หมู่7-override-อบต', local_authority='อบต.ดอกคำใต้'),
    rec(30032, 'ดอนศรีชุม', 4, 'ดอนศรีชุม-หมู่4-override-ทม', local_authority='ทม.ดอกคำใต้'),
    rec(30033, 'แม่อิง', 2, 'แม่อิง-หมู่2-override-อบต', local_authority='อบต.แม่อิง'),
    rec(30034, 'แม่อิง', 5, 'แม่อิง-หมู่5-override-ทตดงเจน', local_authority='ทต.ดงเจน'),
    # v1.2 still rejects cross-tambon values and explicit authority on an unmapped moo.
    rec(30035, 'ดอกคำใต้', 3, 'ดอกคำใต้-หมู่3-cross-invalid', local_authority='อบต.แม่อิง'),
    rec(30036, 'ดงเจน', 6, 'ดงเจน-หมู่6-explicit-invalid', local_authority='ทต.ดงเจน'),
    rec(30007, 'ดอนศรีชุม', 4, 'อบต.ดอนศรีชุม-หมู่4'),
    rec(30008, 'แม่อิง', 5, 'อบต.แม่อิง-หมู่5'),
    rec(30009, 'แม่อิง', 2, 'ทต.ดงเจน-แม่อิงหมู่2'),
    rec(30010, 'บ้านปิน', 1, 'บ้านปิน-ชื่อมาตรฐาน'),
    rec(30011, 'ดงเจน', 16, 'ทต.ดงเจน-หมู่16', village='บ้านเจน'),
    rec(30012, 'ดงเจน', 6, 'ดงเจน-หมู่6-นอกบัญชี'),
    rec(30014, 'จำป่าหวาย', 1, 'อบต.จำป่าหวาย'),
    rec(30015, 'บ้านถ้ำ', 1, 'ทต.บ้านถ้ำ'),
    rec(30016, 'สันโค้ง', 1, 'อบต.สันโค้ง-ชำรุด', problem='ชำรุด'),
    # 8 original CONFIG tambons that were previously omitted from the 21-tambon cache whitelist.
    rec(30017, 'เจริญราษฎร์', 1, 'เจริญราษฎร์-ทดสอบ'),
    rec(30018, 'แม่ปืม', 1, 'แม่ปืม-ทดสอบ'),
    rec(30019, 'แม่สุก', 1, 'แม่สุก-ทดสอบ'),
    rec(30020, 'ป่าแฝก', 1, 'ป่าแฝก-ทดสอบ'),
    rec(30021, 'บ้านเหล่า', 1, 'บ้านเหล่า-ทดสอบ'),
    rec(30022, 'บ้านใหม่', 1, 'บ้านใหม่-ทดสอบ'),
    rec(30023, 'แม่ใจ', 1, 'แม่ใจ-ทดสอบ'),
    rec(30024, 'ศรีถ้อย', 1, 'ศรีถ้อย-ทดสอบ'),
]
TEST_DATA = BASE_DATA + SYNTHETIC
TOTAL = len(TEST_DATA)


def make_test_html(data):
    html = INDEX
    stub = '<script>window.__TEST_DATA__=' + json.dumps(data, ensure_ascii=False) + ';window.WaterData={load:async()=>window.__TEST_DATA__};</script>'
    html = html.replace('<script src="./assets/runtime-config.js"></script>', '')
    html = html.replace('<script src="./assets/water-data-loader.js"></script>', stub)
    html = html.replace('<script src="./assets/area-responsibility.js"></script>', '<script>' + AREA_JS + '</script>')
    html = html.replace('<script src="./assets/tambon-combobox.js"></script>', '<script>' + COMBO_JS + '</script>')
    html = html.replace('<link rel="preconnect" href="https://fonts.googleapis.com">', '')
    html = html.replace('<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">', '')
    return html


def wait_ready(page):
    page.wait_for_function(
        "([n]) => document.querySelector('#countNote') && document.querySelector('#countNote').textContent.includes(n.toLocaleString('th-TH'))",
        arg=[TOTAL], timeout=30000
    )


def wait_detail_count(page, n):
    page.wait_for_function(
        "([shown,total]) => { const e=document.querySelector('#countNote'); if(!e)return false; const t=e.textContent; return t.includes(shown.toLocaleString('th-TH')+' จาก '+total.toLocaleString('th-TH')); }",
        arg=[n, TOTAL], timeout=10000
    )


def open_combo(page, input_id):
    page.locator('#' + input_id).click()
    page.wait_for_function("id => document.querySelector('#'+id).getAttribute('aria-expanded') === 'true'", arg=input_id)


def combo_options(page, listbox_id):
    return page.locator(f'#{listbox_id} [role="option"]').evaluate_all("els => els.map(e => e.dataset.value)")


def combo_scope(page, listbox_id, value):
    return page.locator(f'#{listbox_id} [role="option"][data-value="{value}"]').get_attribute('data-scope')


def choose_combo(page, input_id, listbox_id, query, value):
    page.locator('#' + input_id).fill(query)
    page.wait_for_function(
        "([listbox,value]) => [...document.querySelectorAll('#'+listbox+' [role=option]')].some(x=>x.dataset.value===value)",
        arg=[listbox_id, value]
    )
    page.locator(f'#{listbox_id} [role="option"][data-value="{value}"]').click()
    assert page.locator('#' + input_id).input_value() == value
    assert page.locator('#' + input_id).get_attribute('aria-invalid') == 'false'


def main():
    results = []
    html = make_test_html(TEST_DATA)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')

        # ---------- Desktop ----------
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        context.route('**/*', lambda route: route.abort())
        page = context.new_page()
        page_errors = []
        page.on('pageerror', lambda e: page_errors.append(str(e)))
        page.set_content(html, wait_until='domcontentloaded', timeout=30000)
        wait_ready(page)

        # 1. All three Tambon controls are custom combobox inputs, not free-form selects.
        for input_id in ('efTambon', 'fTambon', 'dfTambon'):
            assert page.locator('#' + input_id).evaluate('(e)=>e.tagName') == 'INPUT'
            assert page.locator('#' + input_id).get_attribute('role') == 'combobox'
            assert page.locator('#' + input_id).get_attribute('aria-autocomplete') == 'list'
        assert page.locator('select#efTambon,select#fTambon,select#dfTambon').count() == 0
        results.append({'test': 'tambon_controls_are_custom_allowlist_comboboxes', 'ok': True})

        # 2. Master list contains exactly the user-approved 29 tambons in the approved order.
        open_combo(page, 'efTambon')
        options = combo_options(page, 'efTambonListbox')
        page.screenshot(path=str(SCREENSHOTS / 'desktop-autocomplete-open-final.png'), full_page=False)
        assert options == MASTER_TAMBONS, options
        assert 'บ้านปิ่น' not in options and 'บ้านปิน' in options
        page.locator('#efTambon').press('Escape')
        results.append({'test': 'master_tambon_list_exact_29', 'ok': True, 'count': len(options)})

        # 2b. Authority dropdowns show only authorities with resolved data from the full dataset.
        expected_active = [
            'ทม.ดอกคำใต้','อบต.บ้านปิน','อบต.ดอกคำใต้','อบต.จำป่าหวาย','ทต.บ้านถ้ำ',
            'อบต.ดอนศรีชุม','อบต.แม่อิง','ทต.ดงเจน','อบต.สันโค้ง'
        ]
        exec_authorities = page.locator('#efAuthority option').evaluate_all("els => els.slice(1).map(e => e.value)")
        assert exec_authorities == expected_active, exec_authorities
        assert 'อบต.คือเวียง' not in exec_authorities
        assert '__UNRESOLVED__' not in exec_authorities
        results.append({'test': 'zero_count_authorities_hidden_from_dropdown', 'ok': True, 'authorities': exec_authorities})

        # 3. Search recommendation works: "แม่" narrows to seven allowed names, still in master order.
        page.locator('#efTambon').fill('แม่')
        expected_mae = ['แม่กา','แม่นาเรือ','แม่ใส','แม่ปืม','แม่สุก','แม่ใจ','แม่อิง']
        assert combo_options(page, 'efTambonListbox') == expected_mae
        results.append({'test': 'tambon_search_recommendations_filter_master_list', 'ok': True, 'options': expected_mae})

        # 4. Free text is rejected: typing without choosing a recommendation never becomes a filter.
        page.locator('#efTambon').fill('แม่สุ')
        page.locator('#efType').focus()  # force blur without selecting recommendation
        page.wait_for_timeout(180)
        assert page.locator('#efTambon').get_attribute('aria-invalid') == 'true'
        assert page.locator('#efTambonError').is_visible()
        assert 'กรุณาเลือกตำบลจากรายการที่กำหนด' in page.locator('#efTambonError').inner_text()
        assert 'แม่สุ' not in page.locator('#efCount').inner_text()
        results.append({'test': 'free_text_is_rejected_and_never_filters', 'ok': True})

        # Clear invalid text and explicitly select แม่สุก from recommendation.
        page.locator('#efTambonClear').click()
        choose_combo(page, 'efTambon', 'efTambonListbox', 'แม่สุ', 'แม่สุก')
        page.wait_for_function("document.querySelector('#efCount').textContent.includes('1 รายการ')")
        results.append({'test': 'explicit_recommendation_selection_applies_filter', 'ok': True})

        # 5. Authority cascade limits recommendations, not just result data.
        page.locator('#efAuthority').select_option('ทม.ดอกคำใต้')
        page.wait_for_function("document.querySelector('#efCount').textContent.includes('7 รายการ')")
        open_combo(page, 'efTambon')
        authority_options = combo_options(page, 'efTambonListbox')
        assert authority_options == ['สว่างอารมณ์', 'บุญเกิด', 'ดอกคำใต้', 'ดอนศรีชุม'], authority_options
        assert combo_scope(page, 'efTambonListbox', 'สว่างอารมณ์') is None
        assert combo_scope(page, 'efTambonListbox', 'บุญเกิด') is None
        assert combo_scope(page, 'efTambonListbox', 'ดอกคำใต้') == 'ม.1, 2, 7'
        assert combo_scope(page, 'efTambonListbox', 'ดอนศรีชุม') == 'ม.1, 5, 7, 10 ทั้งหมู่ · ม.8, 9 บางพื้นที่'
        results.append({'test': 'authority_tambon_dropdown_hides_full_tambon_suffix_and_shows_partial_moo_scope', 'ok': True})
        choose_combo(page, 'efTambon', 'efTambonListbox', 'ดอก', 'ดอกคำใต้')
        page.wait_for_function("document.querySelector('#efCount').textContent.includes('3 รายการ')")
        results.append({'test': 'executive_authority_cascade_limits_combobox_scope', 'ok': True, 'tambons': authority_options})

        # 6. Attempting an out-of-authority tambon shows no allowed recommendation and cannot apply.
        page.locator('#efTambon').fill('แม่สุก')
        assert page.locator('#efTambonListbox [role="option"]').count() == 0
        assert page.locator('#efTambonListbox').inner_text().strip() == 'ไม่พบตำบลในรายการที่กำหนด'
        page.locator('#efType').focus(); page.wait_for_timeout(180)
        assert page.locator('#efTambon').get_attribute('aria-invalid') == 'true'
        # Selected filter was cleared when user edited it, so only authority filter remains = 7 resolved records.
        page.wait_for_function("document.querySelector('#efCount').textContent.includes('7 รายการ')")
        results.append({'test': 'out_of_authority_text_cannot_be_selected', 'ok': True})

        # Reset executive before detail tests.
        page.locator('#efReset').click()

        # 7. Detail cascade v1.2: อบต.แม่อิง can be explicitly confirmed for any mapped แม่อิง moo 1-8.
        page.locator('.main-nav button[data-view="detail"]').click()
        page.locator('#fAuthority').select_option('อบต.แม่อิง')
        open_combo(page, 'fTambon')
        assert combo_options(page, 'fTambonListbox') == ['แม่อิง']
        choose_combo(page, 'fTambon', 'fTambonListbox', 'แม่', 'แม่อิง')
        moos = page.locator('#fMoo option').all_text_contents()
        assert moos == ['ทั้งหมด'] + [f'หมู่ {i}' for i in range(1,9)], moos
        wait_detail_count(page, 2)
        page.locator('#fMoo').select_option('2')
        wait_detail_count(page, 1)
        assert 'แม่อิง-หมู่2-override-อบต' in page.locator('#tblBody').inner_text()
        page.locator('#fMoo').select_option('5')
        wait_detail_count(page, 1)
        assert page.locator('#tblBody tr td:nth-child(2)').first.inner_text() == 'อบต.แม่อิง-หมู่5'
        results.append({'test': 'detail_authority_tambon_moo_cascade_v12', 'ok': True, 'moos': moos})

        # 8. Canonical บ้านปิน path uses combobox and never exposes legacy spelling.
        page.locator('#fAuthority').select_option('อบต.บ้านปิน')
        open_combo(page, 'fTambon')
        assert combo_options(page, 'fTambonListbox') == ['บ้านปิน']
        choose_combo(page, 'fTambon', 'fTambonListbox', 'บ้านป', 'บ้านปิน')
        wait_detail_count(page, 1)
        row = page.locator('#tblBody tr').first.inner_text()
        assert 'บ้านปิน-ชื่อมาตรฐาน' in row and 'บ้านปิน' in row and 'บ้านปิ่น' not in row
        results.append({'test': 'ban_pin_canonical_combobox_path', 'ok': True})

        # 9. v1.2 cascade exposes valid master moos, while actual filtering still uses resolved records only.
        page.locator('#fAuthority').select_option('อบต.ดอกคำใต้')
        choose_combo(page, 'fTambon', 'fTambonListbox', 'ดอก', 'ดอกคำใต้')
        moo_values = page.locator('#fMoo option').evaluate_all("els => els.map(e => e.value)")
        assert moo_values == [''] + [str(i) for i in range(1,11)], moo_values
        assert 'ต้องยืนยันเขต' not in ' '.join(page.locator('#fMoo option').all_text_contents())

        # Exact-overlap legacy row is still unassigned; the master option can exist but returns zero until explicitly confirmed.
        page.locator('#fMoo').select_option('1')
        wait_detail_count(page, 0)
        assert 'ดอกคำใต้-หมู่1-เขตซ้อน' not in page.locator('#tblBody').inner_text()

        # Explicit SELECT field resolves overlap.
        page.locator('#fMoo').select_option('2')
        wait_detail_count(page, 1)
        assert 'ดอกคำใต้-หมู่2-อบต-ยืนยันแล้ว' in page.locator('#tblBody').inner_text()
        results.append({'test': 'select_mode_requires_explicit_localauthority_for_overlap', 'ok': True})

        # SUGGEST mode override: ดอกคำใต้ ม.7 recommends ทม. but explicit อบต. must be accepted.
        page.locator('#fMoo').select_option('7')
        wait_detail_count(page, 1)
        assert 'ดอกคำใต้-หมู่7-override-อบต' in page.locator('#tblBody').inner_text()
        assert 'ทม.ดอกคำใต้-หมู่7' not in page.locator('#tblBody').inner_text()
        results.append({'test': 'suggest_mode_explicit_same_tambon_override_is_respected', 'ok': True})

        # Reverse override: ดอกคำใต้ ม.3 recommends อบต. but explicit ทม. must be accepted.
        page.locator('#fAuthority').select_option('ทม.ดอกคำใต้')
        choose_combo(page, 'fTambon', 'fTambonListbox', 'ดอก', 'ดอกคำใต้')
        page.locator('#fMoo').select_option('3')
        wait_detail_count(page, 1)
        table_text = page.locator('#tblBody').inner_text()
        assert 'ดอกคำใต้-หมู่3-override-ทม' in table_text
        assert 'ดอกคำใต้-หมู่3-cross-invalid' not in table_text
        results.append({'test': 'recommended_authority_does_not_override_confirmed_field', 'ok': True})

        # Same v1.2 policy applies to Don Si Chum: every mapped moo is a valid candidate under both local authorities,
        # but only resolved records appear in results.
        choose_combo(page, 'fTambon', 'fTambonListbox', 'ดอน', 'ดอนศรีชุม')
        moo_values = page.locator('#fMoo option').evaluate_all("els => els.map(e => e.value)")
        assert moo_values == [''] + [str(i) for i in range(1,11)], moo_values
        page.locator('#fMoo').select_option('4')
        wait_detail_count(page, 1)
        assert 'ดอนศรีชุม-หมู่4-override-ทม' in page.locator('#tblBody').inner_text()
        page.locator('#fMoo').select_option('9')
        wait_detail_count(page, 0)
        results.append({'test': 'don_si_chum_v12_override_and_zero_result_filter_are_consistent', 'ok': True})

        # 10. Dong Jen shows village names supplied in the brief.
        page.locator('#fAuthority').select_option('ทต.ดงเจน')
        open_combo(page, 'fTambon')
        assert combo_options(page, 'fTambonListbox') == ['แม่อิง', 'ดงเจน']
        choose_combo(page, 'fTambon', 'fTambonListbox', 'ดง', 'ดงเจน')
        dongjen_moos = page.locator('#fMoo option').all_text_contents()
        assert 'หมู่ 1 — บ้านกว๊านกลาง' in dongjen_moos
        assert 'หมู่ 12 — บ้านกว๊านใต้ร่วมใจ' in dongjen_moos
        assert 'หมู่ 16 — บ้านเจน' in dongjen_moos
        results.append({'test': 'dongjen_moo_labels_include_brief_village_names', 'ok': True})

        # 11. No unresolved bucket exists in UI; old ambiguous/invalid records remain visible by Tambon but are not assigned.
        authority_values = page.locator('#fAuthority option').evaluate_all("els => els.map(e => e.value)")
        assert '__UNRESOLVED__' not in authority_values
        assert 'อบต.คือเวียง' not in authority_values  # zero resolved records => hidden
        assert 'ทต.ดงเจน' in authority_values

        page.locator('#fAuthority').select_option('')
        choose_combo(page, 'fTambon', 'fTambonListbox', 'ดอก', 'ดอกคำใต้')
        page.locator('#fMoo').select_option('1')
        wait_detail_count(page, 3)
        all_m1 = page.locator('#tblBody').inner_text()
        assert 'ดอกคำใต้-หมู่1-เขตซ้อน' in all_m1
        assert 'ดอกคำใต้-หมู่1-ทม-ยืนยันแล้ว' in all_m1
        assert 'ดอกคำใต้-หมู่1-อปทผิด' in all_m1
        assert 'ต้องยืนยันเขต' not in all_m1

        page.locator('#fAuthority').select_option('ทม.ดอกคำใต้')
        choose_combo(page, 'fTambon', 'fTambonListbox', 'ดอก', 'ดอกคำใต้')
        page.locator('#fMoo').select_option('1')
        wait_detail_count(page, 1)
        authority_m1 = page.locator('#tblBody').inner_text()
        assert 'ดอกคำใต้-หมู่1-ทม-ยืนยันแล้ว' in authority_m1
        assert 'ดอกคำใต้-หมู่1-เขตซ้อน' not in authority_m1
        assert 'ดอกคำใต้-หมู่1-อปทผิด' not in authority_m1
        results.append({'test': 'unresolved_ui_removed_and_invalid_records_never_authority_counted', 'ok': True})

        # 12. No-authority detail master list also exposes all 29, including the previously omitted eight.
        page.locator('#fAuthority').select_option('')
        open_combo(page, 'fTambon')
        assert combo_options(page, 'fTambonListbox') == MASTER_TAMBONS
        choose_combo(page, 'fTambon', 'fTambonListbox', 'แม่สุ', 'แม่สุก')
        wait_detail_count(page, 1)
        assert 'แม่สุก-ทดสอบ' in page.locator('#tblBody').inner_text()
        results.append({'test': 'previously_omitted_eight_are_selectable', 'ok': True})

        # 13. Damaged tab uses the same strict combobox and its own independent filter state.
        page.locator('.tab-btn[data-tab="damaged"]').click()
        damaged_authorities = page.locator('#dfAuthority option').evaluate_all("els => els.slice(1).map(e => e.value)")
        assert 'อบต.คือเวียง' not in damaged_authorities
        assert '__UNRESOLVED__' not in damaged_authorities
        page.locator('#dfAuthority').select_option('อบต.สันโค้ง')
        open_combo(page, 'dfTambon')
        assert combo_options(page, 'dfTambonListbox') == ['สันโค้ง']
        choose_combo(page, 'dfTambon', 'dfTambonListbox', 'สัน', 'สันโค้ง')
        page.wait_for_function("document.querySelector('#n-damaged-list').textContent.includes('1 รายการ')")
        assert 'อบต.สันโค้ง-ชำรุด' in page.locator('#damagedBody').inner_text()
        results.append({'test': 'damaged_tab_strict_combobox_and_independent_filter', 'ok': True})

        # 14. Reset restores full dataset and clears visible combobox text/state.
        page.locator('.tab-btn[data-tab="table"]').click()
        page.locator('#resetBtn').click()
        wait_detail_count(page, TOTAL)
        assert page.locator('#fAuthority').input_value() == ''
        assert page.locator('#fTambon').input_value() == ''
        assert page.locator('#fTambon').get_attribute('aria-invalid') == 'false'
        results.append({'test': 'detail_reset_restores_all_data_and_combobox_state', 'ok': True})

        # 15. Keyboard selection: ArrowDown + Enter chooses an allowed recommendation.
        page.locator('#fTambon').fill('ศรีถ')
        page.locator('#fTambon').press('ArrowDown')
        page.locator('#fTambon').press('Enter')
        assert page.locator('#fTambon').input_value() == 'ศรีถ้อย'
        wait_detail_count(page, 1)
        results.append({'test': 'keyboard_navigation_selects_allowed_tambon', 'ok': True})

        page.screenshot(path=str(SCREENSHOTS / 'desktop-29tambons-autocomplete-final.png'), full_page=False)
        assert not page_errors, page_errors
        results.append({'test': 'desktop_no_uncaught_page_errors', 'ok': True})
        context.close()

        # ---------- Mobile ----------
        mobile = browser.new_context(
            viewport={'width': 390, 'height': 844}, device_scale_factor=2,
            is_mobile=True, has_touch=True
        )
        mobile.route('**/*', lambda route: route.abort())
        page = mobile.new_page()
        mobile_errors = []
        page.on('pageerror', lambda e: mobile_errors.append(str(e)))
        page.set_content(html, wait_until='domcontentloaded', timeout=30000)
        wait_ready(page)

        assert page.locator('#efTambon').is_visible()
        exec_combo_width = page.locator('#efTambonBox').evaluate('(e)=>e.getBoundingClientRect().width')
        overflow = page.evaluate('document.documentElement.scrollWidth-window.innerWidth')
        assert exec_combo_width <= 358, exec_combo_width
        assert overflow <= 2, overflow

        # Mobile tap selection from suggestions.
        page.locator('.main-nav button[data-view="detail"]').click()
        page.locator('#fTambon').fill('แม่สุ')
        option = page.locator('#fTambonListbox [role="option"]', has_text='แม่สุก').first
        assert option.is_visible()
        page.screenshot(path=str(SCREENSHOTS / 'mobile-autocomplete-open-final.png'), full_page=False)
        option.tap()
        assert page.locator('#fTambon').input_value() == 'แม่สุก'
        wait_detail_count(page, 1)
        assert page.locator('#fMoo').is_visible()

        page.screenshot(path=str(SCREENSHOTS / 'mobile-29tambons-autocomplete-final.png'), full_page=False)
        assert not mobile_errors, mobile_errors
        results.append({
            'test': 'mobile_combobox_tap_no_horizontal_overflow', 'ok': True,
            'comboWidth': exec_combo_width, 'horizontalOverflowPx': overflow
        })
        mobile.close()
        browser.close()

    out = ROOT / 'tests' / 'playwright-results.json'
    out.write_text(json.dumps({
        'ok': True,
        'masterTambonCount': len(MASTER_TAMBONS),
        'baseDatasetCount': len(BASE_DATA),
        'syntheticRecordCount': len(SYNTHETIC),
        'testDatasetCount': TOTAL,
        'results': results
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'ok': True, 'tests': [r['test'] for r in results]}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
