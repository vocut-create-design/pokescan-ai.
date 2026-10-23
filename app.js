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
async function loadImage(file){
 if(!file||!file.type.startsWith('image/'))return;
 const generation=++scanGeneration;const reader=new FileReader();reader.onload=()=>{if(generation===scanGeneration){photo=reader.result;$('preview').src=photo;$('preview').style.display='block'}};reader.readAsDataURL(file);
 $('ocrStatus').textContent='Analysiere Kartenkopf und Kartennummer …';$('matches').replaceChildren();$('results').classList.add('hidden');
 try{
  const OCR=await loadOcrLibrary();
  const topTexts=[],bottomTexts=[];
  for(let i=0;i<3;i++){
   const top=await cropPhoto(file,'title',i);
   const r=await OCR.recognize(top,'deu+eng');topTexts.push(r.data?.text||'');
  }
  for(let i=0;i<3;i++){
   const bottom=await cropPhoto(file,'number',i);
   const r=await OCR.recognize(bottom,'eng+deu');bottomTexts.push(r.data?.text||'');
  }
  if(generation!==scanGeneration)return;
  const names=[...new Set(topTexts.flatMap(titleCandidates))].slice(0,10);
  const numberMatches=bottomTexts.join(' ').match(/\b(\d{1,3})\s*[/／]\s*(\d{2,3})\b/g)||[];
  const parsed=numberMatches.map(x=>x.match(/(\d{1,3})\s*[/／]\s*(\d{2,3})/)).filter(Boolean);
  const best=parsed.find(x=>Number(x[2])>=Number(x[1]));
  const clues={names,number:best?String(Number(best[1])):null,total:best?Number(best[2]):null};
  if(!names.length){$('ocrStatus').textContent='Der Kartenname konnte nicht sicher gelesen werden. Bitte Karte gerade, groß und scharf fotografieren. Keine falschen Treffer werden angezeigt.';return}
  $('ocrStatus').textContent='Vergleiche Kartenname mit dem Katalog …';await identifyFromPhoto(clues,generation);
 }catch(e){if(generation===scanGeneration)$('ocrStatus').textContent='Fotoanalyse nicht verfügbar: '+(e.message||'Fehler')+'. Du kannst die manuelle Suche verwenden.'}
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
