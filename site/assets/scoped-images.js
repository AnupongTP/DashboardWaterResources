/* Scoped-page image handling (phase 2). Copied verbatim from site/assets/authority-app.js (lines 350-405):
   primary lh3 =w1000 -> thumbnail sz=w1000 -> uc?export=view, no-referrer, failed-state memory, enlarge modal.
   authority-app.js is untouched. The inline handlers need window globals. */
(function (global) {
  'use strict';
function driveFileId(url){ const match=String(url||'').match(/[?&]id=([a-zA-Z0-9_-]+)/);return match?match[1]:null; }
const failedImages=new Set(), preferredImageUrls=new Map(), imageRetryStage=new Map();
function safeDriveLink(value){
  try{const url=new URL(String(value));return url.protocol==='https:'&&url.hostname==='drive.google.com'?url.href:'';}
  catch(_){return '';}
}
function escapeAttr(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function authorityImageLoaded(image,id){
  if(!image.naturalWidth)return;
  failedImages.delete(id);preferredImageUrls.set(id,image.src);
  if(image.nextElementSibling)image.nextElementSibling.style.display='none';
}
function authorityImageError(image,id){
  failedImages.add(id);preferredImageUrls.delete(id);
  document.querySelectorAll(`img[data-drive-id="${id}"]`).forEach(other=>{
    other.removeAttribute('src');other.style.display='none';
    const fallback=other.nextElementSibling;
    if(fallback){fallback.style.display='flex';const retry=fallback.querySelector('button');
      if(retry)retry.hidden=(imageRetryStage.get(id)||0)>=2;}
  });
}
function authorityImageRetry(button,id){
  const fallback=button.parentElement,image=fallback&&fallback.previousElementSibling;
  const stage=imageRetryStage.get(id)||0;
  if(!image||image.tagName!=='IMG'||stage>=2)return;
  const urls=[`https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
    `https://drive.google.com/uc?export=view&id=${id}`];
  imageRetryStage.set(id,stage+1);image.style.display='block';fallback.style.display='none';image.src=urls[stage];
}
function driveImgTag(imageUrl,cls,altText){
  const id=driveFileId(imageUrl), original=safeDriveLink(imageUrl);
  const failed=!id||failedImages.has(id);
  const link=original?`<a href="${escapeAttr(original)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">เปิดไฟล์ต้นฉบับ</a>`:'';
  const retry=id&&(imageRetryStage.get(id)||0)<2?`<button type="button" onclick="event.stopPropagation();authorityImageRetry(this,'${id}')">ลองแหล่งภาพสำรอง</button>`:'';
  const fallback=`<span class="authority-image-fallback" style="display:${failed?'flex':'none'};">ไม่สามารถแสดงภาพ${retry}${link}</span>`;
  if(!id)return fallback;
  const src=failed?'':(preferredImageUrls.get(id)||`https://lh3.googleusercontent.com/d/${id}=w1000`);
  return `<img class="${escapeAttr(cls)}" ${src?`src="${src}"`:''} alt="${escapeAttr(altText)}" data-drive-id="${id}" data-original="${escapeAttr(original)}" style="${failed?'display:none;':''}" loading="lazy" referrerpolicy="no-referrer" onload="authorityImageLoaded(this,'${id}')" onerror="authorityImageError(this,'${id}')" onclick="openImageModal(this.currentSrc||this.src,this.alt,this.dataset.original)">${fallback}`;
}
function openImageModal(src,caption,original){
  if(!src)return;
  const image=document.getElementById('imgModalImg'),failure=document.getElementById('imgModalFailure');
  image.referrerPolicy='no-referrer';
  failure.hidden=true;failure.style.display='none';image.style.display='block';
  image.onerror=()=>{image.style.display='none';failure.hidden=false;failure.style.display='flex';};
  image.src=src;
  failure.innerHTML=`ไม่สามารถแสดงภาพขยายได้${safeDriveLink(original)?`<a href="${escapeAttr(original)}" target="_blank" rel="noopener">เปิดไฟล์ต้นฉบับ</a>`:''}`;
  document.getElementById('imgModalCaption').textContent=caption||'';
  document.getElementById('imgModalBg').classList.add('open');
}
function closeImageModal(){
  document.getElementById('imgModalBg').classList.remove('open');
  const image=document.getElementById('imgModalImg');image.onerror=null;image.src='';
}

// Leaflet reparses string popup content on every open. Keep the same DOM node so

  global.authorityImageLoaded = authorityImageLoaded;
  global.authorityImageError = authorityImageError;
  global.authorityImageRetry = authorityImageRetry;
  global.openImageModal = openImageModal;
  global.closeImageModal = closeImageModal;
  global.driveImgTag = driveImgTag;
  // resolved at call time so a wrapper installed on window.driveImgTag (tests) sees every call
  global.ScopedImages = Object.freeze({tag: (...args) => global.driveImgTag(...args), fileId: driveFileId});
})(window);
