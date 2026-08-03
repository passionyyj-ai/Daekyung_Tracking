
function renderMaster(){
  ensureV6State();
  const id=String(byId('masterId')?.value||'').toLowerCase().trim();
  const cat=byId('masterCat')?.value||'';
  const kw=String(byId('masterSearch')?.value||'').toLowerCase().trim();
  const rows=state.products
    .filter(p=>!id || String(p.id||'').toLowerCase().includes(id))
    .filter(p=>!cat || (p.category||'미분류')===cat)
    .filter(p=>!kw || String(p.name||'').toLowerCase().includes(kw))
    .map(p=>`<tr>
      <td>${p.id}</td>
      <td>${p.category||''}</td>
      <td>${p.name||''}</td>
      <td>${money(p.purchasePrice)}</td>
      <td>${money(defaultSalePrice(p))}</td>
      <td>${qty(currentQty(p))}</td>
      <td><a class="btn small-btn" href="hospital_price.html?productId=${encodeURIComponent(p.id)}">관리</a></td>
      <td><button class="btn small-btn" onclick="editProductMaster('${p.id}')">수정</button></td>
    </tr>`);
  byId('masterTable').innerHTML=rows.join('')||'<tr><td colspan="8" class="empty">품목이 없습니다.</td></tr>';
}
function editProductMaster(id){
  const p=productById(id); if(!p) return;
  byId('pmId').value=p.id;
  byId('pmCat').value=p.category||'';
  byId('pmName').value=p.name||'';
  byId('pmPurchase').value=p.purchasePrice||0;
  byId('pmDefaultSale').value=defaultSalePrice(p);
  window.scrollTo({top:0,behavior:'smooth'});
}
function clearProductMasterForm(){
  ['pmId','pmCat','pmName'].forEach(id=>byId(id).value='');
  ['pmPurchase','pmDefaultSale'].forEach(id=>byId(id).value=0);
}
function normalizeProductName(value){
  return String(value||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
}
function nextAvailableProductId(reservedIds){
  const reserved=reservedIds||new Set((state.products||[]).map(p=>String(p.id||'').trim()).filter(Boolean));
  let max=0;
  reserved.forEach(id=>{const match=/^P(\d+)$/i.exec(id);if(match)max=Math.max(max,Number(match[1]));});
  let candidate='';
  do{max+=1;candidate=`P${String(max).padStart(3,'0')}`;}while(reserved.has(candidate));
  reserved.add(candidate);
  return candidate;
}
function migrateProductReferences(oldId,newId){
  if(!oldId||oldId===newId)return;
  (state.transactions||[]).forEach(t=>{if(t.productId===oldId)t.productId=newId;});
  (state.overuses||[]).forEach(o=>{if(o.productId===oldId)o.productId=newId;});
  (state.hospitalPrices||[]).forEach(x=>{if(x.productId===oldId)x.productId=newId;});
  ['system','physical','result'].forEach(k=>(state.audit?.[k]||[]).forEach(x=>{
    if(x.productId===oldId)x.productId=newId;
    if(x.id===oldId)x.id=newId;
  }));
  (state.monthlyClosings||[]).forEach(closing=>(closing.lines||[]).forEach(line=>{
    if(line.productId===oldId)line.productId=newId;
  }));
  state.settings=state.settings||{};
  const mappings=state.settings.inboundMappings||{};
  Object.keys(mappings).forEach(key=>{if(mappings[key]===oldId)mappings[key]=newId;});
  state.settings.productIdAliases=state.settings.productIdAliases||{};
  Object.keys(state.settings.productIdAliases).forEach(key=>{
    if(state.settings.productIdAliases[key]===oldId)state.settings.productIdAliases[key]=newId;
  });
  state.settings.productIdAliases[oldId]=newId;
}
function saveProductMaster(){
  ensureV6State();
  const id=byId('pmId').value.trim() || `P${String(state.products.length+1).padStart(3,'0')}`;
  const name=byId('pmName').value.trim();
  if(!name) return alert('품목명을 입력하세요.');
  let p=productById(id) || state.products.find(x=>x.name===name);
  const oldId=p?.id||id;
  if(!p){
    p={id, name, category:'', purchasePrice:0, defaultSalePrice:0, stock:{}};
    state.products.push(p);
  }
  p.id=id;
  p.name=name;
  p.category=byId('pmCat').value.trim()||'미분류';
  p.purchasePrice=parseNumber(byId('pmPurchase').value);
  p.defaultSalePrice=parseNumber(byId('pmDefaultSale').value);
  migrateProductReferences(oldId,id);
  addHistory('품목저장',name,1);
  categoryOptions(byId('masterCat'),true);
  renderMaster();
  clearProductMasterForm();
}
function handleMasterUpload(e){
  const file=e.target.files[0]; if(!file) return;
  readWorkbook(file, rows=>{
    ensureV6State();
    const normalizedRows=(rows||[]).map(r=>({
      raw:r,
      name:String(r['품목명']||'').trim(),
      normalizedName:normalizeProductName(r['품목명']),
      requestedId:String(r['ID']||r['품목ID']||'').trim()
    })).filter(r=>r.name);
    const seenNames=new Set();
    let duplicateRows=0;
    const uploadRows=normalizedRows.filter(r=>{
      if(seenNames.has(r.normalizedName)){duplicateRows++;return false;}
      seenNames.add(r.normalizedName);return true;
    });
    const existingByName=new Map((state.products||[]).map(p=>[normalizeProductName(p.name),p]));
    const reservedIds=new Set((state.products||[]).map(p=>String(p.id||'').trim()).filter(Boolean));
    const requestedNewIds=new Set();
    let matched=0,idChanges=0,newItems=0,generatedIds=0,conflicts=0;
    const plan=[];
    uploadRows.forEach(row=>{
      const current=existingByName.get(row.normalizedName)||null;
      let targetId=row.requestedId;
      if(current){
        matched++;
        if(!targetId)targetId=String(current.id||'').trim()||nextAvailableProductId(reservedIds);
      }else if(!targetId){
        targetId=nextAvailableProductId(reservedIds);generatedIds++;
      }
      const owner=(state.products||[]).find(p=>String(p.id||'').trim()===targetId);
      const uploadDuplicate=requestedNewIds.has(targetId) && (!current||String(current.id||'')!==targetId);
      if((owner&&owner!==current)||uploadDuplicate){conflicts++;return;}
      requestedNewIds.add(targetId);
      if(current&&String(current.id||'')!==targetId)idChanges++;
      if(!current)newItems++;
      plan.push({row,current,targetId});
    });
    if(!plan.length){
      byId('masterUploadResult').innerHTML=`<span class="pill danger">반영할 품목이 없습니다. ID 충돌 ${conflicts}건</span>`;
      e.target.value='';return;
    }
    const summary=`품목명 기준으로 ${plan.length}건을 반영합니다.\n\n기존 품목 매칭: ${matched}건\nID 변경: ${idChanges}건\n신규 품목: ${newItems}건\n신규 ID 자동 부여: ${generatedIds}건\n충돌로 제외: ${conflicts}건\n중복 품목명 행 제외: ${duplicateRows}건\n\n계속할까요?`;
    if(!confirm(summary)){e.target.value='';return;}
    try{localStorage.setItem(`DK_MASTER_UPLOAD_BACKUP_${Date.now()}`,JSON.stringify(state));}catch(error){}
    plan.forEach(({row,current,targetId})=>{
      const r=row.raw;
      const p=current||{id:targetId,name:row.name,category:'미분류',purchasePrice:0,defaultSalePrice:0,stock:{}};
      const oldId=String(p.id||targetId);
      if(!current)state.products.push(p);
      p.id=targetId;
      p.name=row.name;
      p.category=String(r['제품카테고리']||r['카테고리']||p.category||'미분류').trim()||'미분류';
      if(r['매입단가']!==undefined&&r['매입단가']!=='')p.purchasePrice=parseNumber(r['매입단가']);
      const saleValue=r['기본판매단가']??r['판매단가']??r['판매단가(기타)'];
      if(saleValue!==undefined&&saleValue!=='')p.defaultSalePrice=parseNumber(saleValue);
      migrateProductReferences(oldId,targetId);
    });
    addHistory('품목업로드',`${file.name} / ID변경 ${idChanges}건 / 신규 ${newItems}건`,plan.length);
    byId('masterUploadResult').innerHTML=`<span class="pill ok">${plan.length}건 반영 · ID 변경 ${idChanges}건 · 신규 ${newItems}건</span>${conflicts?` <span class="pill danger">ID 충돌 ${conflicts}건 제외</span>`:''}`;
    categoryOptions(byId('masterCat'),true);
    renderMaster();
    e.target.value='';
  });
}
function downloadMasterUploadSample(){
  const rows=[['ID','제품카테고리','품목명','매입단가','기본판매단가'],['P999','Guidewire','Sample Guidewire',10000,15000]];
  download('ProductMaster_upload.csv',toCSV(rows),'text/csv;charset=utf-8');
}
function exportMasterCSV(){
  const rows=[['ID','제품카테고리','품목명','매입단가','기본판매단가','전체현재고']];
  state.products.forEach(p=>rows.push([p.id,p.category,p.name,p.purchasePrice,defaultSalePrice(p),currentQty(p)]));
  download('product_master.csv',toCSV(rows),'text/csv;charset=utf-8');
}
document.addEventListener('DOMContentLoaded',()=>{ensureV6State();categoryOptions(byId('masterCat'),true);renderMaster();});
