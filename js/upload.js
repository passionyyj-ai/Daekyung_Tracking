function txSalePrice(t){ return getHospitalPrice(t.productId, t.location); }
function txAmount(t){ return Number(t.qty||0) * txSalePrice(t); }
function txImpactText(t){const q=qty(t.qty);if(t.type==='선납')return `사무실 -${q} / ${t.location} +${q}`;if(t.type==='회수')return `사무실 +${q} / ${t.location} -${q}`;if(t.type==='사용')return `${t.location} -${q}`;if(t.type==='입고')return `${t.location} +${q}`;if(t.type==='조정(+)')return `${t.location} +${q}`;if(t.type==='조정(-)'||t.type==='과사용')return `${t.location} -${q}`;return '';}

let editingTransactionId='';

function resetManualTxForm(){
  editingTransactionId='';
  byId('mDate').value=today();
  byId('mLoc').selectedIndex=0;
  byId('mType').value='입고';
  byId('mProd').value='';
  byId('mQty').value=1;
  byId('mMemo').value='';
  const saveButton=byId('manualTxSaveBtn');
  if(saveButton)saveButton.textContent='등록';
  byId('manualTxCancelBtn')?.classList.add('hidden');
  saveCurrentPageDraft();
}

function addManualTx(){
  const now=new Date().toISOString();
  const tx = {
    date: byId('mDate').value || today(),
    location: byId('mLoc').value,
    type: byId('mType').value,
    productId: byId('mProd').value,
    qty: parseNumber(byId('mQty').value),
    memo: byId('mMemo').value.trim(),
    updatedAt:now
  };
  if(!tx.productId || !tx.qty) return alert('품목과 수량을 확인하세요.');
  if(!ensureMonthOpen(tx.date,editingTransactionId?'거래를 수정':'거래를 등록'))return;
  if(tx.type === '선납' && tx.location === '사무실') return alert('선납은 병원에 재고가 입고되는 거래입니다. 위치를 병원으로 선택하세요.');
  if(tx.type === '회수' && tx.location === '사무실') return alert('회수는 병원 재고를 사무실로 회수하는 거래입니다. 위치를 병원으로 선택하세요.');
  if(editingTransactionId){
    const index=state.transactions.findIndex(row=>String(row.id)===String(editingTransactionId));
    if(index<0)return alert('수정할 거래를 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도하세요.');
    if(!ensureMonthOpen(state.transactions[index].date,'기존 거래를 수정'))return;
    tx.id=state.transactions[index].id;
    tx.createdAt=state.transactions[index].createdAt||now;
    state.transactions[index]=Object.assign({},state.transactions[index],tx);
    addHistory('거래수정', `${tx.location} ${tx.type}`, 1);
  }else{
    tx.id=createEventId('tx');
    tx.createdAt=now;
    state.transactions.unshift(tx);
    addHistory('거래등록', `${tx.location} ${tx.type}`, 1);
  }
  resetManualTxForm();
  renderTx();
}
function editTransaction(id){
  const tx=state.transactions.find(row=>String(row.id)===String(id));
  if(!tx)return alert('수정할 거래를 찾을 수 없습니다.');
  if(!ensureMonthOpen(tx.date,'거래를 수정'))return;
  if(tx.type==='과사용')return alert('과사용 거래는 아래 과사용 관리에서 처리하세요.');
  editingTransactionId=String(tx.id);
  byId('mDate').value=tx.date||today();
  byId('mLoc').value=tx.location||'';
  byId('mType').value=tx.type||'입고';
  byId('mProd').value=tx.productId||'';
  byId('mQty').value=Number(tx.qty||1);
  byId('mMemo').value=tx.memo||'';
  byId('manualTxSaveBtn').textContent='수정 저장';
  byId('manualTxCancelBtn')?.classList.remove('hidden');
  saveCurrentPageDraft();
  document.querySelector('.main')?.scrollTo?.({top:0,behavior:'smooth'});
  window.scrollTo({top:0,behavior:'smooth'});
}
function cancelTransactionEdit(){resetManualTxForm();}
function deleteTransaction(id){
  const index=state.transactions.findIndex(row=>String(row.id)===String(id));
  if(index<0)return alert('삭제할 거래를 찾을 수 없습니다.');
  const tx=state.transactions[index];
  if(!ensureMonthOpen(tx.date,'거래를 삭제'))return;
  if(tx.type==='과사용')return alert('과사용 거래는 아래 과사용 관리에서 처리하세요.');
  const product=productById(tx.productId);
  if(!confirm(`${tx.date||''} / ${tx.location||''} / ${product?.name||tx.productId||''} 거래를 삭제할까요?\n삭제하면 재고에도 즉시 반영됩니다.`))return;
  state.transactions.splice(index,1);
  if(!Array.isArray(state.deletedTransactionIds))state.deletedTransactionIds=[];
  if(tx.id&&!state.deletedTransactionIds.includes(String(tx.id)))state.deletedTransactionIds.push(String(tx.id));
  addHistory('거래삭제',`${tx.location||''} ${tx.type||''}`,1);
  if(String(editingTransactionId)===String(id))resetManualTxForm();
  renderTx();
}
function transactionDuplicateSignature(tx){
  return [tx.date||'',tx.location||'',tx.type||'',tx.productId||'',Number(tx.qty||0),tx.memo||''].join('\u001f');
}
function removeDuplicateTransactions(){
  const seen=new Set(),duplicates=[];
  state.transactions.forEach(tx=>{
    if(tx.type==='과사용')return;
    const signature=transactionDuplicateSignature(tx);
    if(seen.has(signature))duplicates.push(tx);else seen.add(signature);
  });
  if(!duplicates.length)return alert('동일하게 반복 등록된 거래가 없습니다.');
  if(!confirm(`내용이 완전히 같은 중복 거래 ${duplicates.length}건을 정리할까요?\n각 조합에서 가장 최근에 표시된 1건은 유지합니다.`))return;
  const duplicateIds=new Set(duplicates.map(tx=>String(tx.id)));
  state.transactions=state.transactions.filter(tx=>!duplicateIds.has(String(tx.id)));
  if(!Array.isArray(state.deletedTransactionIds))state.deletedTransactionIds=[];
  duplicateIds.forEach(id=>{if(id&&!state.deletedTransactionIds.includes(id))state.deletedTransactionIds.push(id);});
  addHistory('중복거래정리','동일 거래 중복 제거',duplicates.length);
  renderTx();
}
function addOveruse(){ const now=new Date().toISOString(),o={id:createEventId('overuse'),status:'미정리',date:byId('oDate').value||today(),location:byId('oLoc').value,productId:byId('oProd').value,qty:parseNumber(byId('oQty').value),memo:byId('oMemo').value,createdAt:now,updatedAt:now}; if(!ensureMonthOpen(o.date,'과사용을 등록'))return; state.overuses.unshift(o); state.transactions.unshift({...o,id:createEventId('tx'),overuseId:o.id,source:'overuse',type:'과사용'}); addHistory('과사용',o.memo||'과사용 임시 반영',1); renderTx(); }
function closeOveruse(i){ if(!ensureMonthOpen(state.overuses[i]?.date,'과사용을 정리'))return; state.overuses[i].status='정리완료'; addHistory('과사용정리',state.overuses[i].memo||'',1); renderTx(); }
function renderTx(){
  byId('txTable').innerHTML=state.transactions.slice(0,300).map(t=>{
    const p=productById(t.productId);
    const sale=txSalePrice(t);
    const amount=txAmount(t);
    const actions=t.type==='과사용'?'<span class="hint">과사용 관리</span>':`<div class="tx-row-actions"><button class="btn small-btn" onclick="editTransaction('${t.id}')">수정</button><button class="btn small-btn danger" onclick="deleteTransaction('${t.id}')">삭제</button></div>`;
    return `<tr><td>${t.date}</td><td>${t.location}</td><td>${t.type}</td><td>${p?.id||t.productId||''}</td><td>${p?.name||''}</td><td>${qty(t.qty)}</td><td>${money(sale)}</td><td>${money(amount)}</td><td>${txImpactText(t)}</td><td>${t.memo||''}</td><td>${actions}</td></tr>`;
  }).join('')||'<tr><td colspan="11" class="empty">거래 내역이 없습니다.</td></tr>';
  byId('overuseTable').innerHTML=state.overuses.map((o,i)=>{ const p=productById(o.productId); return `<tr><td>${o.status}</td><td>${o.date}</td><td>${o.location}</td><td>${p?.id||o.productId||''}</td><td>${p?.name||''}</td><td>${qty(o.qty)}</td><td>${o.memo||''}</td><td>${o.status==='정리완료'?'':`<button class="btn small-btn" onclick="closeOveruse(${i})">정리완료</button>`}</td></tr>`; }).join('')||'<tr><td colspan="8" class="empty">과사용 내역이 없습니다.</td></tr>';
}
function handleTxUpload(e){
  const file = e.target.files[0];
  if(!file) return;
  readWorkbook(file, rows => {
    let ok = 0, skip = 0, closedSkip = 0;
    rows.forEach(r => {
      const productId = String(r['ID'] || r['품목ID'] || '').trim();
      const name = r['품목명'];
      const p = productId ? state.products.find(x => String(x.id) === productId) : state.products.find(x => x.name === name);
      const type = r['구분'] || '사용';
      const location = r['병원'] || r['위치'] || '사무실';
      const qtyValue = parseNumber(r['수량']);
      const txDate=normalizeDate(r['날짜']);
      if(isMonthClosed(txDate)){closedSkip++;return;}
      if(!p || !qtyValue) { skip++; return; }
      if(['선납','회수'].includes(type) && location === '사무실') { skip++; return; }

      const now=new Date().toISOString();
      state.transactions.unshift({
        id:createEventId('tx'),
        date: txDate,
        location,
        type,
        productId: p.id,
        qty: qtyValue,
        memo: r['비고'] || '',
        createdAt:now,
        updatedAt:now
      });
      ok++;
    });
    addHistory('거래업로드', file.name, ok);
    byId('txUploadResult').innerHTML = `<span class="pill ok">${ok}건 반영</span>` + (skip ? ` <span class="pill warn">${skip}건 제외</span>` : '') + (closedSkip ? ` <span class="pill warn">마감월 ${closedSkip}건 제외</span>` : '');
    renderTx();
  });
}
document.addEventListener('DOMContentLoaded',()=>{ byId('mDate').value=today(); byId('oDate').value=today(); locationOptions(byId('mLoc')); locationOptions(byId('oLoc')); productOptions(byId('mProd')); productOptions(byId('oProd')); if(!editingTransactionId)byId('mProd').value=''; renderTx(); });


// 품목명 검색 팝업: 카테고리 필터 + 품목명 LIKE(부분 일치) 검색
let activeProductSelectId = 'mProd';

function openProductSearchPopup(targetSelectId='mProd'){
  activeProductSelectId = targetSelectId;
  const modal = byId('productSearchModal');
  if(!modal) return;
  categoryOptions(byId('psCat'), true);
  const selectedId = byId(targetSelectId)?.value;
  const selectedProduct = productById(selectedId);
  if(selectedProduct && byId('psCat')) byId('psCat').value = selectedProduct.category || '';
  if(byId('psKeyword')) byId('psKeyword').value = '';
  modal.classList.remove('hidden');
  renderProductSearchResults();
  setTimeout(()=>byId('psKeyword')?.focus(), 0);
}

function closeProductSearchPopup(){
  byId('productSearchModal')?.classList.add('hidden');
}

function normalizeSearchText(value){
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function renderProductSearchResults(){
  const tbody = byId('psResults');
  if(!tbody) return;
  const category = byId('psCat')?.value || '';
  const keyword = normalizeSearchText(byId('psKeyword')?.value || '');
  const rows = state.products
    .filter(p => !category || (p.category || '미분류') === category)
    .filter(p => !keyword || normalizeSearchText(p.name).includes(keyword) || normalizeSearchText(p.category).includes(keyword))
    .sort((a,b) => String(a.category||'').localeCompare(String(b.category||''), 'ko') || String(a.name||'').localeCompare(String(b.name||''), 'ko'))
    .slice(0, 300);

  tbody.innerHTML = rows.map(p => `
    <tr class="click-row" ondblclick="selectProductFromPopup('${p.id}')">
      <td><button type="button" class="btn small-btn primary" onclick="selectProductFromPopup('${p.id}')">선택</button></td>
      <td>${p.id}</td>
      <td>${p.category || '미분류'}</td>
      <td>${p.name}</td>
      <td>${qty(currentQty(p))}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="empty">검색 결과가 없습니다.</td></tr>';
}

function selectProductFromPopup(productId){
  const select = byId(activeProductSelectId);
  if(select) select.value = productId;
  closeProductSearchPopup();
}

document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && !byId('productSearchModal')?.classList.contains('hidden')) closeProductSearchPopup();
});

function downloadTxSample(){
  const p=state.products[0]||{};
  const rows=[['날짜','병원','구분','ID','품목명','수량','비고'],[today(),'경북대','선납',p.id||'',p.name||'',1,'사무실 → 병원'],[today(),'경북대','사용',p.id||'',p.name||'',1,'병원 사용'],[today(),'경북대','회수',p.id||'',p.name||'',1,'병원 → 사무실']];
  if(window.XLSX){
    const ws=XLSX.utils.aoa_to_sheet(rows);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '거래업로드');
    XLSX.writeFile(wb, 'Transaction_upload.xlsx');
  } else {
    download('Transaction_upload.csv',toCSV(rows),'text/csv;charset=utf-8');
  }
}
