/* Keep record popups inside short/mobile maps without recreating their images. */
(function (root) {
  'use strict';
  const maps = new WeakMap();

  function bind(marker, map, content, options = {}) {
    if (!maps.has(map)) {
      const state = {popup: null};
      maps.set(map, state);
      map.on('popupopen', event => { state.popup = event.popup; });
      map.on('popupclose', event => {
        if (state.popup === event.popup) state.popup = null;
      });
      map.on('resize', () => {
        if (state.popup?.isOpen() && state.popup.options.waterMapPopup) state.popup.update();
      });
    }
    let node;
    marker.bindPopup(function () {
      const popup = marker.getPopup();
      const size = map.getSize();
      // Reserve room for the wrapper, tip, marker anchor and auto-pan padding.
      popup.options.maxHeight = Math.max(60, size.y - 100);
      popup.options.maxWidth = Math.max(80, Math.min(options.maxWidth || 300, size.x - 50));
      popup.options.minWidth = Math.min(options.minWidth || 50, popup.options.maxWidth);
      if (!node) {
        const value = typeof content === 'function' ? content(marker) : content;
        if (typeof value === 'string') {
          node = document.createElement('div');
          node.innerHTML = value;
          for (const child of node.children) child.style.maxWidth = '100%';
        } else node = value;
        node.style.overflowWrap = 'anywhere';
      }
      const viewport = popup.getElement()?.querySelector('.leaflet-popup-content');
      if (viewport) viewport.style.overscrollBehavior = 'contain';
      return node;
    }, {...options, waterMapPopup: true});
    return marker;
  }
  root.WaterMapPopup = {bind};
})(window);
