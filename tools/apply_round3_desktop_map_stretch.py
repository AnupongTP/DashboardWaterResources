from pathlib import Path

path = Path('site/index.html')
text = path.read_text(encoding='utf-8')

css_marker = "/* ROUND3_DESKTOP_MAP_STRETCH */"
observer_marker = "/* ROUND3_HERO_MAP_RESIZE_OBSERVER */"

if css_marker not in text:
    anchor = "@media (max-width:980px){.exec-hero-cards,.exec-hero-map{flex-basis:100%;min-width:0;}.exec-hero-map .map-stage,.exec-hero-map #map{min-height:380px;}}"
    if text.count(anchor) != 1:
        raise SystemExit(f'Expected exactly one desktop/mobile hero-map media anchor, found {text.count(anchor)}')
    replacement = (
        css_marker + "\n"
        "/* Desktop only: the map card follows the actual height of the KPI + Top-10 column.\n"
        "   The map-stage is already flex:1, so the extra space becomes usable map area rather\n"
        "   than an empty block below the map. Mobile/tablet keep their existing fixed minimum. */\n"
        "@media (min-width:981px){.exec-hero-map{align-self:stretch;}}\n"
        + anchor
    )
    text = text.replace(anchor, replacement, 1)

if observer_marker not in text:
    anchor = """(function(){
  var t;
  window.addEventListener('resize', function(){
    clearTimeout(t);
    t = setTimeout(function(){ if(map) map.invalidateSize(); }, 200);
  });
})();
"""
    if text.count(anchor) != 1:
        raise SystemExit(f'Expected exactly one map window-resize guard, found {text.count(anchor)}')
    replacement = anchor + """
""" + observer_marker + """
/* When the KPI column changes height (Top 10 expand/collapse or filters), the desktop
   flex row can change the map container height without a window resize. Observe only
   the hero map stage and ask Leaflet to recalculate after layout settles. */
(function(){
  var stage = document.getElementById('heroMapStage');
  if(!stage || typeof ResizeObserver === 'undefined') return;
  var timer = null;
  var observer = new ResizeObserver(function(){
    clearTimeout(timer);
    timer = setTimeout(function(){ if(map) map.invalidateSize({pan:false}); }, 90);
  });
  observer.observe(stage);
  window.__heroMapResizeObserver = observer;
})();
"""
    text = text.replace(anchor, replacement, 1)

path.write_text(text, encoding='utf-8')
print('ROUND3 MAP STRETCH PATCH OK')
