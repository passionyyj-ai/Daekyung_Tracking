let inboundRows=[];
let inboundGroups=[];

function inboundValue(row,names){
  for(const name of names){
    if(Object.prototype.hasOwnProperty.call(row,name)&&String(row[name]??'').trim()!=='')return row[name];
  }
  return '';
}
function inboundText(value){return String(value??'').trim();}
function inboundNormalizeName(value){return inboundText(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g,'');}
function inboundTransactionType(detailType){
  const normalized=inboundNormalizeName(detailType);
  return /반품|회수/.test(normalized)?'회수':'입고';
}
function inboundLegacySourceKey(row){
  return ['inbound',row.slip,row.externalCode,row.lot,row.serial,row.date,row.sourceRow].join('|');
}
function inboundSourceKey(row){
  return [inboundLegacySourceKey(row),inboundTransactionType(row.detailType)].join('|');
}
function inboundSourceId(row){return `tx-inbound-${shortStableHash(inboundSourceKey(row))}`;}
function inboundMappings(){
  state.settings=state.settings||{};
  state.settings.inboundProductMappings=state.settings.inboundProductMappings||{};
  return state.settings.inboundProductMappings;
}
function inboundProductLabel(product){return product?`${product.id} | ${product.name}`:'';}
function inboundProductFromLabel(value){
  const text=inboundText(value),id=text.split('|')[0].trim();
  return state.products.find(product=>String(product.id)===id)||state.products.find(product=>inboundNormalizeName(product.name)===inboundNormalizeName(text));
}
function findAutomaticInboundProduct(externalCode,sourceName){
  const savedId=inboundMappings()[externalCode];
  const saved=state.products.find(product=>String(product.id)===String(savedId||''));
  if(saved)return {product:saved,method:'저장 매칭'};
  const normalized=inboundNormalizeName(sourceName);
  const exact=state.products.filter(product=>inboundNormalizeName(product.name)===normalized);
  if(exact.length===1)return {product:exact[0],method:'제품명 자동'};
  return {product:null,method:''};
}
function buildInboundGroups(){
  const map=new Map();
  inboundRows.forEach(row=>{
    const key=`${row.externalCode}\u001f${row.sourceName}`;
    if(!map.has(key)){
      const match=findAutomaticInboundProduct(row.externalCode,row.sourceName);
      map.set(key,{key,externalCode:row.externalCode,sourceName:row.sourceName,rowCount:0,qty:0,productId:match.product?.id||'',method:match.method});
    }
    const group=map.get(key);group.rowCount++;group.qty+=Number(row.qty||0);
  });
  inboundGroups=[...map.values()].sort((a,b)=>Number(!a.productId)-Number(!b.productId)||a.externalCode.localeCompare(b.externalCode,'ko'));
}
function populateInboundProductOptions(){
  const list=byId('inboundProductOptions');if(!list)return;
  list.innerHTML=state.products.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id),'ko')).map(product=>`<option value="${escapeHtml(inboundProductLabel(product))}"></option>`).join('');
}
function escapeHtml(value){
  return String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
}
function handleInboundFile(event){
  const file=event.target.files?.[0];if(!file)return;
  byId('inboundFileName').textContent=file.name;
  readWorkbook(file,rows=>{
    inboundRows=rows.map((row,index)=>({
      sourceRow:index+2,
      slip:inboundText(inboundValue(row,['전표번호'])),
      date:normalizeDate(inboundValue(row,['입고일','날짜'])),
      warehouse:inboundText(inboundValue(row,['입고창고'])),
      qty:parseNumber(inboundValue(row,['배송수량','수량'])),
      externalCode:inboundText(inboundValue(row,['제품코드','품목코드'])),
      sourceName:inboundText(inboundValue(row,['제품명','품목명'])),
      lot:inboundText(inboundValue(row,['LOT_NO','LOT NO','LOT'])),
      serial:inboundText(inboundValue(row,['SERIAL_NO','SERIAL NO','SERIAL'])),
      detailType:inboundText(inboundValue(row,['상세구분']))
    })).filter(row=>row.externalCode||row.sourceName||row.qty);
    if(!inboundRows.length){alert('입고자료에서 제품코드·제품명·배송수량을 찾지 못했습니다.');return;}
    buildInboundGroups();
    populateInboundProductOptions();
    ['inboundSummaryCard','inboundMappingCard','inboundPreviewCard'].forEach(id=>byId(id)?.classList.remove('hidden'));
    renderInboundAll();
  });
}
function groupForInboundRow(row){return inboundGroups.find(group=>group.key===`${row.externalCode}\u001f${row.sourceName}`);}
function existingInboundKeys(){
  return new Set((state.transactions||[]).map(tx=>tx.inboundSourceKey||tx.sourceKey||'').filter(Boolean));
}
function inboundRowStatus(row,existingKeys=existingInboundKeys()){
  const group=groupForInboundRow(row);
  if(!row.qty)return {key:'invalid',label:'수량 없음'};
  if(!row.date)return {key:'invalid',label:'일자 없음'};
  if(!group?.productId)return {key:'unmatched',label:'매칭 필요'};
  if(isMonthClosed(row.date))return {key:'closed',label:'마감월'};
  if(existingKeys.has(inboundSourceKey(row))||existingKeys.has(inboundLegacySourceKey(row))||(state.transactions||[]).some(tx=>String(tx.id)===inboundSourceId(row)))return {key:'duplicate',label:'이미 등록'};
  return {key:'ready',label:'등록 가능'};
}
function renderInboundSummary(){
  const existing=existingInboundKeys();
  const statusRows=inboundRows.map(row=>inboundRowStatus(row,existing));
  byId('inboundRowCount').textContent=qty(inboundRows.length);
  byId('inboundQtyTotal').textContent=qty(inboundRows.reduce((sum,row)=>sum+Number(row.qty||0),0));
  byId('inboundProductCount').textContent=qty(inboundGroups.length);
  byId('inboundMatchedCount').textContent=qty(inboundGroups.filter(group=>group.productId).length);
  byId('inboundUnmatchedCount').textContent=qty(inboundGroups.filter(group=>!group.productId).length);
  byId('inboundDuplicateCount').textContent=qty(statusRows.filter(status=>status.key==='duplicate').length);
  const readyRows=inboundRows.filter((row,index)=>statusRows[index].key==='ready');
  const incomingRows=readyRows.filter(row=>inboundTransactionType(row.detailType)==='입고');
  const recoveryRows=readyRows.filter(row=>inboundTransactionType(row.detailType)==='회수');
  if(byId('inboundIncomingCount'))byId('inboundIncomingCount').textContent=qty(incomingRows.length);
  if(byId('inboundRecoveryCount'))byId('inboundRecoveryCount').textContent=qty(recoveryRows.length);
  const ready=statusRows.filter(status=>status.key==='ready').length;
  byId('inboundCommitHint').textContent=`현재 ${ready.toLocaleString('ko-KR')}건(입고 ${incomingRows.length.toLocaleString('ko-KR')}건 / 회수 ${recoveryRows.length.toLocaleString('ko-KR')}건)을 등록할 수 있습니다.`;
  byId('inboundCommitBtn').disabled=ready===0;
}
function renderInboundMappings(){
  const body=byId('inboundMappingTable');if(!body)return;
  const query=inboundNormalizeName(byId('inboundMappingSearch')?.value||'');
  const filter=byId('inboundMappingFilter')?.value||'all';
  const rows=inboundGroups.filter(group=>{
    if(filter==='matched'&&!group.productId)return false;
    if(filter==='unmatched'&&group.productId)return false;
    return !query||inboundNormalizeName(`${group.externalCode} ${group.sourceName}`).includes(query);
  });
  body.innerHTML=rows.map(group=>{
    const product=state.products.find(item=>String(item.id)===String(group.productId||''));
    const status=product?`<span class="pill ok">${escapeHtml(group.method||'매칭 완료')}</span>`:'<span class="pill warn">매칭 필요</span>';
    return `<tr data-group-key="${escapeHtml(group.key)}"><td>${status}</td><td>${escapeHtml(group.externalCode)}</td><td>${escapeHtml(group.sourceName)}</td><td>${qty(group.rowCount)}</td><td>${qty(group.qty)}</td><td><input class="inbound-product-match" list="inboundProductOptions" value="${escapeHtml(inboundProductLabel(product))}" placeholder="ID 또는 품목명 검색" onchange="changeInboundMapping(${inboundGroups.indexOf(group)},this.value)"></td></tr>`;
  }).join('')||'<tr><td colspan="6" class="empty">조건에 맞는 제품이 없습니다.</td></tr>';
}
function changeInboundMapping(groupIndex,value){
  const group=inboundGroups[Number(groupIndex)];if(!group)return;
  const product=inboundProductFromLabel(value);
  group.productId=product?.id||'';
  group.method=product?'수동 선택':'';
  renderInboundAll();
}
function saveInboundMappings(){
  const mappings=inboundMappings();let saved=0;
  inboundGroups.forEach(group=>{if(group.externalCode&&group.productId){mappings[group.externalCode]=group.productId;saved++;}});
  saveState('inbound-product-mapping');
  renderInboundAll();
  alert(`제품코드 매칭 ${saved}건을 저장했습니다.`);
}
function renderInboundPreview(){
  const body=byId('inboundPreviewTable');if(!body)return;
  const existing=existingInboundKeys();
  body.innerHTML=inboundRows.slice(0,500).map(row=>{
    const group=groupForInboundRow(row),product=state.products.find(item=>String(item.id)===String(group?.productId||'')),status=inboundRowStatus(row,existing),txType=inboundTransactionType(row.detailType);
    return `<tr><td><span class="pill ${status.key==='ready'?'ok':status.key==='unmatched'||status.key==='invalid'?'warn':''}">${status.label}</span></td><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.slip)}</td><td>${escapeHtml(row.detailType||'-')}</td><td><span class="pill ${txType==='회수'?'warn':'ok'}">${txType}</span></td><td>${escapeHtml(row.externalCode)}</td><td>${escapeHtml(product?inboundProductLabel(product):'')}</td><td>${qty(row.qty)}</td><td>${escapeHtml(row.lot)}</td><td>${escapeHtml(row.serial)}</td></tr>`;
  }).join('')||'<tr><td colspan="10" class="empty">업로드한 자료가 없습니다.</td></tr>';
}
function renderInboundAll(){renderInboundSummary();renderInboundMappings();renderInboundPreview();}
function commitInboundTransactions(){
  const existing=existingInboundKeys(),now=new Date().toISOString();
  let added=0,incoming=0,recovery=0,duplicate=0,unmatched=0,invalid=0,closed=0;
  const newRows=[];
  inboundRows.forEach(row=>{
    const status=inboundRowStatus(row,existing);
    if(status.key!=='ready'){
      if(status.key==='duplicate')duplicate++;else if(status.key==='unmatched')unmatched++;else if(status.key==='closed')closed++;else invalid++;
      return;
    }
    const group=groupForInboundRow(row),sourceKey=inboundSourceKey(row),txType=inboundTransactionType(row.detailType);
    newRows.push({
      id:inboundSourceId(row),date:row.date,location:'사무실',type:txType,productId:group.productId,qty:Number(row.qty||0),
      memo:[`입고자료 전표 ${row.slip||'-'}`,`제품코드 ${row.externalCode||'-'}`,row.detailType?`상세구분 ${row.detailType}`:'',row.lot?`LOT ${row.lot}`:'',row.serial?`SERIAL ${row.serial}`:'',row.warehouse?`창고 ${row.warehouse}`:''].filter(Boolean).join(' / '),
      source:'inbound-import',inboundSourceKey:sourceKey,externalProductCode:row.externalCode,sourceProductName:row.sourceName,slipNumber:row.slip,lotNo:row.lot,serialNo:row.serial,createdAt:now,updatedAt:now
    });
    existing.add(sourceKey);added++;if(txType==='회수')recovery++;else incoming++;
  });
  if(!added){alert('등록 가능한 입고·회수 자료가 없습니다. 제품 매칭과 중복·마감 상태를 확인하세요.');return;}
  if(!confirm(`사무실 거래 ${added.toLocaleString('ko-KR')}건(입고 ${incoming.toLocaleString('ko-KR')}건 / 회수 ${recovery.toLocaleString('ko-KR')}건)을 등록할까요?\n동일 자료는 다시 업로드해도 중복 등록되지 않습니다.`))return;
  state.transactions.unshift(...newRows);
  inboundGroups.forEach(group=>{if(group.externalCode&&group.productId)inboundMappings()[group.externalCode]=group.productId;});
  addHistory('사무실 입고·회수자료 업로드',byId('inboundFileName')?.textContent||'입고자료',added);
  byId('inboundCommitResult').innerHTML=`<span class="pill ok">${added}건 등록 완료</span> <span class="pill">입고 ${incoming}건</span> <span class="pill warn">회수 ${recovery}건</span>${duplicate?` <span class="pill">중복 ${duplicate}건 제외</span>`:''}${unmatched?` <span class="pill warn">미매칭 ${unmatched}건 제외</span>`:''}${closed?` <span class="pill warn">마감월 ${closed}건 제외</span>`:''}${invalid?` <span class="pill warn">자료 오류 ${invalid}건 제외</span>`:''}`;
  renderInboundAll();
}
document.addEventListener('DOMContentLoaded',populateInboundProductOptions);
window.addEventListener('dk-state-updated',()=>{if(inboundRows.length){buildInboundGroups();populateInboundProductOptions();renderInboundAll();}});
