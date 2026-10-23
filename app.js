'use strict';
const $=id=>document.getElementById(id);let photo=null;let cards=[];
try{cards=JSON.parse(localStorage.getItem('pokescan_cards')||'[]');if(!Array.isArray(cards))cards=[]}catch{cards=[]}
const save=()=>{localStorage.setItem('pokescan_cards',JSON.stringify(cards));renderCollection()};
function switchTab(tab){$('scan').classList.toggle('hidden',tab!=='scan');$('collection').classList.toggle('hidden',tab!=='collection');$('tabScan').classList.toggle('secondary',tab!=='scan');$('tabCollection').classList.toggle('secondary',tab!=='collection')}
$('tabScan').onclick=()=>switchTab('scan');$('tabCollection').onclick=()=>switchTab('collection');$('cameraBtn').onclick=()=>$('camera').click();$('uploadBtn').onclick=()=>$('upload').click();
// Browser-side OCR: no photo upload. Tesseract worker and language models load from CDN.
let scanGeneration=0;
function normalizeScanText(s){return String(s||'').normalize('NFKC').replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ').trim()}
function extractScanClues(raw){
 const text=normalizeScanText(raw);const lines=String(raw||'').split(/\n/).map(normalizeScanText).filter(Boolean);
 const match=text.match(/\b(\d{1,3})\s*[/／]\s*(\d{2,3})\b/);
 const number=match?String(Number(match[1])):null;const total=match?Number(match[2]):null;
 const excluded=/^(basic|stage|pokemon|pokémon|trainer|supporter|item|energy|hp|weakness|resistance|retreat|illustrator|illus|no\.|©|20\d\d|attack|ability|evolves|from|level|lv\.|rare|common|uncommon|reverse|holo|edition|first|ex|gx|vmax|vstar|break)\b/i;
 const names=lines.filter(x=>!excluded.test(x)&&!/[0-9]{2,}/.test(x)).map(x=>x.replace(/\b(?:HP|PV)\b.*$/i,'').replace(/[^\p{L}\p{M} .:'’\-]/gu,'').trim()).filter(x=>x.length>=3&&x.length<=32&&x.split(' ').length<=4);
 return {number,total,names:[...new Set(names)].slice(0,5),raw:text};
}
async function loadOcrLibrary(){
 if(window.Tesseract?.recognize)return window.Tesseract;
 if(!window.__pokescanOcrPromise){window.__pokescanOcrPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('OCR-Bibliothek fehlt'));script.onerror=()=>reject(Error('OCR-Bibliothek konnte nicht geladen werden'));document.head.append(script)}).catch(e=>{window.__pokescanOcrPromise=null;throw e})}
 return window.__pokescanOcrPromise;
}
// Analyze title and collector-number zones separately, not arbitrary card body text.
// Multi-zone scan: card position varies between photos. Scan narrow bands at
// different heights rather than assuming the card fills the entire image.
async function cropPhoto(file, zone, band=0){
 const bitmap=await createImageBitmap(file);const w=bitmap.width,h=bitmap.height;
 const bands=zone==='title'?[[.18,.08,.82,.17],[.18,.13,.82,.22],[.18,.17,.82,.26]]:[[.14,.70,.66,.79],[.14,.74,.66,.83],[.14,.77,.66,.86]];
 const [x1,y1,x2,y2]=bands[band];const canvas=document.createElement('canvas');canvas.width=1250;canvas.height=Math.round(1250*h*(y2-y1)/(w*(x2-x1)));
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.filter='grayscale(1) contrast(1.8)';ctx.drawImage(bitmap,w*x1,h*y1,w*(x2-x1),h*(y2-y1),0,0,canvas.width,canvas.height);bitmap.close?.();return canvas;
}
function titleCandidates(raw){
 return String(raw||'').split(/\n/).map(normalizeScanText).map(x=>x.replace(/\b\d+\s*(?:KP|HP|PV)\b.*$/i,'').replace(/[^\p{L}\p{M} .:'’\-]/gu,'').trim()).filter(x=>x.length>=4&&x.length<=27&&x.split(' ').length<=3&&!/^(phase|stufe|basis|stage|basic|pokemon|pokémon|trainer|energie|energy|entwicklung|evolves|level|lvl|illustrator|attack|ability|weakness|resistance|retreat|edition)/i.test(x)).slice(0,4)
}

// Privacy-safe visual pilot: numeric artwork fingerprints, NOT uploaded original photos.
// Only the two explicitly approved test cards are covered. No universal card recognition claim.
const VISUAL_REFERENCES=[{"name":"Branawarz","number":"084","total":128,"pixels":[120,97,70,150,118,90,168,135,103,111,94,77,105,89,72,108,92,71,110,94,76,110,96,80,111,97,81,108,94,80,111,97,82,134,118,94,139,117,92,127,105,92,126,105,93,129,109,97,108,93,96,108,93,94,99,86,93,96,84,93,112,95,91,119,99,89,98,86,92,143,110,84,156,114,70,155,122,92,139,114,91,92,87,77,93,90,81,100,96,85,102,99,88,101,101,92,102,102,94,102,99,93,86,75,63,119,101,78,123,98,73,90,74,64,95,85,72,131,130,114,109,101,102,99,88,96,97,86,95,100,87,94,146,119,93,161,132,89,99,86,91,141,108,83,141,108,81,143,113,89,106,93,79,92,88,79,96,92,83,100,97,86,104,105,94,104,109,98,100,97,89,99,97,93,84,72,65,118,78,61,114,82,69,85,69,59,100,79,57,161,140,106,138,122,107,103,91,99,99,88,97,99,87,96,105,90,94,106,91,92,96,85,92,140,106,81,118,94,67,102,88,69,95,89,76,98,93,81,102,98,85,104,100,86,101,103,92,125,119,98,100,83,71,95,95,91,97,75,66,109,74,69,104,92,90,111,102,95,135,94,71,152,122,89,130,111,97,107,97,101,103,92,99,102,90,99,100,88,97,97,86,95,96,86,93,139,105,80,156,118,79,146,115,80,142,117,84,132,114,86,120,110,89,106,100,86,89,77,67,124,102,84,100,91,87,95,96,91,122,84,69,155,78,64,151,88,78,142,93,81,129,97,81,135,123,102,115,104,89,142,129,108,121,109,105,107,96,99,106,94,97,106,94,97,102,90,95,139,106,81,134,103,75,143,112,80,161,129,90,151,132,101,134,110,84,92,79,74,78,69,75,94,93,96,86,83,87,80,71,71,106,100,87,143,102,88,165,95,82,168,91,77,146,91,70,157,134,102,110,92,72,171,140,98,160,138,109,120,110,102,116,106,101,112,103,100,115,102,97,143,110,82,115,82,58,132,105,76,109,89,67,111,97,79,101,90,80,82,79,79,75,61,58,77,65,67,76,63,67,78,67,60,97,105,92,109,121,109,117,123,110,119,115,101,119,111,97,116,106,96,96,91,87,125,112,91,150,137,109,135,124,106,129,117,102,122,112,101,114,102,99,142,109,84,86,65,51,94,68,50,82,67,67,91,90,92,93,97,98,80,71,59,76,60,42,78,65,63,76,62,62,93,96,83,113,131,114,137,145,121,142,148,123,115,120,102,85,73,67,85,73,78,99,97,92,148,142,113,175,157,115,171,158,121,150,130,104,133,112,92,117,100,92,141,109,85,80,59,42,79,57,39,96,73,63,87,87,90,94,90,84,96,76,48,87,69,49,77,65,69,79,67,60,104,118,103,123,138,117,160,160,128,168,165,130,139,142,115,90,79,70,90,85,85,92,85,76,153,129,93,195,167,114,188,169,123,171,134,88,142,101,63,120,93,68,145,114,84,78,57,38,70,54,39,88,65,53,104,85,72,100,78,56,101,75,45,91,73,56,76,65,72,80,70,60,106,122,107,132,143,119,165,163,129,161,161,128,123,132,111,92,85,79,94,95,94,97,99,93,122,117,98,173,163,123,189,166,115,203,167,103,188,143,89,141,104,69,149,115,83,74,54,34,70,52,33,91,69,43,97,72,39,84,62,38,82,66,45,88,88,80,77,70,77,75,63,57,97,105,90,125,138,117,160,160,127,137,146,120,104,109,92,88,78,72,97,98,93,99,101,93,126,124,105,167,142,102,188,150,93,210,174,109,206,172,110,162,132,92,152,120,87,74,53,33,69,52,34,92,71,46,88,67,35,76,58,33,82,67,52,84,85,86,78,74,81,74,63,67,78,67,57,94,95,80,114,117,97,104,106,88,86,75,62,96,93,88,111,101,80,110,102,82,119,96,71,135,95,61,138,106,57,184,135,74,193,149,91,181,145,100,168,133,86,75,53,33,67,49,31,79,60,39,71,53,30,69,53,28,73,57,37,78,70,70,82,77,78,85,70,61,78,65,62,74,61,58,75,62,57,75,62,59,83,76,77,118,117,103,142,103,64,158,111,59,122,88,52,112,76,50,156,112,42,194,143,37,194,146,71,204,155,77,205,152,49,73,52,32,61,44,23,62,44,23,66,50,27,67,51,28,68,54,39,73,60,45,78,69,64,89,75,59,97,76,40,89,72,50,81,68,57,74,64,67,108,107,98,137,119,86,166,107,50,174,110,58,158,104,56,109,72,47,148,99,50,209,150,29,212,155,20,210,153,24,207,149,33,83,60,38,73,54,32,78,59,37,77,59,35,79,61,35,84,67,47,83,65,43,94,76,51,85,67,44,85,66,39,92,74,41,89,70,43,84,70,62,118,117,101,129,108,76,159,109,61,181,126,65,181,128,65,132,94,60,143,101,60,199,128,41,210,152,19,208,148,23,198,123,45,160,127,99,160,128,98,161,130,100,156,126,96,148,120,91,147,119,90,149,120,92,147,119,90,148,119,91,144,116,89,145,118,88,150,121,93,144,115,90,154,128,101,157,129,98,163,131,96,166,133,96,170,136,98,164,131,98,163,130,97,187,137,70,205,151,28,200,146,30,180,126,61]},{"name":"Evoli","number":"118","total":128,"pixels":[106,90,84,73,66,84,80,72,89,87,79,95,94,86,101,97,87,97,94,83,87,95,84,84,95,82,75,93,79,69,100,84,75,113,87,66,124,89,53,114,90,72,104,86,78,106,88,81,108,92,85,121,103,95,140,118,104,163,138,114,165,139,115,153,129,115,150,129,116,168,145,118,106,91,89,73,66,87,78,70,93,87,77,98,93,83,102,90,82,99,93,84,97,92,83,92,89,77,79,87,72,70,89,75,73,101,78,66,109,73,38,117,85,53,98,81,77,94,80,85,94,82,88,118,101,103,179,154,126,210,180,134,209,178,136,178,152,134,143,126,133,163,143,130,104,94,102,75,73,107,76,69,96,82,70,89,84,73,94,84,76,93,88,81,97,91,82,93,94,84,91,95,83,88,91,79,83,93,78,76,104,75,44,96,72,37,113,88,70,93,81,87,98,86,93,145,124,113,211,179,134,218,187,137,219,186,137,210,179,136,155,135,138,165,144,129,98,89,100,72,72,111,73,67,97,73,63,82,90,72,74,100,76,66,103,80,69,105,83,76,102,87,86,94,84,91,89,81,89,97,86,87,113,87,64,97,73,38,119,93,68,94,84,89,99,87,94,153,131,118,215,183,136,220,189,137,221,190,136,217,186,139,163,141,142,170,147,132,91,81,92,69,66,100,70,63,87,69,58,71,81,63,61,99,68,40,103,68,28,103,70,33,105,75,42,102,78,63,108,86,73,159,113,70,180,128,71,165,118,64,129,101,77,98,88,95,97,89,98,125,112,111,201,172,135,218,186,137,219,187,137,199,172,144,156,137,145,175,151,135,85,78,94,66,62,95,70,62,85,68,60,74,71,60,72,80,63,63,92,66,42,91,64,33,86,64,33,107,74,40,153,99,53,178,117,59,189,130,66,188,132,69,140,106,76,98,89,96,95,88,97,105,97,104,138,123,120,173,152,132,172,151,136,150,136,141,150,135,147,176,152,136,81,74,96,69,66,108,74,64,86,76,64,73,71,61,75,75,65,78,76,64,67,84,69,69,94,76,73,117,83,58,150,98,53,139,98,55,176,117,60,164,115,63,121,93,63,103,90,93,98,90,98,106,96,105,115,104,111,117,106,115,128,117,127,139,127,139,156,146,157,183,163,143,80,77,109,69,67,114,110,89,96,136,105,81,82,69,79,81,72,93,85,74,89,91,79,93,105,91,103,128,94,73,140,93,47,102,75,42,152,101,53,150,100,53,141,100,56,119,97,88,101,93,101,105,97,105,121,109,117,125,114,121,140,128,136,150,138,146,169,160,163,193,175,146,81,83,136,70,72,135,140,111,100,183,138,85,160,122,84,134,103,91,125,99,98,108,91,103,118,101,110,134,101,84,157,102,50,148,96,47,139,91,49,141,94,51,171,116,63,134,107,91,109,99,106,112,102,110,129,117,123,145,131,134,153,138,142,157,143,150,179,167,165,195,176,146,92,103,185,86,97,196,151,121,114,186,140,84,186,139,83,174,119,66,163,105,56,142,102,75,131,108,106,156,120,89,152,108,63,150,102,53,140,95,54,136,95,58,156,115,72,166,134,100,145,127,121,144,128,127,146,130,131,143,128,131,151,134,140,165,150,154,182,165,165,196,173,146,104,118,199,107,119,220,142,120,133,180,135,84,178,126,72,165,105,52,161,100,49,150,95,50,140,105,76,167,129,86,166,130,88,161,124,82,158,121,83,161,123,85,183,140,90,191,152,102,182,157,131,170,149,136,155,136,133,162,143,140,178,153,148,187,166,157,178,158,152,187,163,134,114,126,173,126,133,204,136,123,152,150,109,69,148,95,48,146,90,44,132,82,41,121,78,40,127,86,47,154,117,74,176,139,89,179,140,89,173,135,89,169,130,87,185,142,90,175,142,92,155,136,102,156,137,118,139,121,110,147,128,118,183,158,145,184,161,145,142,125,103,170,148,112,81,76,79,91,89,108,109,100,114,122,87,53,128,81,38,122,77,38,119,75,40,121,77,40,139,88,45,134,91,51,142,109,71,161,123,78,172,134,88,169,129,87,152,115,73,107,91,61,96,85,60,127,115,79,114,101,71,146,119,60,156,130,81,141,121,90,126,108,75,179,150,91,70,63,59,66,60,57,65,56,42,76,60,36,113,78,40,123,80,39,115,75,39,119,77,40,146,91,46,129,82,41,106,74,43,127,85,48,140,100,60,136,100,64,136,93,54,89,75,50,79,70,50,89,78,54,119,107,69,144,118,57,185,144,49,182,144,56,179,142,59,195,158,79,81,69,54,77,66,51,76,64,46,74,61,40,77,62,37,84,65,38,82,65,41,88,67,39,119,81,44,112,77,41,95,70,40,123,84,47,143,94,50,116,82,47,147,99,55,120,99,57,82,73,50,82,71,49,92,81,56,129,106,62,195,147,50,198,152,46,195,150,51,193,152,83,148,124,91,150,125,92,150,125,91,145,121,86,138,114,81,135,113,80,136,113,83,136,114,84,139,117,85,138,115,82,138,116,83,145,120,88,146,119,83,143,119,85,145,120,85,137,116,81,130,112,81,129,110,79,134,115,82,158,127,86,194,139,58,199,153,46,193,143,54,188,140,87]}];
async function visualPilot(file,generation){
 const bitmap=await createImageBitmap(file);const w=bitmap.width,h=bitmap.height;
 const canvas=document.createElement('canvas');canvas.width=24;canvas.height=16;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 let best=VISUAL_REFERENCES.map(ref=>({ref,distance:Infinity}));
 // Sliding artwork windows: account for varying card position and photo framing.
 for(let rw=0.45;rw<=0.901;rw+=0.05)for(let rh=0.20;rh<=0.451;rh+=0.025)
 for(let cx=0.40;cx<=0.601;cx+=0.05)for(let cy=0.28;cy<=0.581;cy+=0.05){
  const ww=w*rw,hh=h*rh,x=w*cx-ww/2,y=h*cy-hh/2;
  if(x<0||y<0||x+ww>w||y+hh>h)continue;
  ctx.drawImage(bitmap,x,y,ww,hh,0,0,24,16);
  const pixels=ctx.getImageData(0,0,24,16).data;
  for(let k=0;k<best.length;k++){
   const reference=best[k].ref.pixels;let sum=0;
   for(let j=0;j<reference.length;j++){
    const d=(pixels[Math.floor(j/3)*4+j%3]-reference[j])/255;sum+=d*d;
   }
   const score=Math.sqrt(sum/reference.length);
   if(score<best[k].distance)best[k].distance=score;
  }
 }
 bitmap.close?.();if(generation!==scanGeneration)return true;
 best.sort((a,b)=>a.distance-b.distance);
 const top=best[0],second=best[1];
 // Conservative pilot threshold and inter-class margin; not calibrated for all photographs.
 if(top.distance>0.16||second.distance-top.distance<0.025){
  $('ocrStatus').textContent='Bildvergleich: keine sichere Übereinstimmung mit den zwei Testkarten. Keine falsche Zuordnung. Du kannst die manuelle Suche verwenden.';
  return true;
 }
 $('ocrStatus').textContent='Bildvergleich: '+top.ref.name+' ('+top.ref.number+'/128) wahrscheinlich. Prüfe den Katalogtreffer.';
 try{
  const results=await lookup('de',top.ref.name);
  if(generation!==scanGeneration)return true;
  const exact=results.filter(c=>normalizedName(c.name)===normalizedName(top.ref.name)&&Number(c.localId)===Number(top.ref.number));
  const holder=$('matches');holder.replaceChildren();
  if(exact.length){$('results').classList.remove('hidden');exact.slice(0,8).forEach(c=>holder.append(cardNode(c)));$('results').scrollIntoView({behavior:'smooth',block:'start'});}
  else $('ocrStatus').textContent+=' Der Katalog lieferte keinen exakt passenden Treffer. Nichts wird automatisch gespeichert.';
 }catch(e){$('ocrStatus').textContent+=' Der Online-Katalog ist derzeit nicht erreichbar.';}
 return true;
}
async function loadImage(file){
 if(!file||!file.type.startsWith('image/'))return;
 const generation=++scanGeneration;const reader=new FileReader();reader.onload=()=>{if(generation===scanGeneration){photo=reader.result;$('preview').src=photo;$('preview').style.display='block'}};reader.readAsDataURL(file);
 $('ocrStatus').textContent='Vergleiche Kartenmotiv lokal mit zwei Testreferenzen …';$('matches').replaceChildren();$('results').classList.add('hidden');
 try{await visualPilot(file,generation);return;}catch(e){if(generation===scanGeneration)$('ocrStatus').textContent='Bildvergleich fehlgeschlagen: '+(e.message||'Fehler')+'. Bitte manuelle Suche verwenden.';return;}
}
function normalizedName(s){return String(s||'').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'')}
async function identifyFromPhoto(clues,generation){
 const selected=$('language').value;const languages=selected?[selected]:['de','en','fr','it','es'];
 const jobs=[];for(const lang of languages)for(const name of clues.names.slice(0,10))jobs.push(lookup(lang,name).catch(()=>[]));
 const responses=await Promise.all(jobs);if(generation!==scanGeneration)return;
 // Strictly require name agreement. A collector number is not sufficient.
 let matches=responses.flat().filter(c=>clues.names.some(n=>{const a=normalizedName(n),b=normalizedName(c.name);return a.length>=4&&b.length>=4&&(a===b||(a.length>=6&&b.includes(a))||(b.length>=6&&a.includes(b)))}));
 if(clues.number){matches=matches.filter(c=>String(Number(c.localId))===clues.number)}
 const unique=[...new Map(matches.map(c=>[c.language+':'+c.id,c])).values()].slice(0,12);
 const holder=$('matches');holder.replaceChildren();
 if(!unique.length){$('ocrStatus').textContent='Keine zuverlässige Übereinstimmung. Die App zeigt bewusst keine fremden Karten an. Bitte Karte näher und ohne Spiegelung fotografieren.';return}
 $('results').classList.remove('hidden');$('ocrStatus').textContent=unique.length+' passende Karten gefunden – Set und Nummer bitte bestätigen.';
 unique.forEach(c=>holder.append(cardNode(c)));$('results').scrollIntoView({behavior:'smooth',block:'start'});
}
$('camera').onchange=e=>loadImage(e.target.files[0]);$('upload').onchange=e=>loadImage(e.target.files[0]);
const langs=['en','de','fr','it','es','ja','ko','zh'];
async function lookup(lang,q){const endpoint='https://api.tcgdex.net/v2/'+encodeURIComponent(lang)+'/cards?'+new URLSearchParams({name:q});const r=await fetch(endpoint);if(!r.ok)throw Error('Katalog nicht erreichbar');return (await r.json()).map(c=>({...c,language:lang}))}
function cardNode(c, saved=false){const wrap=document.createElement('div');wrap.className='result';if(c.image){const img=document.createElement('img');img.src=c.image+'/low.webp';img.alt=c.name;img.loading='lazy';wrap.append(img)}const info=document.createElement('div');const title=document.createElement('strong');title.textContent=c.name||'Unbekannt';const meta=document.createElement('p');meta.className='muted';meta.textContent=`${c.localId||c.id||'–'} · ${(c.language||'').toUpperCase()}${c.setName?' · '+c.setName:''}`;info.append(title,meta);wrap.append(info);const b=document.createElement('button');b.textContent=saved?'Entfernen':'Speichern';b.onclick=()=>{if(saved){cards=cards.filter(x=>x.key!==c.key);save()}else{const key=c.language+':'+c.id;if(!cards.some(x=>x.key===key)){cards.push({...c,key,added:new Date().toISOString()});save()}b.textContent='Gespeichert ✓'}};wrap.append(b);const analyze=document.createElement('button');analyze.className='analysisBtn';analyze.textContent='Markt & Grading';analyze.onclick=()=>showAnalysis(c);wrap.append(analyze);return wrap}
$('search').onclick=async()=>{const q=$('query').value.trim();if(!q){$('ocrStatus').textContent='Bitte zuerst einen Kartennamen oder eine Nummer eingeben.';return}const holder=$('matches');holder.replaceChildren();$('results').classList.remove('hidden');$('ocrStatus').textContent='Suche im Pokémon-Katalog …';const selected=$('language').value;const languages=selected?[selected]:langs;let found=[];let errors=0;const number=q.match(/^(\d{1,3})\s*\/\s*\d{2,3}$/);try{const results=await Promise.all(languages.map(async lang=>{try{if(number){const r=await fetch('https://api.tcgdex.net/v2/'+lang+'/cards');if(!r.ok)throw Error();return (await r.json()).filter(c=>String(c.localId||'').replace(/^0+/,'')===String(Number(number[1]))).slice(0,30).map(c=>({...c,language:lang}))}return await lookup(lang,q)}catch{errors++;return []}}));found=results.flat().slice(0,80)}catch{}$('ocrStatus').textContent=found.length?`${found.length} mögliche Treffer – Edition und Nummer prüfen.`:errors===languages.length?'Katalog nicht erreichbar. Prüfe deine Internetverbindung.':'Keine Treffer. Versuche den Namen in Englisch oder wähle eine Sprache.';if(!found.length){holder.textContent='Keine Karten gefunden.';return}found.forEach(c=>holder.append(cardNode(c)))};
function renderCollection(){$('count').textContent=cards.length;const holder=$('saved');holder.replaceChildren();if(!cards.length){const d=document.createElement('div');d.className='empty';d.textContent='Noch keine Karten gespeichert.';holder.append(d)}cards.forEach(c=>holder.append(cardNode(c,true)))}
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(cards,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pokescan-sammlung.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)};
$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text());if(!Array.isArray(data)||data.length>10000||!data.every(c=>typeof c.id==='string'&&typeof c.name==='string'&&typeof c.language==='string'))throw Error();cards=[...new Map([...cards,...data.map(c=>({id:c.id,name:c.name,language:c.language,localId:c.localId||'',image:typeof c.image==='string'&&c.image.startsWith('https://')?c.image:undefined,key:c.language+':'+c.id,added:c.added||new Date().toISOString()}))].map(c=>[c.key,c])).values()];save();alert('Sammlung importiert.')}catch{alert('Ungültige Sammlungsdatei.')}};renderCollection();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

// Version 2: source-transparent, no scraped or invented prices.
let analyzedCard=null;
const eur=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
function sourceLink(name,c){const q=encodeURIComponent([c.name,c.localId,c.setName].filter(Boolean).join(' '));
 if(name==='Cardmarket')return 'https://www.cardmarket.com/de/Pokemon/Products/Search?searchString='+q;
 if(name==='eBay')return 'https://www.ebay.de/sch/i.html?_nkw='+q+'&LH_Sold=1&LH_Complete=1';
 return 'https://www.psacard.com/auctionprices';}
async function showAnalysis(c){analyzedCard=c;$('analysis').classList.remove('hidden');$('selectedCard').textContent=c.name+' · '+(c.localId||c.id)+' · '+c.language.toUpperCase();const root=$('sources');root.replaceChildren();
 const descriptions=[['Cardmarket','Europäische Angebote / Preistrend','Angebotspreise sind nicht automatisch erzielte Verkaufspreise.'],['eBay','Abgeschlossene Verkäufe','Verkaufte Angebote nach Kartennummer, Sprache und Zustand überprüfen.'],['PSA','Graded-Verkäufe nach Note','PSA 8, PSA 9 und PSA 10 getrennt prüfen; gleiche Kartenvariante wählen.']];
 descriptions.forEach(([name,kind,note])=>{const box=document.createElement('div');box.className='sourcebox';const h=document.createElement('h3');h.textContent=name;const sub=document.createElement('p');sub.textContent=kind;const status=document.createElement('p');status.className='status';status.textContent='Kein verifizierter Live-Preis angebunden';const info=document.createElement('p');info.className='muted';info.textContent=note;const a=document.createElement('a');a.href=sourceLink(name,c);a.target='_blank';a.rel='noopener noreferrer';a.textContent='Quelle öffnen ↗';box.append(h,sub,status,info,a);root.append(box)});
 await loadCardmarketPrice(c,root);
 $('gradeResults').replaceChildren();$('analysis').scrollIntoView({behavior:'smooth',block:'start'});}
for(const grade of [8,9,10]){const label=document.createElement('label');label.textContent='PSA '+grade+' – überprüfter Verkaufspreis (€)';const input=document.createElement('input');input.id='psa'+grade;input.type='number';input.min='0';input.step='0.01';input.placeholder='Optional';$('gradeInputs').append(label,input)}
$('calculate').onclick=()=>{const raw=$('rawValue').value,cost=$('gradingCost').value,holder=$('gradeResults');holder.replaceChildren();if(raw===''||cost===''||+raw<0||+cost<0){holder.textContent='Bitte Ungraded-Wert und Gesamtkosten eingeben.';return}let any=false;for(const grade of [8,9,10]){const v=$('psa'+grade).value;if(v===''||+v<0)continue;any=true;const diff=Number(v)-Number(raw)-Number(cost);const d=document.createElement('div');d.className='outcome';d.textContent='PSA '+grade+': '+eur(Number(v))+' Verkauf – '+eur(Number(raw))+' Rohwert – '+eur(Number(cost))+' Kosten = '+(diff>=0?'+':'')+eur(diff)+' (vor etwaigen Verkaufsgebühren/Steuern)';holder.append(d)}if(!any)holder.textContent='Trage mindestens einen PSA-Verkaufspreis ein.'};

// Cardmarket market feed supplied by TCGdex, not an official Cardmarket API.
async function loadCardmarketPrice(c, root){
 const box=[...root.children].find(el=>el.querySelector('h3')?.textContent==='Cardmarket');
 if(!box)return;
 const status=box.querySelector('.status');
 status.textContent='Cardmarket-Marktdaten werden geladen …';
 try{
  const lang=encodeURIComponent(c.language||'en');
  const id=encodeURIComponent(c.id||'');
  if(!id)throw Error('Karten-ID fehlt');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  let response;
  try{response=await fetch(`https://api.tcgdex.net/v2/${lang}/cards/${id}`,{signal:controller.signal,cache:'no-store'});}finally{clearTimeout(timeout)}
  if(!response.ok)throw Error('Preisdaten nicht erreichbar');
  const data=await response.json();
  // Never mix prices from different variants. If per-variant prices exist,
  // present them individually, and don't claim a uniquely identified printing.
  const variants=Array.isArray(data.variants_detailed)?data.variants_detailed.filter(v=>v?.pricing?.cardmarket):[];
  const candidates=variants.length?variants.map(v=>({label:[v.type,v.subtype,v.foil].filter(Boolean).join(' / ')||'Variante',price:v.pricing.cardmarket})):data.pricing?.cardmarket?[{label:'Karten-Zuordnung (Variante prüfen)',price:data.pricing.cardmarket}]:[];
  if(!candidates.length){status.textContent='Für diese Karte derzeit keine Cardmarket-Preisdaten im TCGdex-Feed.';return}
  status.replaceChildren();
  const fmt=n=>typeof n==='number'&&Number.isFinite(n)?eur(n):'–';
  for(const {label,price} of candidates){
   const line=document.createElement('div');line.className='outcome';
   line.textContent=`${label}: Trend ${fmt(price.trend)} · Ø 30 Tage ${fmt(price.avg30)} · niedrigstes Angebot ${fmt(price.low)}`;
   status.append(line);
  }
  const date=candidates.map(x=>x.price.updated).find(Boolean);
  const note=document.createElement('p');note.className='muted';
  note.textContent=`Datenquelle: TCGdex (Cardmarket-Marktdaten), ${date?'Stand '+date:'Zeitstempel nicht verfügbar'}. Marktindikatoren, keine garantierten Verkaufspreise. Variante und Sprache prüfen.`;
  status.append(note);
 }catch(e){status.textContent='Cardmarket-Daten konnten nicht geladen werden. Bitte später erneut versuchen.'}
}
