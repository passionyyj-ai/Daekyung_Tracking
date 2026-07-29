let monthlyCloseView=null;

function selectedCloseMonth(){return byId('closeMonth')?.value||today().slice(0,7);}
function closeMonthRange(month){
  const [year,mon]=month.split('-').map(Number);
  const start=`${month}-01`;
  const end=`${month}-${String(new Date(year,mon,0).getDate()).padStart(2,'0')}`;
  return {start,end};
}
function closeUser(){return window.DKCloud?.status?.profile?.username||window.DKCloud?.status?.profile?.display_name||'관리자';}
function closeUserRole(){return window.DKCloud?.status?.profile?.role||'admin';}
function priceForClosing(product,location){return location==='사무실'?0:Number(getHospitalPrice(product.id,location)||0);}
function buildMonthlyClosing(month,locationFilter=byId('closeLocation')?.value||''){
  const {start,end}=closeMonthRange(month),locations=getLocations(),lines=[],issues=[];
  const monthTx=(state.transactions||[]).filter(t=>t.date>=start&&t.date<=end);
  const targetLocations=locationFilter?[locationFilter]:locations;
  targetLocations.forEach(location=>(state.products||[]).forEach(product=>{
    const productTx=(state.transactions||[]).filter(t=>t.productId===product.id);
    const openingQty=Number(stockCell(product,location).stock||0)+productTx.filter(t=>t.date<start).reduce((sum,t)=>sum+transactionEffectForLocation(t,location),0);
    const txs=monthTx.filter(t=>t.productId===product.id);
    let incomingQty=0,useQty=0,prepaidQty=0,recoveryQty=0,adjustQty=0;
    txs.forEach(t=>{
      const q=Number(t.qty||0);
      if(t.type==='입고'&&t.location===location)incomingQty+=q;
      if(['사용','과사용'].includes(t.type)&&t.location===location)useQty+=q;
      if(t.type==='선납'&&(location==='사무실'||t.location===location))prepaidQty+=q;
      if(t.type==='회수'&&(location==='사무실'||t.location===location))recoveryQty+=q;
      if(t.location===location&&t.type==='조정(+)')adjustQty+=q;
      if(t.location===location&&t.type==='조정(-)')adjustQty-=q;
    });
    const movement=txs.reduce((sum,t)=>sum+transactionEffectForLocation(t,location),0);
    const closingQty=openingQty+movement;
    if(!openingQty&&!closingQty&&!incomingQty&&!useQty&&!prepaidQty&&!recoveryQty&&!adjustQty)return;
    const purchase=Number(product.purchasePrice||0),sale=priceForClosing(product,location);
    const salesAmount=useQty*sale,cost=useQty*purchase,inventoryValue=closingQty*purchase;
    const line={location,productId:product.id,productName:product.name,openingQty,incomingQty,prepaidQty,useQty,recoveryQty,adjustQty,closingQty,salePrice:sale,salesAmount,purchasePrice:purchase,inventoryValue,cost,margin:salesAmount-cost};
    lines.push(line);
    if(closingQty<0)issues.push({level:'danger',message:`${location} / ${product.name}: 마감재고가 ${qty(closingQty)}개로 음수입니다.`});
    if((closingQty!==0||useQty!==0)&&purchase<=0)issues.push({level:'warn',message:`${location} / ${product.name}: 매입단가가 등록되지 않았습니다.`});
    if(location!=='사무실'&&useQty>0&&sale<=0)issues.push({level:'warn',message:`${location} / ${product.name}: 판매단가가 등록되지 않았습니다.`});
  }));
  (state.overuses||[]).filter(o=>o.date>=start&&o.date<=end&&o.status!=='정리완료').forEach(o=>issues.push({level:'danger',message:`${o.location} / ${productById(o.productId)?.name||o.productId}: 미정리 과사용이 남아 있습니다.`}));
  const sum=key=>lines.reduce((total,row)=>total+Number(row[key]||0),0);
  return {id:`monthly-close-${month}`,month,status:'preview',createdAt:new Date().toISOString(),transactionCount:monthTx.length,lines,issues,summary:{closingQty:sum('closingQty'),inventoryValue:sum('inventoryValue'),salesAmount:sum('salesAmount'),cost:sum('cost'),margin:sum('margin')}};
}
function currentClosingView(){
  const month=selectedCloseMonth(),saved=monthlyClosingFor(month),filter=byId('closeLocation')?.value||'';
  if(saved){const view=clone(saved);if(filter)view.lines=(view.lines||[]).filter(row=>row.location===filter);return view;}
  return buildMonthlyClosing(month);
}
function closeStatusText(view){return view.status==='closed'?`마감 완료 · ${view.closedBy||''} · ${String(view.closedAt||'').replace('T',' ').slice(0,16)}`:'마감 전 미리보기';}
function renderMonthlyClose(){
  if(!byId('closeTable'))return;
  monthlyCloseView=currentClosingView();const v=monthlyCloseView,s=v.summary||{};
  byId('closeStatus').textContent=closeStatusText(v);byId('closeStatus').className=`pill ${v.status==='closed'?'ok':'warn'}`;
  const cards={closeTxCount:v.transactionCount||0,closeQty:qty(s.closingQty),closeInventoryValue:`${money(s.inventoryValue)}원`,closeSales:`${money(s.salesAmount)}원`,closeMargin:`${money(s.margin)}원`,closeIssueCount:(v.issues||[]).length};
  Object.entries(cards).forEach(([id,value])=>{if(byId(id))byId(id).textContent=value;});
  byId('closeTable').innerHTML=(v.lines||[]).map(row=>`<tr><td>${row.location}</td><td>${row.productId}</td><td>${row.productName}</td><td class="num">${qty(row.openingQty)}</td><td class="num">${qty(row.incomingQty)}</td><td class="num">${qty(row.prepaidQty)}</td><td class="num">${qty(row.useQty)}</td><td class="num">${qty(row.recoveryQty)}</td><td class="num">${qty(row.adjustQty)}</td><td class="num strong">${qty(row.closingQty)}</td><td class="num">${money(row.salePrice)}</td><td class="num">${money(row.salesAmount)}</td><td class="num">${money(row.purchasePrice)}</td><td class="num">${money(row.inventoryValue)}</td><td class="num">${money(row.margin)}</td></tr>`).join('')||'<tr><td colspan="15" class="empty">해당 월의 재고 또는 거래 자료가 없습니다.</td></tr>';
  byId('closeIssues').innerHTML=(v.issues||[]).map(row=>`<li class="${row.level}">${row.message}</li>`).join('')||'<li class="ok">확인할 오류가 없습니다.</li>';
  byId('closeHistory').innerHTML=(state.monthlyClosings||[]).slice().sort((a,b)=>b.month.localeCompare(a.month)).map(row=>`<tr><td>${row.month}</td><td>${row.status==='closed'?'마감 완료':'재오픈'}</td><td>${row.closedBy||''}</td><td>${String(row.closedAt||row.reopenedAt||'').replace('T',' ').slice(0,16)}</td><td>${row.reopenReason||''}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">마감 이력이 없습니다.</td></tr>';
  byId('closeCommitBtn').disabled=v.status==='closed';byId('closeReopenBtn').disabled=v.status!=='closed';
}
function previewMonthlyClose(){renderMonthlyClose();}
function commitMonthlyClose(){
  const month=selectedCloseMonth();if(monthlyClosingFor(month))return alert('이미 마감된 월입니다.');
  const previous=(state.monthlyClosings||[]).find(row=>row.month===month);
  const preview=buildMonthlyClosing(month,'');
  if(preview.issues.some(x=>x.level==='danger')&&!confirm(`중요 확인사항이 ${preview.issues.filter(x=>x.level==='danger').length}건 있습니다. 그래도 마감할까요?`))return;
  if(!confirm(`${month} 월 마감을 확정할까요?\n확정 후 해당 월 거래는 등록·수정·삭제할 수 없습니다.`))return;
  preview.status='closed';preview.closedAt=new Date().toISOString();preview.closedBy=closeUser();preview.history=[...(previous?.history||[]),{action:'closed',at:preview.closedAt,by:preview.closedBy}];
  state.monthlyClosings=(state.monthlyClosings||[]).filter(row=>row.month!==month);state.monthlyClosings.unshift(preview);addHistory('월마감',`${month} 월 마감`,preview.transactionCount);renderMonthlyClose();
}
function reopenMonthlyClose(){
  if(closeUserRole()!=='admin')return alert('월 마감 재오픈은 관리자만 할 수 있습니다.');
  const month=selectedCloseMonth(),row=monthlyClosingFor(month);if(!row)return alert('마감된 월이 아닙니다.');
  const reason=prompt(`${month} 마감을 재오픈하는 사유를 입력하세요.`,'');if(!reason?.trim())return alert('재오픈 사유가 필요합니다.');
  row.status='reopened';row.reopenedAt=new Date().toISOString();row.reopenedBy=closeUser();row.reopenReason=reason.trim();row.history=[...(row.history||[]),{action:'reopened',at:row.reopenedAt,by:row.reopenedBy,reason:row.reopenReason}];
  addHistory('월마감재오픈',`${month}: ${row.reopenReason}`,1);renderMonthlyClose();
}
function monthlyCloseRows(){return [['월','위치','ID','품목명','전월재고','입고','선납','사용','회수','조정','마감재고','판매단가','사용매출','매입단가','재고금액','마진'],...(monthlyCloseView?.lines||[]).map(r=>[monthlyCloseView.month,r.location,r.productId,r.productName,r.openingQty,r.incomingQty,r.prepaidQty,r.useQty,r.recoveryQty,r.adjustQty,r.closingQty,r.salePrice,r.salesAmount,r.purchasePrice,r.inventoryValue,r.margin])];}
function exportMonthlyClose(){
  const rows=monthlyCloseRows();if(window.XLSX){const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'월별마감');XLSX.writeFile(wb,`대경_월별마감_${selectedCloseMonth()}.xlsx`);}else download(`대경_월별마감_${selectedCloseMonth()}.csv`,toCSV(rows),'text/csv;charset=utf-8');
}
function printMonthlyClose(){window.print();}
document.addEventListener('DOMContentLoaded',()=>{byId('closeMonth').value=today().slice(0,7);locationOptions(byId('closeLocation'),true);renderMonthlyClose();});
