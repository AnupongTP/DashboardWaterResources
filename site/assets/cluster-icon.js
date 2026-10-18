// Shared cluster marker for the Provincial and Authority maps.
// The viewBox includes the white stroke and drop shadow; the anchor remains
// at the path's pointed tip (12, 32), not at the SVG viewport's bottom edge.
window.WaterClusterIcon = function clusterIcon(color1, color2){
  color2 = color2 || color1;
  return function(cluster){
    const count = cluster.getChildCount();
    const pinWidth = count < 10 ? 38 : count < 50 ? 46 : 56;
    const scale = pinWidth / 24;
    const width = Math.round(28 * scale);
    const height = Math.round(38 * scale);
    const fontSize = count < 10 ? 13 : count < 100 ? 12.5 : 11.5;
    const uid = 'c' + Math.random().toString(36).slice(2, 9);
    const html = `
      <svg width="${width}" height="${height}" viewBox="-2 -2 28 38" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 4px rgba(0,20,60,.45));">
        <defs>
          <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color1}"/>
            <stop offset="100%" stop-color="${color2}"/>
          </linearGradient>
        </defs>
        <path d="M12 0C5.4 0 0 5.3 0 11.8 0 20.6 12 32 12 32s12-11.4 12-20.2C24 5.3 18.6 0 12 0z" fill="url(#${uid})" stroke="#ffffff" stroke-width="1.4"/>
        <text x="12" y="11.8" text-anchor="middle" dominant-baseline="central" font-family="'Sarabun',sans-serif" font-weight="800" font-size="${fontSize}" fill="#ffffff" stroke="#08355e" stroke-width="0.6" paint-order="stroke">${count}</text>
      </svg>`;
    return L.divIcon({html, className:'', iconSize:[width,height],
      iconAnchor:[width / 2, height * 34 / 38]});
  };
};
