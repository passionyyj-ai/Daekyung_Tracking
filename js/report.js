function reportMonth(){return byId('reportMonth')?.value||today().slice(0,7);}
function reportSummary(){return monthlyPeriodSummary(reportMonth());}
function previousMonth(month){const [y,m]=month.split('-').map(Number),d=new Date(y,m-2,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function percent(n){return `${Number(n||0).toFixed(1)}%`;}
function deltaRate(current,previous){if(!previous)return current?100:0;return ((current-previous)/Math.abs(previous))*100;}
function deltaText(current,previous,unit=''){const d=current-previous,r=deltaRate(current,previous),arrow=d>0?'▲':d<0?'▼':'―';return `${arrow} ${money(Math.abs(d))}${unit} (${Math.abs(r).toFixed(1)}%)`;}
function deltaClass(current,previous,reverse=false){const better=reverse?current<previous:current>previous;return current===previous?'neutral':better?'up':'down';}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function closingQtyForProduct(product,end){return getLocations().reduce((sum,location)=>{const base=Number(stockCell(product,location).stock||0);const effect=(state.transactions||[]).filter(t=>t.productId===product.id&&String(t.date||'')<=end).reduce((a,t)=>a+transactionEffectForLocation(t,location),0);return sum+base+effect;},0);}
function reportPerformance(summary){
  const hospitals={},products={};
  summary.transactions.forEach(t=>{
    const q=Number(t.qty||0),p=productById(t.productId)||{},isUse=['사용','과사용'].includes(t.type),sale=isUse?q*Number(getHospitalPrice(t.productId,t.location)||0):0,cost=isUse?q*purchasePrice(p):0;
    const h=hospitals[t.location]||(hospitals[t.location]={name:t.location||'미지정',qty:0,sales:0,cost:0,margin:0,count:0});h.count++;if(isUse){h.qty+=q;h.sales+=sale;h.cost+=cost;h.margin+=sale-cost;}
    const x=products[t.productId]||(products[t.productId]={id:t.productId||'',name:p.name||'미등록 품목',qty:0,sales:0,cost:0,margin:0});if(isUse){x.qty+=q;x.sales+=sale;x.cost+=cost;x.margin+=sale-cost;}
  });
  const productRows=Object.values(products).filter(x=>x.qty||x.sales).map(x=>{const p=productById(x.id)||{};x.current=closingQtyForProduct(p,summary.end);x.inventoryValue=x.current*purchasePrice(p);return x;});
  return {hospitals:Object.values(hospitals).filter(x=>x.name!=='사무실').sort((a,b)=>b.sales-a.sales||b.qty-a.qty),products:productRows.sort((a,b)=>b.sales-a.sales||b.qty-a.qty)};
}
function renderComparison(current,previous){
  const rows=[['사용매출',current.salesAmount,previous.salesAmount,'원',false],['예상마진',current.margin,previous.margin,'원',false],['사용수량',current.totalUse,previous.totalUse,'개',false],['거래건수',current.transactionCount,previous.transactionCount,'건',false]];
  byId('monthlyComparison').innerHTML=rows.map(([label,value,prev,unit,reverse])=>`<article class="comparison-card"><span>${label}</span><strong>${money(value)}${unit}</strong><div class="comparison-delta ${deltaClass(value,prev,reverse)}">${deltaText(value,prev,unit)}</div><small>전월 ${money(prev)}${unit}</small></article>`).join('');
}
function renderExecutiveBrief(s,prev,perf,riskCount){
  const marginRate=s.salesAmount?s.margin/s.salesAmount*100:0,topHospital=perf.hospitals[0],topProduct=perf.products[0],salesDelta=deltaRate(s.salesAmount,prev.salesAmount);
  const lines=[
    `${s.month} 사용매출은 <b>${money(s.salesAmount)}원</b>으로 전월 대비 <b>${salesDelta>=0?'증가':'감소'} ${Math.abs(salesDelta).toFixed(1)}%</b>입니다. 예상마진은 ${money(s.margin)}원, 마진율은 ${marginRate.toFixed(1)}%입니다.`,
    topHospital?`최대 매출 거래처는 <b>${esc(topHospital.name)}</b>이며 월 사용매출 ${money(topHospital.sales)}원입니다.`:'해당 월에 사용매출이 등록된 거래처가 없습니다.',
    topProduct?`최대 매출 품목은 <b>${esc(topProduct.name)}</b>이며 사용수량 ${qty(topProduct.qty)}, 매출 ${money(topProduct.sales)}원입니다.`:'해당 월에 사용 처리된 품목이 없습니다.',
    riskCount?`매입단가 미등록·미정리 과사용 등 <b>${riskCount}건의 관리 필요 항목</b>이 있어 우선 확인이 필요합니다.`:'현재 확인된 주요 관리 필요 항목은 없습니다.'
  ];
  byId('executiveBrief').innerHTML=lines.map(x=>`<li>${x}</li>`).join('');
}
function renderRisks(s,perf){
  const unpriced=s.values.unpricedItems,over=s.totalOver,negative=perf.products.filter(x=>x.current<0).length,zeroSales=perf.products.filter(x=>x.qty>0&&x.sales<=0).length;
  const risks=[
    {level:unpriced?'danger':'ok',title:'매입단가 미등록 재고',value:`${qty(unpriced)}품목`,action:unpriced?'재고금액과 마진 정확도를 위해 단가를 등록하세요.':'미등록 항목이 없습니다.'},
    {level:over?'warn':'ok',title:'미정리 과사용',value:`${qty(over)}개`,action:over?'과사용 원인과 처리상태를 확인하세요.':'미정리 과사용이 없습니다.'},
    {level:negative?'danger':'ok',title:'음수 재고 품목',value:`${qty(negative)}품목`,action:negative?'입출고 누락 또는 거래 오류를 점검하세요.':'음수 재고가 없습니다.'},
    {level:zeroSales?'warn':'ok',title:'판매단가 0원 사용 품목',value:`${qty(zeroSales)}품목`,action:zeroSales?'거래처별 판매단가 등록 여부를 확인하세요.':'판매단가 누락 사용 건이 없습니다.'}
  ];
  byId('reportRiskCards').innerHTML=risks.map(r=>`<article class="risk-card ${r.level}"><div><span>${r.title}</span><strong>${r.value}</strong></div><p>${r.action}</p></article>`).join('');
  return unpriced+over+negative+zeroSales;
}
function renderReport(){
  ensureV6State();const s=reportSummary(),prev=monthlyPeriodSummary(previousMonth(s.month)),v=s.values,perf=reportPerformance(s),marginRate=s.salesAmount?s.margin/s.salesAmount*100:0,officeRate=v.total?v.office/v.total*100:0;
  byId('reportPeriodTitle').textContent=`${s.month.replace('-','년 ')}월 실적`;
  byId('reportGeneratedAt').textContent=`작성일시 ${new Date().toLocaleString('ko-KR')}`;
  byId('reportStatusText').textContent=s.closed?'월 마감 확정 기준':'실시간 집계 기준 (미마감)';
  byId('reportCloseBadge').className=`pill ${s.closed?'ok':'warn'}`;byId('reportCloseBadge').textContent=s.closed?'마감 완료':'마감 전';
  byId('reportFooterPeriod').textContent=`보고기간 ${s.start} ~ ${s.end}`;
  const riskCount=renderRisks(s,perf);
  const values={rKpiMonthlySales:`${money(s.salesAmount)}원`,rKpiMonthlyMargin:`${money(s.margin)}원`,rKpiUse:qty(s.totalUse),rKpiInventoryValue:`${money(v.total)}원`,rKpiCurrent:qty(s.totalCurrent),rKpiRiskCount:qty(riskCount)};
  Object.entries(values).forEach(([id,value])=>{if(byId(id))byId(id).textContent=value;});
  byId('rSalesDelta').textContent=`전월 대비 ${deltaText(s.salesAmount,prev.salesAmount,'원')}`;byId('rSalesDelta').className=deltaClass(s.salesAmount,prev.salesAmount);
  byId('rMarginRate').textContent=`마진율 ${percent(marginRate)} · 원가 ${money(s.cost)}원`;
  byId('rUseDelta').textContent=`전월 대비 ${deltaText(s.totalUse,prev.totalUse,'개')}`;byId('rUseDelta').className=deltaClass(s.totalUse,prev.totalUse);
  byId('rInventoryMix').textContent=`사무실 ${percent(officeRate)} · 거래처 ${percent(100-officeRate)}`;
  byId('rStockDelta').textContent=`월초 대비 ${deltaText(s.totalCurrent,s.totalStock,'개')}`;
  byId('rRiskDetail').textContent=riskCount?'우선 점검이 필요합니다.':'이상 항목 없음';
  renderComparison(s,prev);renderExecutiveBrief(s,prev,perf,riskCount);
  byId('reportHospitalPerformance').innerHTML=perf.hospitals.slice(0,10).map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.name)}</td><td class="num">${qty(x.qty)}</td><td class="num">${money(x.sales)}원</td><td class="num">${money(x.cost)}원</td><td class="num strong">${money(x.margin)}원</td><td class="num">${percent(x.sales?x.margin/x.sales*100:0)}</td><td class="num">${qty(x.count)}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">해당 월의 거래처 실적이 없습니다.</td></tr>';
  byId('reportProductPerformance').innerHTML=perf.products.slice(0,10).map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td class="num">${qty(x.qty)}</td><td class="num">${money(x.sales)}원</td><td class="num strong">${money(x.margin)}원</td><td class="num ${x.current<0?'danger-text':''}">${qty(x.current)}</td><td class="num">${money(x.inventoryValue)}원</td></tr>`).join('')||'<tr><td colspan="8" class="empty">해당 월의 품목 실적이 없습니다.</td></tr>';
  byId('reportLocationSummary').innerHTML=s.locations.map(l=>{const x=s.loc[l]||{};return `<tr><td>${esc(l)}</td><td class="num">${qty(x.stock)}</td><td class="num strong">${qty(x.current)}</td><td class="num">${money(v.byLocation[l]||0)}원</td><td class="num">${qty(x.in)}</td><td class="num">${qty(x.use)}</td><td class="num">${qty(x.prepaid)}</td><td class="num">${qty(x.recovery)}</td></tr>`;}).join('');
}
function exportReportCSV(){
  const s=reportSummary(),v=s.values,p=reportPerformance(s),rows=[['대경인터벤션 월간 경영 보고서'],['보고월',s.month],['보고기간',`${s.start} ~ ${s.end}`],['기준',s.closed?'월 마감 확정':'실시간 미마감'],[],['핵심지표','값'],['월 사용매출',s.salesAmount],['매출원가',s.cost],['예상마진',s.margin],['마진율',s.salesAmount?s.margin/s.salesAmount*100:0],['월 사용수량',s.totalUse],['월말 현재고',s.totalCurrent],['월말 재고금액',v.total],['매입단가 미등록 품목',v.unpricedItems],['미정리 과사용',s.totalOver],[],['거래처','사용수량','매출','원가','마진','거래건수']];
  p.hospitals.forEach(x=>rows.push([x.name,x.qty,x.sales,x.cost,x.margin,x.count]));rows.push([],['품목ID','품목명','사용수량','매출','마진','월말재고','재고금액']);p.products.forEach(x=>rows.push([x.id,x.name,x.qty,x.sales,x.margin,x.current,x.inventoryValue]));rows.push([],['위치','월초재고','월말재고','재고금액','입고','사용','선납','회수']);s.locations.forEach(l=>{const x=s.loc[l];rows.push([l,x.stock,x.current,v.byLocation[l]||0,x.in,x.use,x.prepaid,x.recovery]);});
  download(`대경_월간경영보고서_${s.month}.csv`,toCSV(rows),'text/csv;charset=utf-8');
}
document.addEventListener('DOMContentLoaded',()=>{if(byId('reportMonth'))byId('reportMonth').value=today().slice(0,7);renderReport();});
