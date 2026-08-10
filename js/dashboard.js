function dashboardMonth(){return byId('dashboardMonth')?.value||today().slice(0,7);}
function previousMonth(month){const [year,mon]=month.split('-').map(Number),date=new Date(year,mon-2,1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;}
function safeText(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function deltaText(current,previous,label='전월 대비'){
  const diff=Number(current||0)-Number(previous||0);
  if(!Number(previous||0))return `${label} ${diff===0?'변동 없음':`${diff>0?'+':''}${money(diff)}`}`;
  const rate=diff/Math.abs(Number(previous))*100;
  return `${label} ${diff>0?'▲':diff<0?'▼':'-'} ${Math.abs(rate).toFixed(1)}%`;
}
function weeklyFlow(transactions){
  const weeks=Array.from({length:5},(_,i)=>({label:`${i+1}주`,입고:0,사용:0,선납:0,회수:0}));
  transactions.forEach(t=>{const type=t.type==='과사용'?'사용':t.type;if(!['입고','사용','선납','회수'].includes(type))return;const day=Number(String(t.date||'').slice(8,10))||1;weeks[Math.min(4,Math.floor((day-1)/7))][type]+=Number(t.qty||0);});
  return weeks;
}
function renderWeeklyFlow(transactions){
  const target=byId('weeklyFlowChart'),weeks=weeklyFlow(transactions),types=[['입고','#2563eb'],['사용','#16a34a'],['선납','#f59e0b'],['회수','#0d9488']];
  const maximum=Math.max(1,...weeks.flatMap(w=>types.map(([type])=>w[type]))),height=190,base=156,groupWidth=132,barWidth=15;
  const bars=weeks.map((week,index)=>{const x=54+index*groupWidth;return types.map(([type,color],typeIndex)=>{const value=week[type],barHeight=Math.round(value/maximum*112),barX=x+typeIndex*20;return `<g><rect x="${barX}" y="${base-barHeight}" width="${barWidth}" height="${barHeight}" rx="5" fill="${color}"><title>${week.label} ${type} ${qty(value)}</title></rect></g>`;}).join('')+`<text x="${x+30}" y="180" text-anchor="middle">${week.label}</text>`;}).join('');
  target.innerHTML=`<svg viewBox="0 0 690 ${height}" role="img" aria-label="주간 거래 흐름 막대그래프"><line x1="38" y1="${base}" x2="674" y2="${base}" stroke="#dbe4f1"/>${bars}</svg>`;
}
function renderComposition(office,hospital){
  const total=office+hospital,officeRate=total?office/total*100:0;
  byId('inventoryDonut').style.setProperty('--office-share',`${officeRate*3.6}deg`);
  byId('donutTotal').textContent=qty(total);byId('officeShare').textContent=`${officeRate.toFixed(1)}%`;byId('hospitalShare').textContent=`${(total?100-officeRate:0).toFixed(1)}%`;
}
function renderTopFive(summary){
  const rows=summary.locations.filter(location=>location!=='사무실').map(location=>({location,value:Number(summary.values.byLocation[location]||0),qty:Number(summary.loc[location]?.current||0)})).sort((a,b)=>b.value-a.value).slice(0,5),max=Math.max(1,...rows.map(row=>row.value));
  byId('customerTopFive').innerHTML=rows.length?rows.map((row,index)=>`<div class="ranking-row"><span class="rank">${index+1}</span><div class="ranking-main"><div><strong>${safeText(row.location)}</strong><span>${money(row.value)}원 · ${qty(row.qty)}개</span></div><div class="ranking-track"><i style="width:${row.value/max*100}%"></i></div></div></div>`).join(''):'<div class="empty-state">거래처 재고가 없습니다.</div>';
}
function renderAlerts(summary){
  const alerts=[],unpriced=Number(summary.values.unpricedItems||0);
  if(unpriced)alerts.push({tone:'warning',icon:'₩',title:'매입단가 미등록 재고',detail:`${qty(unpriced)}개 품목의 재고금액이 0원으로 계산됩니다.`,href:'price.html'});
  if(summary.totalOver)alerts.push({tone:'danger',icon:'!',title:'미정리 과사용',detail:`${qty(summary.totalOver)}개를 거래관리에서 확인하세요.`,href:'transaction.html'});
  if(!summary.transactionCount)alerts.push({tone:'neutral',icon:'–',title:'당월 거래 없음',detail:'선택한 월에 등록된 거래가 없습니다.',href:'transaction.html'});
  alerts.push(summary.closed?{tone:'success',icon:'✓',title:'월 마감 완료',detail:`${summary.month} 자료가 마감되었습니다.`,href:'monthly_close.html'}:{tone:'info',icon:'○',title:'월 마감 전',detail:`${summary.month} 자료는 아직 마감되지 않았습니다.`,href:'monthly_close.html'});
  byId('alertCount').textContent=qty(alerts.filter(a=>['warning','danger'].includes(a.tone)).length);
  byId('dashboardAlerts').innerHTML=alerts.map(a=>`<a class="dashboard-alert ${a.tone}" href="${a.href}"><span class="alert-icon">${a.icon}</span><span><strong>${a.title}</strong><small>${a.detail}</small></span><b>›</b></a>`).join('');
}
function renderDashboard(){
  const month=dashboardMonth(),s=monthlyPeriodSummary(month),previous=monthlyPeriodSummary(previousMonth(month)),v=s.values;
  const office=s.loc['사무실']?.current||0,hospital=s.locations.filter(l=>l!=='사무실').reduce((a,l)=>a+(s.loc[l]?.current||0),0);
  const values={kpiStock:s.totalStock,kpiCurrent:s.totalCurrent,kpiUse:s.totalUse,kpiOveruse:s.totalOver,kpiOffice:office,kpiHospital:hospital,kpiPrepaid:Object.values(s.loc).reduce((a,l)=>a+l.prepaid,0),kpiRecovery:Object.values(s.loc).reduce((a,l)=>a+l.recovery,0),kpiInventoryValue:`${money(v.total)}원`,kpiOfficeValue:`${money(v.office)}원`,kpiHospitalValue:`${money(v.hospital)}원`,kpiUnpricedItems:v.unpricedItems,kpiMonthlySales:`${money(s.salesAmount)}원`,kpiMonthlyCost:`${money(s.cost)}원`,kpiMonthlyMargin:`${money(s.margin)}원`,kpiMonthlyTx:s.transactionCount};
  Object.entries(values).forEach(([id,value])=>{if(byId(id))byId(id).textContent=typeof value==='number'?qty(value):value;});
  byId('dashboardPeriodLabel').textContent=`${s.month} 월간 현황 · 재고는 ${s.end} 기준`;
  byId('dashboardCloseStatus').textContent=s.closed?'마감 완료':'마감 전';byId('dashboardCloseStatus').className=`dashboard-status-chip ${s.closed?'closed':'open'}`;
  byId('inventoryValueDelta').textContent=deltaText(v.total,previous.values.total);byId('salesDelta').textContent=deltaText(s.salesAmount,previous.salesAmount);byId('marginRate').textContent=`마진율 ${s.salesAmount?(s.margin/s.salesAmount*100).toFixed(1):'0.0'}%`;byId('stockDelta').textContent=deltaText(s.totalCurrent,s.totalStock,'월초 대비');
  byId('locationSummary').innerHTML=s.locations.map(l=>{const x=s.loc[l];return `<tr><td>${safeText(l)}</td><td>${qty(x.stock)}</td><td>${qty(x.current)}</td><td>${money(v.byLocation[l]||0)}원</td><td>${qty(x.in)}</td><td>${qty(x.use)}</td><td>${qty(x.prepaid)}</td><td>${qty(x.recovery)}</td></tr>`;}).join('');
  byId('recentTx').innerHTML=s.transactions.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,10).map(t=>`<tr><td>${safeText(t.date)}</td><td>${safeText(t.location)}</td><td><span class="tx-type type-${safeText(t.type)}">${safeText(t.type)}</span></td><td>${safeText(productById(t.productId)?.name||'미등록 품목')}</td><td>${qty(t.qty)}</td><td>${safeText(t.memo)}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">선택한 월의 거래 내역이 없습니다.</td></tr>';
  renderWeeklyFlow(s.transactions);renderComposition(office,hospital);renderTopFive(s);renderAlerts(s);
}
document.addEventListener('DOMContentLoaded',()=>{if(byId('dashboardMonth'))byId('dashboardMonth').value=today().slice(0,7);renderDashboard();});
