function dashboardMonth(){return byId('dashboardMonth')?.value||today().slice(0,7);}
function renderDashboard(){
  const s=monthlyPeriodSummary(dashboardMonth()),v=s.values;
  const values={kpiStock:s.totalStock,kpiCurrent:s.totalCurrent,kpiUse:s.totalUse,kpiOveruse:s.totalOver,kpiOffice:s.loc['사무실']?.current||0,kpiHospital:s.locations.filter(l=>l!=='사무실').reduce((a,l)=>a+(s.loc[l]?.current||0),0),kpiPrepaid:Object.values(s.loc).reduce((a,l)=>a+l.prepaid,0),kpiRecovery:Object.values(s.loc).reduce((a,l)=>a+l.recovery,0),kpiInventoryValue:`${money(v.total)}원`,kpiOfficeValue:`${money(v.office)}원`,kpiHospitalValue:`${money(v.hospital)}원`,kpiUnpricedItems:v.unpricedItems,kpiMonthlySales:`${money(s.salesAmount)}원`,kpiMonthlyCost:`${money(s.cost)}원`,kpiMonthlyMargin:`${money(s.margin)}원`,kpiMonthlyTx:s.transactionCount};
  Object.entries(values).forEach(([id,value])=>{if(byId(id))byId(id).textContent=typeof value==='number'?qty(value):value;});
  if(byId('dashboardPeriodLabel'))byId('dashboardPeriodLabel').textContent=`${s.month} 월간 현황 · 재고는 ${s.end} 마감 기준`;
  byId('locationSummary').innerHTML=s.locations.map(l=>{const x=s.loc[l];return `<tr><td>${l}</td><td>${qty(x.stock)}</td><td>${qty(x.current)}</td><td>${money(v.byLocation[l]||0)}원</td><td>${qty(x.in)}</td><td>${qty(x.use)}</td><td>${qty(x.prepaid)}</td><td>${qty(x.recovery)}</td></tr>`;}).join('');
  byId('recentTx').innerHTML=s.transactions.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,15).map(t=>`<tr><td>${t.date||''}</td><td>${t.location||''}</td><td>${t.type||''}</td><td>${productById(t.productId)?.name||''}</td><td>${qty(t.qty)}</td><td>${t.memo||''}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">선택한 월의 거래 내역이 없습니다.</td></tr>';
}
document.addEventListener('DOMContentLoaded',()=>{if(byId('dashboardMonth'))byId('dashboardMonth').value=today().slice(0,7);renderDashboard();});
