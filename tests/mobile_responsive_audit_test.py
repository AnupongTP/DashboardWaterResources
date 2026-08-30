#!/usr/bin/env python3
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
import importlib.util

ROOT=Path(__file__).resolve().parents[1]
SCREENSHOTS=ROOT/'tests'/'screenshots'
SCREENSHOTS.mkdir(parents=True,exist_ok=True)

spec=importlib.util.spec_from_file_location('dash_test', ROOT/'tests'/'playwright_dashboard_test.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
AUDIT_DATA=mod.BASE_DATA[:36]+mod.SYNTHETIC
HTML=mod.make_test_html(AUDIT_DATA)
TOTAL=len(AUDIT_DATA)

VIEWPORTS=[(360,800),(390,844),(412,915)]


def wait_ready(page):
    page.wait_for_function("([n]) => document.querySelector('#countNote') && document.querySelector('#countNote').textContent.includes(n.toLocaleString('th-TH'))", arg=[TOTAL], timeout=30000)


def doc_overflow(page):
    return page.evaluate('Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth')


def assert_in_view_width(page, selector, tolerance=2):
    vals=page.locator(selector).evaluate_all("els=>els.filter(e=>{const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'}).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,client:e.clientWidth,scroll:e.scrollWidth}})")
    vw=page.evaluate('window.innerWidth')
    for v in vals:
        assert v['left'] >= -tolerance, (selector,v,vw)
        assert v['right'] <= vw+tolerance, (selector,v,vw)




def assert_no_unintended_overflow(page):
    bad=page.evaluate(r"""() => {
      const vw=window.innerWidth, bad=[];
      const allowed='.tabs,.pivot-wrap,.tambon-compare-table-wrap,.tbl-wrap,.tambon-combobox-list,.mlc-panel,.leaflet-container,.leaflet-pane,.leaflet-map-pane,.leaflet-control-container,#chartModal,#siteCardModal,.modal-bg';
      for(const e of document.querySelectorAll('body *')){
        const s=getComputedStyle(e);
        if(s.display==='none'||s.visibility==='hidden'||s.position==='fixed') continue;
        if(e.closest(allowed)) continue;
        const r=e.getBoundingClientRect();
        if(r.width<1||r.height<1) continue;
        if(r.left < -3 || r.right > vw+3){
          bad.push({tag:e.tagName,id:e.id,cls:e.className&&String(e.className).slice(0,80),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),text:(e.innerText||'').trim().slice(0,80)});
          if(bad.length>=20) break;
        }
      }
      return bad;
    }""")
    assert not bad, bad

def click_tab(page,name):
    page.locator(f'.tab-btn[data-tab="{name}"]').click()
    page.wait_for_timeout(100)
    page.locator(f'#panel-{name}').scroll_into_view_if_needed()
    page.wait_for_timeout(100)


def audit(width,height,browser,results):
    ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=2,is_mobile=True,has_touch=True)
    ctx.route('**/*',lambda route: route.abort())
    page=ctx.new_page(); errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content(HTML,wait_until='domcontentloaded',timeout=30000);wait_ready(page)

    # Executive view
    assert doc_overflow(page)<=2,(width,'exec',doc_overflow(page))
    assert_in_view_width(page,'.app-header,.exec-wrap,.exec-filter-bar,.exec-hero,.exec-hero-map,.exec-hero-cards')
    assert_no_unintended_overflow(page)
    results.append({'viewport':width,'test':'executive_no_page_overflow','ok':True})

    # Detail view
    page.locator('.main-nav button[data-view="detail"]').click();page.wait_for_timeout(150)
    assert doc_overflow(page)<=2,(width,'detail-initial',doc_overflow(page))
    assert_in_view_width(page,'.detail-wrap,.body-section,.filters,.main,.tabs')

    # Pivot is allowed internal horizontal scroll and must expose explicit hint + sticky first col
    assert page.locator('.pivot-scroll-hint').is_visible()
    pvals=page.locator('.pivot-wrap').evaluate('(e)=>({client:e.clientWidth,scroll:e.scrollWidth})')
    assert pvals['scroll']>=pvals['client'],pvals
    sticky=page.locator('table.pivot thead th:first-child').evaluate("e=>({pos:getComputedStyle(e).position,left:getComputedStyle(e).left})")
    assert sticky['pos']=='sticky',sticky
    assert doc_overflow(page)<=2
    results.append({'viewport':width,'test':'pivot_internal_scroll_sticky_first_column','ok':True,'client':pvals['client'],'scroll':pvals['scroll']})

    # Tabs scroll internally; labels themselves are not clipped.
    assert page.locator('.mobile-tab-hint').is_visible()
    tabs=page.locator('.tabs').evaluate('(e)=>({client:e.clientWidth,scroll:e.scrollWidth})')
    assert tabs['scroll']>tabs['client'],tabs
    btns=page.locator('.tab-btn').evaluate_all("els=>els.map(e=>({text:e.innerText,client:e.clientWidth,scroll:e.scrollWidth}))")
    for b in btns:
        assert b['scroll']<=b['client']+2,b
    results.append({'viewport':width,'test':'tabs_internal_scroll_no_label_clipping','ok':True,'client':tabs['client'],'scroll':tabs['scroll']})

    # Overview
    click_tab(page,'overview')
    assert doc_overflow(page)<=2
    assert_in_view_width(page,'#panel-overview .panel,#panel-overview .grid2')
    assert_no_unintended_overflow(page)
    results.append({'viewport':width,'test':'overview_mobile_width','ok':True})

    # Compare: preserve original 10-column table and scroll inside the wrapper.
    click_tab(page,'tambon')
    assert page.locator('.tambon-compare-desktop').is_visible()
    assert page.locator('.tambon-compare-mobile').count()==0 or page.locator('.tambon-compare-mobile').evaluate("e=>getComputedStyle(e).display")=='none'
    hint=page.locator('#panel-tambon .table-scroll-hint')
    assert hint.is_visible()
    cvals=page.locator('.tambon-compare-table-wrap').evaluate('(e)=>({client:e.clientWidth,scroll:e.scrollWidth})')
    assert cvals['scroll']>cvals['client'],cvals
    moved=page.locator('.tambon-compare-table-wrap').evaluate('(e)=>{e.scrollLeft=e.scrollWidth;return e.scrollLeft}')
    assert moved>0,moved
    assert page.locator('.tambon-compare-table thead th').count()==10
    assert page.locator('.tambon-compare-table tbody tr').count()>0
    sticky=page.locator('.tambon-compare-table thead th:first-child').evaluate("e=>({pos:getComputedStyle(e).position,left:getComputedStyle(e).left})")
    assert sticky['pos']=='sticky',sticky
    assert doc_overflow(page)<=2
    assert_no_unintended_overflow(page)
    page.screenshot(path=str(SCREENSHOTS/f'mobile-{width}-compare-v1.4.6.png'),full_page=False)
    results.append({'viewport':width,'test':'tambon_compare_original_table_internal_scroll','ok':True,'client':cvals['client'],'scroll':cvals['scroll']})

    # Data table: preserve all 12 columns, header visible, local horizontal scroll only.
    click_tab(page,'table')
    assert page.locator('#panel-table table.data-tbl thead').is_visible()
    assert page.locator('#panel-table table.data-tbl thead th').count()==12
    tvals=page.locator('#panel-table .tbl-wrap').evaluate('(e)=>({client:e.clientWidth,scroll:e.scrollWidth})')
    assert tvals['scroll']>tvals['client'],tvals
    tmoved=page.locator('#panel-table .tbl-wrap').evaluate('(e)=>{e.scrollLeft=e.scrollWidth;return e.scrollLeft}')
    assert tmoved>0,tmoved
    assert page.locator('#panel-table .table-scroll-hint').is_visible()
    assert page.locator('#tblBody tr').count()>0
    assert doc_overflow(page)<=2
    assert_no_unintended_overflow(page)
    results.append({'viewport':width,'test':'data_table_original_columns_internal_scroll','ok':True,'client':tvals['client'],'scroll':tvals['scroll']})
    if width==390:
        page.screenshot(path=str(SCREENSHOTS/'mobile-390-table-v1.4.6.png'),full_page=False)

    # Gallery
    click_tab(page,'gallery')
    assert_in_view_width(page,'#panel-gallery .panel,#galleryGrid,.gcard')
    assert_no_unintended_overflow(page)
    assert doc_overflow(page)<=2
    results.append({'viewport':width,'test':'gallery_mobile_width','ok':True})

    # Damaged: stacked filters + map + original 10-column table with local horizontal scroll.
    click_tab(page,'damaged');page.wait_for_timeout(250)
    assert_in_view_width(page,'#panel-damaged .panel,.damage-filter-bar,#damaged-map')
    assert page.locator('#panel-damaged table.data-tbl thead').is_visible()
    assert page.locator('#panel-damaged table.data-tbl thead th').count()==10
    dvals=page.locator('#panel-damaged .tbl-wrap').evaluate('(e)=>({client:e.clientWidth,scroll:e.scrollWidth})')
    assert dvals['scroll']>dvals['client'],dvals
    dmoved=page.locator('#panel-damaged .tbl-wrap').evaluate('(e)=>{e.scrollLeft=e.scrollWidth;return e.scrollLeft}')
    assert dmoved>0,dmoved
    assert page.locator('#panel-damaged .table-scroll-hint').is_visible()
    assert_no_unintended_overflow(page)
    assert doc_overflow(page)<=2
    page.screenshot(path=str(SCREENSHOTS/f'mobile-{width}-damaged-v1.4.6.png'),full_page=False)
    results.append({'viewport':width,'test':'damaged_original_table_internal_scroll','ok':True,'client':dvals['client'],'scroll':dvals['scroll']})

    # Modal responsive audit with a synthetic visible record.
    click_tab(page,'table')
    # invoke existing modal function directly with first record to avoid relying on table click behavior
    page.evaluate("() => { if (typeof openModal==='function') openModal(RAW[0]); }")
    if page.locator('#modalBg.open').count():
        assert_in_view_width(page,'#modalBg .modal')
        assert doc_overflow(page)<=2
        page.locator('#modalBg').evaluate("e=>e.classList.remove('open')")
    
    assert not errors,(width,errors)
    results.append({'viewport':width,'test':'no_uncaught_mobile_errors','ok':True})
    ctx.close()


def main():
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium')
        for w,h in VIEWPORTS:
            audit(w,h,browser,results)
        browser.close()
    out=ROOT/'tests'/'mobile-responsive-audit-results.json'
    out.write_text(json.dumps({'ok':True,'viewports':[w for w,_ in VIEWPORTS],'results':results},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'ok':True,'tests':len(results),'viewports':[w for w,_ in VIEWPORTS]},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
