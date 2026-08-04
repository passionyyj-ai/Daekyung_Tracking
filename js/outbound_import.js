let outboundRows=[];
let outboundGroups=[];

function outboundText(value){return String(value??'').trim();}
function outboundEscapeHtml(value){return outboundText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function outboundNormalize(value){return outboundText(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g,'');}
function outboundColumn(row,index){const keys=Object.keys(row||{});return keys[index]===undefined?'':row[keys[index]];}
function outboundValue(row,names,fallbackIndex=-1){
  for(const name of names){if(Object.prototype.hasOwnProperty.call(row,name)&&outboundText(row[name])!=='')return row[name];}
  return fallbackIndex>=0?outboundColumn(row,fallbackIndex):'';
}
function outboundTransactionType(documentType){return outboundNormalize(documentType).includes('매입가납')?'선납':'';}
function outboundMemo(row){return [row.slip?`전표번호 ${row.slip}`:'',row.lot?`LOT ${row.lot}`:''].filter(Boolean).join(' / ');}
function outboundLegacySourceKey(row){return ['outbound',row.slip,row.externalCode,row.lot,row.date,row.qty,row.deliveryName,row.sourceRow].join('|');}
function outboundSourceKey(row){return [outboundLegacySourceKey(row),outboundNormalize(row.documentType),outboundTransactionType(row.documentType)].join('|');}
function outboundSourceId(row){return `tx-outbound-${shortStableHash(outboundSourceKey(row))}`;}
function outboundSettings(){
  state.settings=state.settings||{};
  state.settings.outboundProductMappings=state.settings.outboundProductMappings||{};
  state.settings.outboundCustomerMappings=state.settings.outboundCustomerMappings||{};
  return state.settings;
}
function outboundProductLabel(product){return product?`${product.id} | ${product.name}`:'';}
function outboundProductFromLabel(value){
  const text=outboundText(value),id=text.split('|')[0].trim();
  return state.products.find(product=>String(product.id)===id)||state.products.find(product=>outboundNormalize(product.name)===outboundNormalize(text));
}
function outboundCustomerFromLabel(value){
  const text=outboundText(value),code=text.split('|')[0].trim();
  return state.hospitals.find(row=>String(row.code||'')===code)||state.hospitals.find(row=>outboundNormalize(row.name)===outboundNormalize(text))||state.hospitals.find(row=>outboundNormalize(row.name)===outboundNormalize(text.split('|').slice(1).join('|')));
}
function outboundCustomerLabel(customer){return customer?`${customer.code||''} | ${customer.name}`.replace(/^\s*\|\s*/, ''):'';}
function findOutboundProduct(externalCode,sourceName){
  const savedId=outboundSettings().outboundProductMappings[externalCode];
  const saved=state.products.find(product=>String(product.id)===String(savedId||''));
  if(saved)return {product:saved,method:'저장 매칭'};
  const exact=state.products.filter(product=>outboundNormalize(product.name)===outboundNormalize(sourceName));
  return exact.length===1?{product:exact[0],method:'제품명 자동'}:{product:null,method:''};
}
function findOutboundCustomer(deliveryName){
  const settings=outboundSettings(),savedCode=settings.outboundCustomerMappings[outboundNormalize(deliveryName)];
  const saved=state.hospitals.find(row=>String(row.code||'')===String(savedCode||''));
  if(saved)return {customer:saved,method:'저장 매칭'};
  const exact=state.hospitals.filter(row=>outboundNormalize(row.name)===outboundNormalize(deliveryName));
  return exact.length===1?{customer:exact[0],method:'거래처명 자동'}:{customer:null,method:''};
}
function buildOutboundGroups(){
  const map=new Map();
  outboundRows.forEach(row=>{
    const key=[row.externalCode,row.sourceName,row.deliveryName].join('\u001f');
    if(!map.has(key)){
      const productMatch=findOutboundProduct(row.externalCode,row.sourceName),customerMatch=findOutboundCustomer(row.deliveryName);
      map.set(key,{key,externalCode:row.externalCode,sourceName:row.sourceName,deliveryName:row.deliveryName,rowCount:0,qty:0,productId:productMatch.product?.id||'',customerCode:customerMatch.customer?.code||'',productMethod:productMatch.method,customerMethod:customerMatch.method});
    }
    const group=map.get(key);group.rowCount++;group.qty+=Number(row.qty||0);
  });
  outboundGroups=[...map.values()].sort((a,b)=>Number(!(a.productId&&a.customerCode))-Number(!(b.productId&&b.customerCode))||a.deliveryName.localeCompare(b.deliveryName,'ko')||a.externalCode.localeCompare(b.externalCode,'ko'));
}
function populateOutboundOptions(){
  const products=byId('outboundProductOptions'),customers=byId('outboundCustomerOptions');
  if(products)products.innerHTML=state.products.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id),'ko')).map(product=>`<option value="${outboundEscapeHtml(outboundProductLabel(product))}"></option>`).join('');
  if(customers)customers.innerHTML=state.hospitals.slice().sort((a,b)=>String(a.code||'').localeCompare(String(b.code||''),'ko',{numeric:true})).map(customer=>`<option value="${outboundEscapeHtml(outboundCustomerLabel(customer))}"></option>`).join('');
}
function handleOutboundFile(event){
  const file=event.target.files?.[0];if(!file)return;
  byId('outboundFileName').textContent=file.name;
  readWorkbook(file,rows=>{
    outboundRows=rows.map((row,index)=>({
      sourceRow:index+2,
      slip:outboundText(outboundValue(row,['전표번호','문서번호','전표 No','전표NO'])),
      documentType:outboundText(outboundValue(row,['문서상세구분'],6)||outboundValue(row,['문서구분'],5)),
      date:normalizeDate(outboundValue(row,['출고일','출고일자','납품일','납품일자','날짜'])),
      deliveryName:outboundText(outboundValue(row,['납품처명','출고처명','거래처명','병원명'],21)),
      qty:parseNumber(outboundValue(row,['출고수량','배송수량','납품수량','수량','출고량'])),
      externalCode:outboundText(outboundValue(row,['제품코드','품목코드','상품코드','모델명'])),
      sourceName:outboundText(outboundValue(row,['제품명','품목명','상품명'])),
      lot:outboundText(outboundValue(row,['LOT_NO','LOT NO','LOT','LOT번호','로트번호']))
    })).filter(row=>row.slip||row.externalCode||row.sourceName||row.qty||row.deliveryName);
    if(!outboundRows.length){alert('출고자료에서 전표번호·제품코드·제품명·수량을 찾지 못했습니다.');return;}
    buildOutboundGroups();populateOutboundOptions();
    ['outboundSummaryCard','outboundMappingCard','outboundPreviewCard'].forEach(id=>byId(id)?.classList.remove('hidden'));
    renderOutboundAll();
  });
}
function outboundGroupForRow(row){return outboundGroups.find(group=>group.key===[row.externalCode,row.sourceName,row.deliveryName].join('\u001f'));}
function existingOutboundKeys(){return new Set((state.transactions||[]).flatMap(tx=>[tx.outboundSourceKey||tx.sourceKey||'',tx.outboundLegacySourceKey||'']).filter(Boolean));}
function outboundRowStatus(row,existing=existingOutboundKeys()){
  if(!outboundTransactionType(row.documentType))return {key:'unsupported',label:'문서구분 미지원'};
  if(!row.qty)return {key:'invalid',label:'수량 없음'};
  if(!row.date)return {key:'invalid',label:'일자 없음'};
  const group=outboundGroupForRow(row);
  if(!group?.productId)return {key:'unmatched',label:'품목 매칭 필요'};
  if(!group?.customerCode)return {key:'unmatched',label:'거래처 매칭 필요'};
  if(isMonthClosed(row.date))return {key:'closed',label:'마감월'};
  if(existing.has(outboundSourceKey(row))||existing.has(outboundLegacySourceKey(row))||(state.transactions||[]).some(tx=>String(tx.id)===outboundSourceId(row)))return {key:'duplicate',label:'이미 등록'};
  return {key:'ready',label:'등록 가능'};
}
function renderOutboundSummary(){
  const existing=existingOutboundKeys(),statuses=outboundRows.map(row=>outboundRowStatus(row,existing));
  const set=(id,value)=>{if(byId(id))byId(id).textContent=qty(value);};
  set('outboundRowCount',outboundRows.length);set('outboundQtyTotal',outboundRows.reduce((sum,row)=>sum+Number(row.qty||0),0));set('outboundGroupCount',outboundGroups.length);
  set('outboundReadyCount',statuses.filter(x=>x.key==='ready').length);set('outboundUnmatchedCount',statuses.filter(x=>x.key==='unmatched').length);set('outboundUnsupportedCount',statuses.filter(x=>x.key==='unsupported').length);set('outboundDuplicateCount',statuses.filter(x=>x.key==='duplicate').length);
  const ready=statuses.filter(x=>x.key==='ready').length;
  byId('outboundCommitHint').textContent=`현재 매입가납 ${ready.toLocaleString('ko-KR')}건을 선납으로 등록할 수 있습니다.`;
  byId('outboundCommitBtn').disabled=ready===0;
}
function renderOutboundMappings(){
  const body=byId('outboundMappingTable');if(!body)return;
  const query=outboundNormalize(byId('outboundMappingSearch')?.value||''),filter=byId('outboundMappingFilter')?.value||'all';
  const rows=outboundGroups.filter(group=>{
    const matched=!!(group.productId&&group.customerCode);
    if(filter==='matched'&&!matched)return false;if(filter==='unmatched'&&matched)return false;
    return !query||outboundNormalize(`${group.deliveryName} ${group.externalCode} ${group.sourceName}`).includes(query);
  });
  body.innerHTML=rows.map(group=>{
    const product=state.products.find(item=>String(item.id)===String(group.productId||'')),customer=state.hospitals.find(item=>String(item.code||'')===String(group.customerCode||'')),matched=product&&customer;
    return `<tr><td><span class="pill ${matched?'ok':'warn'}">${matched?'매칭 완료':'매칭 필요'}</span></td><td>${outboundEscapeHtml(group.deliveryName)}</td><td>${outboundEscapeHtml(group.externalCode)}</td><td>${outboundEscapeHtml(group.sourceName)}</td><td>${qty(group.rowCount)}</td><td>${qty(group.qty)}</td><td><input class="outbound-match-input" list="outboundCustomerOptions" value="${outboundEscapeHtml(outboundCustomerLabel(customer))}" placeholder="거래처 검색" onchange="changeOutboundCustomer(${outboundGroups.indexOf(group)},this.value)"></td><td><input class="outbound-match-input" list="outboundProductOptions" value="${outboundEscapeHtml(outboundProductLabel(product))}" placeholder="ID 또는 품목명 검색" onchange="changeOutboundProduct(${outboundGroups.indexOf(group)},this.value)"></td></tr>`;
  }).join('')||'<tr><td colspan="8" class="empty">조건에 맞는 자료가 없습니다.</td></tr>';
}
function changeOutboundCustomer(index,value){const group=outboundGroups[Number(index)],customer=outboundCustomerFromLabel(value);if(!group)return;group.customerCode=customer?.code||'';group.customerMethod=customer?'수동 선택':'';renderOutboundAll();}
function changeOutboundProduct(index,value){const group=outboundGroups[Number(index)],product=outboundProductFromLabel(value);if(!group)return;group.productId=product?.id||'';group.productMethod=product?'수동 선택':'';renderOutboundAll();}
function saveOutboundMappings(){
  const settings=outboundSettings();let saved=0;
  outboundGroups.forEach(group=>{if(group.externalCode&&group.productId)settings.outboundProductMappings[group.externalCode]=group.productId;if(group.deliveryName&&group.customerCode)settings.outboundCustomerMappings[outboundNormalize(group.deliveryName)]=group.customerCode;if(group.productId&&group.customerCode)saved++;});
  saveState('outbound-mapping');renderOutboundAll();alert(`출고 매칭 ${saved}건을 저장했습니다.`);
}
function renderOutboundPreview(){
  const body=byId('outboundPreviewTable');if(!body)return;const existing=existingOutboundKeys();
  body.innerHTML=outboundRows.slice(0,500).map(row=>{
    const group=outboundGroupForRow(row),product=state.products.find(item=>String(item.id)===String(group?.productId||'')),customer=state.hospitals.find(item=>String(item.code||'')===String(group?.customerCode||'')),status=outboundRowStatus(row,existing);
    return `<tr><td><span class="pill ${status.key==='ready'?'ok':status.key==='unsupported'||status.key==='invalid'||status.key==='unmatched'?'warn':''}">${status.label}</span></td><td>${outboundEscapeHtml(row.date)}</td><td>${outboundEscapeHtml(row.slip)}</td><td>${outboundEscapeHtml(row.documentType||'-')}</td><td>${outboundTransactionType(row.documentType)||'-'}</td><td>${outboundEscapeHtml(row.deliveryName)}</td><td>${outboundEscapeHtml(customer?.name||'')}</td><td>${outboundEscapeHtml(row.externalCode)}</td><td>${outboundEscapeHtml(product?outboundProductLabel(product):'')}</td><td>${qty(row.qty)}</td><td>${outboundEscapeHtml(row.lot)}</td></tr>`;
  }).join('')||'<tr><td colspan="11" class="empty">업로드한 자료가 없습니다.</td></tr>';
}
function renderOutboundAll(){renderOutboundSummary();renderOutboundMappings();renderOutboundPreview();}
function commitOutboundTransactions(){
  const existing=existingOutboundKeys(),now=new Date().toISOString();let added=0,duplicate=0,unmatched=0,unsupported=0,invalid=0,closed=0;const newRows=[];
  outboundRows.forEach(row=>{
    const status=outboundRowStatus(row,existing);
    if(status.key!=='ready'){if(status.key==='duplicate')duplicate++;else if(status.key==='unmatched')unmatched++;else if(status.key==='unsupported')unsupported++;else if(status.key==='closed')closed++;else invalid++;return;}
    const group=outboundGroupForRow(row),customer=state.hospitals.find(item=>String(item.code||'')===String(group.customerCode)),sourceKey=outboundSourceKey(row),legacyKey=outboundLegacySourceKey(row);
    newRows.push({id:outboundSourceId(row),date:row.date,location:customer.name,type:'선납',productId:group.productId,qty:Number(row.qty||0),memo:outboundMemo(row),source:'outbound-import',outboundSourceKey:sourceKey,outboundLegacySourceKey:legacyKey,externalProductCode:row.externalCode,sourceProductName:row.sourceName,slipNumber:row.slip,lotNo:row.lot,documentType:row.documentType,deliveryName:row.deliveryName,createdAt:now,updatedAt:now});
    existing.add(sourceKey);existing.add(legacyKey);added++;
  });
  if(!added){alert('등록 가능한 매입가납 출고자료가 없습니다. 문서구분과 거래처·품목 매칭 상태를 확인하세요.');return;}
  if(!confirm(`매입가납 ${added.toLocaleString('ko-KR')}건을 선납으로 등록할까요?\n비고에는 전표번호와 LOT만 저장됩니다.`))return;
  state.transactions.unshift(...newRows);saveOutboundMappingsSilently();addHistory('출고자료 선납 업로드',byId('outboundFileName')?.textContent||'출고자료',added);
  byId('outboundCommitResult').innerHTML=`<span class="pill ok">선납 ${added}건 등록 완료</span>${duplicate?` <span class="pill">중복 ${duplicate}건 제외</span>`:''}${unmatched?` <span class="pill warn">미매칭 ${unmatched}건 제외</span>`:''}${unsupported?` <span class="pill warn">문서구분 미지원 ${unsupported}건 제외</span>`:''}${closed?` <span class="pill warn">마감월 ${closed}건 제외</span>`:''}${invalid?` <span class="pill warn">자료 오류 ${invalid}건 제외</span>`:''}`;
  renderOutboundAll();
}
function saveOutboundMappingsSilently(){const settings=outboundSettings();outboundGroups.forEach(group=>{if(group.externalCode&&group.productId)settings.outboundProductMappings[group.externalCode]=group.productId;if(group.deliveryName&&group.customerCode)settings.outboundCustomerMappings[outboundNormalize(group.deliveryName)]=group.customerCode;});}
document.addEventListener('DOMContentLoaded',populateOutboundOptions);
window.addEventListener('dk-state-updated',()=>{if(outboundRows.length){buildOutboundGroups();populateOutboundOptions();renderOutboundAll();}});
