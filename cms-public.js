'use strict';
// Loads public, admin-managed content when Supabase is configured.
// When it isn't, all original website content continues to work offline.
(() => {
  const config=window.GLEB_CMS_CONFIG||{};
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url||'') || !(config.publishableKey||'').trim())return;
  const loadSdk=()=>new Promise((resolve,reject)=>{
    if(window.supabase?.createClient)return resolve();
    const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.async=true;
    s.onload=resolve;s.onerror=()=>reject(new Error('Unable to load content service'));
    document.head.appendChild(s);
  });
  const imagePath=url=>{
    if(typeof url!=='string'||!url.trim())return 'assets/placeholder.svg';
    const x=url.trim();
    return /^https:\/\//i.test(x)||(/^assets\/[a-zA-Z0-9_./-]+$/.test(x)&&!x.includes('..'))?x:'assets/placeholder.svg';
  };
  const add=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
  const showImage=(src,alt,loading='lazy')=>{const img=add('img');img.src=imagePath(src);img.alt=alt||'';img.loading=loading;return img};
  function renderProjectCards(items){
    const grid=document.querySelector('.projects-grid');if(!grid)return;
    grid.replaceChildren();
    items.forEach((item,i)=>{
      if(!item||!item.id)return;
      const card=add('button','project-card'+(i===0?' project-card-featured':'')+' reveal is-visible');card.type='button';card.dataset.project=item.id;
      const cover=add('span','project-image');
      cover.append(showImage(item.images?.[0],item.alt?.[locale]?.[0]||item.title));cover.append(add('span','view-bubble','↗'));cover.lastChild.setAttribute('aria-hidden','true');
      const lower=add('span','project-bottom'),details=add('span');
      const number=add('span','project-num');number.textContent=String(i+1).padStart(2,'0')+' / ';
      const label=add('span');label.textContent=item.cardLabel?.[locale]||item[locale]?.kicker||'';number.append(label);
      details.append(number,add('strong','',item.title||'Untitled'),add('span','project-type',item.category?.[locale]||''));
      const arrow=add('span','card-link','↗');arrow.setAttribute('aria-hidden','true');lower.append(details,arrow);
      card.append(cover,lower);card.setAttribute('aria-label',copy[locale].viewProject+': '+item.title);
      grid.append(card);
    });
  }
  function renderPhotos(items){
    const grid=document.querySelector('.photo-grid');if(!grid)return;
    grid.replaceChildren();
    items.forEach((p,i)=>{
      if(!p||!p.src)return;
      const el=add('button','photo-tile '+(i%5===1||i%5===2?'tile-tall':'tile-wide')+' is-visible');el.type='button';el.dataset.gallery=p.group||'other';el.dataset.photo=String(i);
      el.hidden=galleryFilter!=='all'&&el.dataset.gallery!==galleryFilter;
      el.append(showImage(p.src,p[locale]||''));const over=add('span','photo-overlay');over.append(add('span','',p[locale]||p.group||''));const arrow=add('span','','↗');arrow.setAttribute('aria-hidden','true');over.append(arrow);el.append(over);
      el.setAttribute('aria-label',copy[locale].enlargePhoto+': '+(p[locale]||''));grid.append(el);
    });
  }
  function applyContent(data){
    if(!data||typeof data!=='object')return;
    for(const lang of ['en','no'])if(data.copy?.[lang]){
      for(const [k,v] of Object.entries(data.copy[lang]))if(Object.hasOwn(copy[lang],k)&&typeof v==='string')copy[lang][k]=v;
    }
    if(data.toolShowcases&&typeof data.toolShowcases==='object'){
      for(const [id,details] of Object.entries(data.toolShowcases))if(toolShowcases[id]&&details){
        if(details.en)Object.assign(toolShowcases[id].en,details.en);
        if(details.no)Object.assign(toolShowcases[id].no,details.no);
      }
    }
    if(Array.isArray(data.projects)){
      for(const id of Object.keys(projects))delete projects[id];
      data.projects.filter(p=>p&&typeof p.id==='string').forEach(p=>{
        const images=(Array.isArray(p.images)?p.images:[]).map(imagePath);
        projects[p.id]={...p,images:images.length?images:['assets/placeholder.svg'],alt:p.alt||{en:[],no:[]}};
      });
      renderProjectCards(data.projects);
    }
    if(Array.isArray(data.photos)){
      photos.splice(0,photos.length,...data.photos.filter(p=>p?.src).map(p=>({...p,src:imagePath(p.src)})));
      renderPhotos(photos);
    }
    const settings=data.settings||{};
    if(typeof settings.displayName==='string' && settings.displayName.trim()){
      const name=settings.displayName.trim();
      const words=name.split(/\s+/);const first=words.shift()||'';const last=words.join(' ');
      const headline=document.querySelectorAll('.hero-name');
      if(headline[0])headline[0].textContent=first.toUpperCase();
      if(headline[1]){const dot=headline[1].querySelector('.fullstop');headline[1].replaceChildren(document.createTextNode(last.toUpperCase()),dot||document.createTextNode('.'))}
      const brand=document.querySelector('.brand-text');
      if(brand){brand.replaceChildren(document.createTextNode(first.toUpperCase()),document.createElement('br'),document.createTextNode(last.toUpperCase()))}
      document.querySelectorAll('.tool-showcase-footer').forEach(node=>{const label=node.querySelector('span');if(label)label.textContent=name.toUpperCase()+' · PORTFOLIO'});
    }
    const portrait=document.querySelector('.portrait-circle img');if(portrait&&settings.portraitUrl)portrait.src=imagePath(settings.portraitUrl);
    const about=document.querySelectorAll('#about img');if(about[0]&&settings.aboutImageUrl)about[0].src=imagePath(settings.aboutImageUrl);if(about[1]&&settings.aboutSecondaryUrl)about[1].src=imagePath(settings.aboutSecondaryUrl);
    const contact=document.querySelectorAll('.contact-link');
    if(contact[0]&&settings.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)){
      contact[0].href='mailto:'+settings.email;const strong=contact[0].querySelector('strong');if(strong)strong.textContent=settings.email;
    }
    if(contact[1]&&settings.instagram&&/^https:\/\/(www\.)?instagram\.com\//i.test(settings.instagram)){
      contact[1].href=settings.instagram;const strong=contact[1].querySelector('strong');if(strong)strong.textContent='@'+settings.instagram.split('/').filter(Boolean).at(-1).replace(/^@/,'');
    }
    window.onManagedLanguageChanged=()=>{renderProjectCards(data.projects||[]);renderPhotos(photos)};
    translate(locale,false);
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    try{
      await loadSdk();
      const client=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data,error}=await client.from('portfolio_data').select('data').eq('id',1).maybeSingle();
      if(error)throw error;
      if(data?.data)applyContent(data.data);
    }catch(error){console.warn('Portfolio: showing bundled content because live content is unavailable.',error.message)}
  });
})();
