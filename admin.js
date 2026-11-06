'use strict';
/* Secure editing UI. Authorization is enforced by Supabase Auth + database/storage RLS,
   not by this JavaScript. Never put a password or service key in this file. */
(() => {
  const byId=id=>document.getElementById(id);
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
  const button=(label,handler,cls='action-button compact')=>{
    const b=el('button',cls,label);b.type='button';b.addEventListener('click',handler);return b;
  };
  const deepClone=v=>JSON.parse(JSON.stringify(v));
  const config=window.GLEB_CMS_CONFIG||{};
  let client,user,draft,lastSaved,selectedTab='overview',selectedProject=-1,selectedPhoto=-1,selectedTool='davinci',dirty=false,busy=false;
  const editor=byId('editor');
  const defaults=window.GLEB_DEFAULT_DATA;
  const show=view=>['loadingView','setupView','loginView','workspaceView'].forEach(id=>byId(id).classList.toggle('hidden',id!==view));
  const pathGet=(base,path)=>path.split('.').reduce((obj,k)=>obj?.[k],base);
  const pathSet=(base,path,value)=>{const keys=path.split('.');let target=base;keys.slice(0,-1).forEach(k=>{if(!target[k])target[k]={};target=target[k]});target[keys.at(-1)]=value};
  const safeImage=url=>typeof url==='string'&&(/^(https:\/\/[^\s]+)$/i.test(url)||/^assets\/[a-zA-Z0-9_./-]+$/.test(url))?url:'assets/placeholder.svg';
  function showMessage(message,kind='ok'){
    const node=byId('statusMessage');node.textContent=message;node.className='message status '+kind;
  }
  function setDirty(value=true){dirty=value;const note=byId('dirtyNote');note.textContent=dirty?'● You have unpublished changes':'✓ All changes saved';note.classList.toggle('unsaved',dirty);}
  function setBusy(isBusy){busy=isBusy;byId('saveButton').disabled=isBusy;byId('saveButton').textContent=isBusy?'Working…':'Save & publish ↗'}
  const section=(title,desc)=>{const header=el('div','editor-head');const left=el('div');left.append(el('span','eyebrow','CONTENT MANAGER'),el('h2','',title),el('p','muted small',desc));header.append(left);return header};
  function field(label,value,path,multiline=false){
    const l=el('label','form-field');l.append(el('span','',label));
    const control=document.createElement(multiline?'textarea':'input');
    if(!multiline)control.type='text';else control.rows=3;
    control.value=value==null?'':String(value);control.dataset.path=path;
    l.append(control);return l;
  }
  function twoLang(label,path,large=false){
    const wrap=el('div','field-card');wrap.append(el('strong','',label));const grid=el('div','paired');
    for(const lang of ['en','no'])grid.append(field(lang==='en'?'🇬🇧 English':'🇳🇴 Norwegian',pathGet(draft,`${path}.${lang}`),`${path}.${lang}`,large));
    wrap.append(grid);return wrap;
  }
  const isConfigured=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url||'')&&!!String(config.publishableKey||'').trim();
  function normalize(value){
    const d=deepClone(defaults);
    if(value&&typeof value==='object'){
      for(const key of ['copy','projects','photos','settings','toolShowcases'])if(value[key]!==undefined)d[key]=value[key];
    }
    if(!Array.isArray(d.projects))d.projects=[];
    if(!Array.isArray(d.photos))d.photos=[];
    for(const lang of ['en','no'])d.copy[lang]={...defaults.copy[lang],...d.copy?.[lang]};
    d.settings={...defaults.settings,...d.settings};
    return d;
  }
  async function loadData(){
    setBusy(true);
    try{
      const {data,error}=await client.from('portfolio_data').select('data').eq('id',1).maybeSingle();
      if(error)throw error;
      draft=normalize(data?.data);
      lastSaved=deepClone(draft);
      setDirty(false);
      show('workspaceView');render();
      if(!data)showMessage('Ready! Your current portfolio is loaded. Changes go live after your first Save & publish.');
    }catch(error){show('workspaceView');showMessage('Unable to load your content: '+error.message,'bad')}
    finally{setBusy(false)}
  }
  async function init(){
    if(!defaults){show('setupView');return}
    if(!isConfigured()){show('setupView');return}
    if(!window.supabase?.createClient){show('setupView');byId('setupView').querySelector('p').textContent='The login library could not load. Check your internet connection and try again.';return}
    client=window.supabase.createClient(config.url,config.publishableKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}});
    const {data,error}=await client.auth.getSession();
    if(error){console.warn(error.message)}
    if(data?.session?.user){user=data.session.user;byId('signOut').classList.remove('hidden');await loadData()}
    else show('loginView');
  }
  async function login(event){
    event.preventDefault();const e=byId('loginError');e.hidden=true;
    const b=byId('loginButton');b.disabled=true;b.textContent='Signing in…';
    try{
      const {data,error}=await client.auth.signInWithPassword({email:byId('loginEmail').value.trim(),password:byId('loginPassword').value});
      if(error)throw error;
      if(!data.user)throw new Error('Sign-in did not return an account');
      user=data.user;byId('loginPassword').value='';byId('signOut').classList.remove('hidden');await loadData();
    }catch(error){e.textContent=error.message;e.hidden=false}
    finally{b.disabled=false;b.textContent='Sign in ↗'}
  }
  async function logout(){
    if(dirty&&!window.confirm('You have unpublished changes. Sign out anyway?'))return;
    const {error}=await client.auth.signOut();if(error){showMessage(error.message,'bad');return}
    user=null;draft=null;setDirty(false);byId('signOut').classList.add('hidden');show('loginView');
  }
  async function save(){
    if(!draft||busy)return;
    if(draft.projects.some(p=>!p.title?.trim())){showMessage('Each project must have a title before publishing.','bad');selectedTab='projects';render();return}
    if(draft.photos.some(p=>!p.src)){showMessage('Remove photos without an uploaded image before publishing.','bad');selectedTab='photos';render();return}
    if(!(draft.settings.displayName||'').trim()){showMessage('Please enter a name in Settings.','bad');return}
    if(!/^\S+@\S+\.\S+$/.test(draft.settings.email||'')){showMessage('Enter a valid contact email in Settings.','bad');return}
    if(!/^https:\/\/(www\.)?instagram\.com\//i.test(draft.settings.instagram||'')){showMessage('Use a full https://www.instagram.com/... link in Settings.','bad');return}
    setBusy(true);
    try{
      const {error}=await client.from('portfolio_data').upsert({id:1,data:draft,updated_at:new Date().toISOString()},{onConflict:'id'});
      if(error)throw error;
      lastSaved=deepClone(draft);setDirty(false);
      showMessage('Published! Your website will display the updated content when visitors refresh it.');
    }catch(error){showMessage('Could not publish: '+error.message+'. Check that your account ID matches the SQL policies.','bad')}
    finally{setBusy(false)}
  }
  async function uploadImage(file){
    if(!user)throw new Error('Please sign in again');
    if(!file)throw new Error('Choose an image first');
    const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
    if(!types[file.type])throw new Error('Choose a JPG, PNG, WebP, GIF or AVIF image');
    if(file.size>10*1024*1024)throw new Error('Each image must be smaller than 10 MB');
    const suffix=typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path=`${user.id}/${suffix}.${types[file.type]}`;
    const {error}=await client.storage.from(config.bucket||'portfolio-media').upload(path,file,{cacheControl:'3600',contentType:file.type,upsert:false});
    if(error)throw error;
    const {data}=client.storage.from(config.bucket||'portfolio-media').getPublicUrl(path);
    if(!data?.publicUrl)throw new Error('Could not create an image URL');
    return data.publicUrl;
  }
  async function doUpload(files,assign){
    if(!files.length)return;
    setBusy(true);
    try{
      for(const file of files){showMessage(`Uploading ${file.name}…`);const url=await uploadImage(file);assign(url)}
      setDirty(true);showMessage('Image uploaded! Select Save & publish to use it on your public website.');render();
    }catch(error){showMessage('Image upload failed: '+error.message,'bad')}
    finally{setBusy(false)}
  }
  function uploader(title,callback,multiple=false){
    const wrap=el('div','file-picker');wrap.append(el('strong','',title),el('p','','')); // no-op text below
    wrap.lastChild.textContent='JPG, PNG, WebP, GIF or AVIF · 10 MB maximum per file';
    const input=el('input');input.type='file';input.accept='image/jpeg,image/png,image/webp,image/gif,image/avif';input.multiple=multiple;input.setAttribute('aria-label',title);
    const submit=button('Upload image'+(multiple?'s':''),()=>doUpload(Array.from(input.files||[]),callback),'action-button');
    wrap.append(input,submit);return wrap;
  }
  function render(){
    if(!draft)return;
    document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===selectedTab));
    editor.replaceChildren();
    if(selectedTab==='overview')renderOverview();
    if(selectedTab==='projects')renderProjects();
    if(selectedTab==='photos')renderPhotos();
    if(selectedTab==='text')renderText();
    if(selectedTab==='tools')renderTools();
    if(selectedTab==='settings')renderSettings();
  }
  function renderOverview(){
    editor.append(section('Dashboard','A quick look at your portfolio content.'));
    const grid=el('div','two-col');
    for(const [count,title] of [[draft.projects.length,'Projects'],[draft.photos.length,'Gallery photographs']]){
      const box=el('div','mini-card');box.append(el('span','count',String(count)),el('small','',title));grid.append(box);
    }
    editor.append(grid);
    const panel=el('div','subpanel');panel.append(el('h3','','Your next update'),el('p','muted','You can manage your website independently. Choose a section on the left, make changes, upload images, then select Save & publish. Both language versions are editable.'));
    const bar=el('div','row-actions');bar.append(button('＋ Add project',()=>{selectedTab='projects';selectedProject=-1;addProject()}),button('＋ Add photo',()=>{selectedTab='photos';selectedPhoto=-1;addPhoto()}),button('✎ Edit introduction',()=>{selectedTab='text';render()}));panel.append(bar);editor.append(panel);
  }
  function addProject(){
    const id='project-'+(typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36));
    draft.projects.push({id,title:'New project',year:String(new Date().getFullYear()),images:[],alt:{en:[],no:[]},cardLabel:{en:'PROJECT',no:'PROSJEKT'},category:{en:'CREATIVE WORK',no:'KREATIVT ARBEID'},en:{kicker:'PERSONAL PROJECT',description:'',role:'',tools:'',disclaimer:''},no:{kicker:'EGET PROSJEKT',description:'',role:'',tools:'',disclaimer:''}});
    selectedProject=draft.projects.length-1;setDirty();render();
  }
  function listRow(img,title,subtitle){
    const row=el('div','list-item');const image=el('img');image.src=safeImage(img);image.alt='';image.loading='lazy';const info=el('div','info');info.append(el('strong','',title),el('small','',subtitle));const actions=el('div','row-actions');row.append(image,info,actions);return {row,actions};
  }
  function moveItem(collection,i,by,selectedKey){
    const other=i+by;if(other<0||other>=collection.length)return;
    [collection[i],collection[other]]=[collection[other],collection[i]];
    if(selectedKey==='project')selectedProject=other;else selectedPhoto=other;
    setDirty();render();
  }
  function renderProjects(){
    const head=section('Projects','Add, edit and reorder projects. Photos uploaded here appear in the project pop-up and the first picture becomes the cover.');
    head.append(button('＋ New project',addProject));editor.append(head);
    if(!draft.projects.length)editor.append(el('p','empty','No projects yet. Select New project to start.'));
    const list=el('div','list');
    draft.projects.forEach((p,i)=>{
      const {row,actions}=listRow(p.images?.[0],p.title||'Untitled',p.year+' · '+(p.category?.en||'Project'));
      actions.append(button('Edit',()=>{selectedProject=i;render()}),button('↑',()=>moveItem(draft.projects,i,-1,'project'),'action-button neutral compact'),button('↓',()=>moveItem(draft.projects,i,1,'project'),'action-button neutral compact'),button('Delete',()=>{if(confirm('Remove this project from the website?')){draft.projects.splice(i,1);selectedProject=-1;setDirty();render()}} ,'action-button danger compact'));
      list.append(row);
    });editor.append(list);
    if(selectedProject>=0&&selectedProject<draft.projects.length){
      const i=selectedProject,p=draft.projects[i],panel=el('div','subpanel');panel.append(el('h3','','Edit: '+p.title));
      const grid=el('div','field-grid');grid.append(field('Project title',p.title,`projects.${i}.title`),field('Year',p.year,`projects.${i}.year`));panel.append(grid);
      for(const [label,path] of [['Card label (e.g. PAID WORK)',`projects.${i}.cardLabel`],['Category shown on card',`projects.${i}.category`]])panel.append(twoLang(label,path));
      for(const [label,key,large] of [['Project type / date','kicker',false],['Full project description','description',true],['Your role','role',false],['Tools / context','tools',false],['Optional note / disclaimer','disclaimer',true]]){
        const wrap=el('div','field-card');wrap.append(el('strong','',label));const paired=el('div','paired');
        for(const lang of ['en','no'])paired.append(field(lang==='en'?'🇬🇧 English':'🇳🇴 Norwegian',p[lang]?.[key]||'',`projects.${i}.${lang}.${key}`,large));
        wrap.append(paired);panel.append(wrap);
      }
      panel.append(el('h3','','Project images'));
      const previews=el('div','preview-grid');
      (p.images||[]).forEach((src,index)=>{
        const tile=el('div','preview');const img=el('img');img.src=safeImage(src);img.alt='Project image '+(index+1);
        tile.append(img,button('Remove',()=>{p.images.splice(index,1);for(const lang of ['en','no'])p.alt?.[lang]?.splice(index,1);setDirty();render()},'action-button danger compact'));previews.append(tile);
      });panel.append(previews);
      panel.append(uploader('Add project pictures',url=>{p.images.push(url);p.alt.en.push(p.title);p.alt.no.push(p.title)},true));
      panel.append(el('p','hint','Pictures are published only after Save & publish. The first image is the cover; you can remove an image and upload it again to change the order.'));
      panel.append(button('Close editor',()=>{selectedProject=-1;render()},'action-button neutral'));
      editor.append(panel);
    }
  }
  function addPhoto(){
    draft.photos.push({src:'',group:'other',en:'New photograph',no:'Nytt fotografi'});
    selectedPhoto=draft.photos.length-1;setDirty();render();
  }
  function renderPhotos(){
    const head=section('Photography','Add pictures to the main gallery, manage captions and reorder your photos.');head.append(button('＋ Add photograph',addPhoto));editor.append(head);
    if(!draft.photos.length)editor.append(el('p','empty','No gallery photographs yet.'));
    const list=el('div','list');draft.photos.forEach((p,i)=>{
      const {row,actions}=listRow(p.src,p.en||'Photo',p.group||'other');
      actions.append(button('Edit',()=>{selectedPhoto=i;render()}),button('↑',()=>moveItem(draft.photos,i,-1,'photo'),'action-button neutral compact'),button('↓',()=>moveItem(draft.photos,i,1,'photo'),'action-button neutral compact'),button('Delete',()=>{if(confirm('Remove this photograph from your gallery?')){draft.photos.splice(i,1);selectedPhoto=-1;setDirty();render()}},'action-button danger compact'));
      list.append(row);
    });editor.append(list);
    if(selectedPhoto>=0&&selectedPhoto<draft.photos.length){
      const i=selectedPhoto,p=draft.photos[i],panel=el('div','subpanel');panel.append(el('h3','','Edit photograph'));
      const img=el('img');img.src=safeImage(p.src);img.alt='Current gallery image';img.style.cssText='width:100%;max-width:430px;max-height:280px;object-fit:contain;border-radius:9px;background:#101016;display:block;margin:18px 0';panel.append(img);
      panel.append(uploader('Upload or replace photograph',url=>{p.src=url}));
      const group=el('label','form-field','Gallery category');const select=el('select');select.dataset.path=`photos.${i}.group`;
      [['motorshow','Oslo Motorshow'],['ukm','UKM concerts'],['other','Other photography']].forEach(([value,label])=>{const opt=el('option','',label);opt.value=value;opt.selected=value===p.group;select.append(opt)});group.append(select);panel.append(group);
      const captionBox=el('div','field-card');captionBox.append(el('strong','','Photo caption'));const paired=el('div','paired');paired.append(field('🇬🇧 English',p.en,`photos.${i}.en`),field('🇳🇴 Norwegian',p.no,`photos.${i}.no`));captionBox.append(paired);panel.append(captionBox);
      panel.append(button('Close editor',()=>{selectedPhoto=-1;render()},'action-button neutral'));editor.append(panel);
    }
  }
  const sections={
    'Homepage':['heroEyebrow','heroRole','heroDescription','seeWork','getInTouch','portraitNote','scrollToExplore'],
    'Selected work':['workEyebrow','selected','work','workIntro','projectSchool','projectPaidWork','diadCategory','motorshowCategory','ukmCategory','albumCategory','reworkCategory'],
    'About me':['aboutEyebrow','beyond','theLens','aboutP1','aboutP2','aboutP3','aboutP4','aboutCaption','aboutLabelLocation','aboutLabelFocus','aboutFocus'],
    'What I do / skills':['expertiseEyebrow','what','do','expertiseIntro','servicePhoto','servicePhotoDesc','serviceVideo','serviceVideoDesc','serviceCreative','serviceCreativeDesc','servicePeople','servicePeopleDesc'],
    'Tools & interests':['toolsEyebrow','toolsHelper','toolMyUse','toolClose','toolPhotography','toolMarketing','toolSocial'],
    'Photography':['photoEyebrow','photography','photoIntro','filterAll','filterMotorshow','filterConcerts','filterOther'],
    'Contact':['contactEyebrow','haveIdea','letsTalk','contactIntro','contactEmail'],
    'Navigation & footer':['navWork','navAbout','navExpertise','navPhotography','navContact','footerMade','backTop'],
    'Accessibility / other':['skip','dialogRole','dialogTools','dialogYear','backProjects','profileAlt','forestAlt','forest2Alt','menuOpen','menuClose','filterAria','closeProject','closePhoto','previousPhoto','nextPhoto','viewProject','enlargePhoto','toolCloseAria','toolOpenAria','toolGroupAria','pageDescription']
  };
  function textEditorCard(key){
    const box=el('div','field-card');const pretty=key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,s=>s.toUpperCase());
    box.append(el('strong','',pretty));const pair=el('div','paired');
    for(const lang of ['en','no'])pair.append(field(lang==='en'?'🇬🇧 English':'🇳🇴 Norwegian',draft.copy[lang]?.[key]??defaults.copy[lang]?.[key]??'',`copy.${lang}.${key}`,String(draft.copy.en?.[key]||'').length>85));
    box.append(pair);return box;
  }
  function renderText(){
    editor.append(section('Website text','Edit every section in English and Norwegian. You can translate or rewrite all visible labels and paragraphs.'));
    const label=el('label','search-label','Find a text field');const search=el('input');search.placeholder='Search e.g. about, intro, contact, photography…';search.type='search';label.append(search);editor.append(label);
    const list=el('div');editor.append(list);
    function draw(term=''){
      list.replaceChildren();let count=0;
      Object.entries(sections).forEach(([name,keys])=>{
        const valid=keys.filter(k=>Object.hasOwn(draft.copy.en,k)&&(!term||k.toLowerCase().includes(term)||name.toLowerCase().includes(term)||String(draft.copy.en[k]).toLowerCase().includes(term)));
        if(!valid.length)return;
        count+=valid.length;
        const details=el('details','text-group');details.open=!!term||name==='Homepage';details.append(el('summary','',name+' · '+valid.length+' fields'));
        valid.forEach(key=>details.append(textEditorCard(key)));
        list.append(details);
      });
      if(!count)list.append(el('p','text-empty','No matching text fields.'));
    }
    draw();search.addEventListener('input',()=>draw(search.value.toLowerCase().trim()));
  }
  function renderTools(){
    editor.append(section('Tools & interests','Edit the descriptions shown when someone clicks a tool on the public portfolio.'));
    const options=el('div','row-actions');
    Object.entries(draft.toolShowcases||{}).forEach(([key,item])=>options.append(button(typeof item.name==='string'?item.name:item.name.en,()=>{selectedTool=key;render()},'action-button '+(key===selectedTool?'':'neutral')+' compact')));
    editor.append(options);
    const item=draft.toolShowcases[selectedTool];if(!item)return;
    const panel=el('div','subpanel');panel.append(el('h3','',typeof item.name==='string'?item.name:item.name.en));
    const logo=el('img');logo.src=safeImage(item.icon);logo.alt='';logo.style.cssText='width:68px;height:68px;object-fit:contain;margin:8px';panel.append(logo);
    for(const [name,key,large] of [['Tool category','category',false],['What is it?','description',true],['How I use it','personal',true]]){
      const wrap=el('div','field-card');wrap.append(el('strong','',name));const paired=el('div','paired');
      for(const lang of ['en','no'])paired.append(field(lang==='en'?'🇬🇧 English':'🇳🇴 Norwegian',item[lang]?.[key],`toolShowcases.${selectedTool}.${lang}.${key}`,large));
      wrap.append(paired);panel.append(wrap);
    }
    editor.append(panel);
  }
  function renderSettings(){
    editor.append(section('Settings & portraits','Update contact information and replace pictures of yourself without changing any website code.'));
    const panel=el('div','subpanel');panel.append(el('h3','','Identity & contact'),field('Name displayed on homepage',draft.settings.displayName||'Gleb Diadiurenko','settings.displayName'),field('Public contact email',draft.settings.email,'settings.email'),field('Instagram URL',draft.settings.instagram,'settings.instagram'));editor.append(panel);
    const images=[['portraitUrl','Homepage profile picture'],['aboutImageUrl','About me — first picture'],['aboutSecondaryUrl','About me — second picture']];
    images.forEach(([key,title])=>{
      const block=el('div','image-setting');block.append(el('h3','',title));const img=el('img');img.alt=title;img.src=safeImage(draft.settings[key]);block.append(img);
      block.append(uploader('Replace '+title.toLowerCase(),url=>{draft.settings[key]=url}));editor.append(block);
    });
    editor.append(el('p','hint','The uploaded photos are public images. Use pictures you have permission to publish.'));
  }
  function bind(){
    byId('loginForm').addEventListener('submit',login);byId('signOut').addEventListener('click',logout);byId('saveButton').addEventListener('click',save);
    byId('adminNav').addEventListener('click',e=>{const btn=e.target.closest('[data-tab]');if(!btn)return;selectedTab=btn.dataset.tab;selectedProject=-1;selectedPhoto=-1;render()});
    editor.addEventListener('input',event=>{
      const input=event.target;if(!input.dataset.path)return;
      pathSet(draft,input.dataset.path,input.value);setDirty(true);
    });
    editor.addEventListener('change',event=>{
      const input=event.target;if(input.dataset.path&&input.tagName==='SELECT'){pathSet(draft,input.dataset.path,input.value);setDirty(true)}
    });
    window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
  }
  document.addEventListener('DOMContentLoaded',()=>{bind();init().catch(e=>{show('setupView');console.error(e)})});
})();
