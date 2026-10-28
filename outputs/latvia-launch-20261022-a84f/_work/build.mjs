import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Workbook, SpreadsheetFile, FileBlob } from '@oai/artifact-tool';

const out = path.resolve(import.meta.dirname, '..');
const wb = Workbook.create();
const model = wb.worksheets.add('Launch model');
const api = wb.worksheets.add('Google APIs');
const navy = '#24364B', pale = '#E8EEF5', blue = '#164CB5', green = '#177245';
const eur = '"€"#,##0.00;("€"#,##0.00);"–"';
const usd = '"$"#,##0.00;("$"#,##0.00);"–"';
const num = '#,##0.00;(#,##0.00);"–"';
const integer = '#,##0;(#,##0);"–"';
const pct = '0.0%;(0.0%);"–"';
const sources = {
  google: 'https://developers.google.com/maps/billing-and-pricing/pricing',
  supabase: 'https://supabase.com/pricing',
  aws: 'https://aws.amazon.com/lightsail/pricing/',
  gcp: 'https://cloud.google.com/run/pricing',
  stripe: 'https://stripe.com/en-lv/pricing',
  billing: 'https://stripe.com/en-lv/billing/pricing',
  vat: 'https://www.vid.gov.lv/en/value-added-tax',
  accounts: 'https://contus.lv/en/accounting-services-in-latvia/accounting-service-fees-latvia/',
};
function value(sh, address, val) { sh.getRange(address).values = [[val]]; }
function formula(sh, address, val, cross=false) {
  sh.getRange(address).formulas = [[val]];
  sh.getRange(address).format.font.color = cross ? green : '#202020';
}
function editable(sh, address, format) {
  sh.getRange(address).format.fill = '#FFF2CB';
  sh.getRange(address).format.font.color = blue;
  if (format) sh.getRange(address).setNumberFormat(format);
}
function band(sh, row, title, last='G') {
  const r=sh.getRange(`B${row}:${last}${row}`);
  r.format.fill = pale; r.format.font.bold = true;
  r.format.borders = { bottom: {style:'thin',color:'#BCC9D8'} };
  value(sh,`B${row}`,title);
}
function heading(sh, range) {
  sh.getRange(range).format.fill=navy;
  sh.getRange(range).format.font.color='#FFFFFF';
  sh.getRange(range).format.font.bold=true;
  sh.getRange(range).format.horizontalAlignment='center';
  sh.getRange(range).format.rowHeight=30;
}
function countValidation(sh, range, max=1000000000) {
  sh.dataValidations.add({range,rule:{type:'whole',operator:'between',formula1:0,formula2:max}});
}
function decimalValidation(sh, range, max=1000000000) {
  sh.dataValidations.add({range,rule:{type:'decimal',operator:'between',formula1:0,formula2:max}});
}

for (const sh of [model,api]) {
  sh.showGridLines=false;
  sh.getRange(sh===model?'B2:I103':'B2:I41').format.font={name:'Arial',size:11,color:'#202020'};
  sh.getRange(sh===model?'B2:I103':'B2:I41').format.rowHeight=24;
  sh.getRange(sh===model?'B2:I103':'B2:I41').format.verticalAlignment='center';
  sh.getRange('A:A').format.columnWidth=3;
  sh.getRange('B2').format.font={name:'Arial',size:16,bold:true,color:navy};
  sh.freezePanes.freezeRows(4);
}
model.tabColor=navy; api.tabColor='#7091B5';
for (const [col,width] of Object.entries({B:43,C:16,D:16,E:12,F:14,G:19,H:3,I:110})) model.getRange(`${col}:${col}`).format.columnWidth=width;
value(model,'B2','FitsMyTime launch estimate');
value(model,'B3','Latvia. Monthly EUR budget. Blue text on yellow cells = editable inputs.');
model.getRange('B3').format.font={italic:true,color:'#536174'};
band(model,5,'Monthly results');
const outputs = [
  [6,'Paying provider workspaces','=C22'],
  [7,'Revenue excluding VAT','=IF(ISNUMBER(C22),C39*C22,"n.a.")'],
  [8,'Subscription fees and loss reserve','=IF(ISNUMBER(C22),C42*C22,"n.a.")'],
  [9,'Operating budget incl. contingency','=G73'],
  [10,'Per-subscriber operating allowance','=IF(ISNUMBER(C22),C30*C22,"n.a.")'],
  [11,'Monthly surplus / (shortfall)','=IF(ISNUMBER(C22),C7-SUM(C8:C10),"n.a.")'],
  [12,'Break-even paying subscribers','=IF(C43>0,ROUNDUP(G73/C43,0),"n.a.")'],
  [13,'Additional subscribers to break even','=IF(ISNUMBER(C22),IF(ISNUMBER(C12),MAX(0,C12-C22),"n.a."),"n.a.")'],
  [14,'Annualised surplus / (shortfall)','=IF(ISNUMBER(C22),C11*12,"n.a.")'],
  [15,'One-time launch budget','=G88'],
  [16,'Launch funding gap','=IF(ISNUMBER(C22),MAX(0,C15-C11),"n.a.")'],
  [17,'Subscribers for target surplus','=IF(C43>0,ROUNDUP((G73+C34)/C43,0),"n.a.")'],
];
for (const [r,label,f] of outputs) { value(model,`B${r}`,label); formula(model,`C${r}`,f); model.getRange(`C${r}`).setNumberFormat([6,12,13,17].includes(r)?integer:eur); }
for (const r of [11,12,16,17]) { model.getRange(`B${r}:C${r}`).format.fill=pale; model.getRange(`B${r}:C${r}`).format.font.bold=true; }
value(model,'E6','Subscribers and price: C22:C25');
value(model,'E7','Monthly cost positions: rows 47–68');
value(model,'E8','Request volumes: Google APIs tab');
value(model,'E10','Zero-valued optional costs are excluded.');
value(model,'E12','At the request volumes entered.');
value(model,'E14','Flat run-rate, not a growth forecast.');
value(model,'E16','Setup less first-month surplus.');
value(model,'E17','Target monthly surplus is entered in C34.');
band(model,19,'Editable assumptions');
value(model,'B20','Change a cost label, quantity or rate. Use reserved custom rows for additional positions.');
model.getRange('B20').format.font={italic:true,color:'#536174'};
value(model,'B21','Pricing checked'); value(model,'C21',new Date('2026-10-22T00:00:00Z')); model.getRange('C21').setNumberFormat('dd-mmm-yyyy');
const inputs = [
  [22,'Paying provider workspaces',25,'count','One company workspace counts as one subscription. Trials and unpaid accounts excluded.'],
  [23,'Advertised subscription price',19,'EUR/month','User-selected research price.'],
  [24,'Subscription VAT treatment','Included','mode','Included = price contains VAT. Added = VAT charged on top. None = no output VAT deducted.'],
  [25,'Subscription VAT rate',.21,'rate',sources.vat],
  [26,'EUR per USD',.90,'EUR/USD','Editable planning assumption, not a current exchange-rate quote.'],
  [27,'Hosting choice','AWS','choice','AWS or Google Cloud. Only the selected hosting row is counted.'],
  [28,'Operating and setup contingency',.10,'rate','Applied to operating subtotal and setup costs. Payment fees are calculated separately.'],
  [29,'Card processing percentage',.015,'rate',sources.stripe],
  [30,'Extra cost per paid workspace',0,'EUR/month','Optional variable support/communications cost. Do not duplicate costs already listed below.'],
  [31,'Card processing fixed charge',.25,'EUR/payment',sources.stripe],
  [32,'Recurring billing fee',.007,'rate',sources.billing],
  [33,'Payment loss / credits reserve',0,'of collections','Optional allowance, not measured history. No-shows and booking charges are not modelled.'],
  [34,'Desired monthly surplus',0,'EUR/month','Target before income taxes. Salaries and marketing count only when entered below.'],
];
for (const [r,label,v,unit,note] of inputs) {
  value(model,`B${r}`,label); value(model,`C${r}`,v);value(model,`D${r}`,unit);value(model,`I${r}`,note);
  editable(model,`C${r}`,[25,28,29,32,33].includes(r)?pct:[22].includes(r)?integer:[24,27].includes(r)?'@':num);
}
countValidation(model,'C22');
for (const r of [23,30,31,34]) decimalValidation(model,`C${r}`);
model.dataValidations.add({range:'C26',rule:{type:'decimal',operator:'between',formula1:.000001,formula2:1000000}});
for (const r of [25,28,29,32,33]) decimalValidation(model,`C${r}`,1);
model.getRange('C24').dataValidation={rule:{type:'list',values:['Included','Added','None']}};
model.getRange('C27').dataValidation={rule:{type:'list',values:['AWS','Google Cloud']}};
band(model,36,'Per-subscriber calculation');
const per = [
  [37,'Advertised price','=C23'],
  [38,'Amount collected per subscription','=IF(C24="Added",C23*(1+C25),C23)'],
  [39,'Revenue excluding output VAT','=IF(C24="Included",C23/(1+C25),C23)'],
  [40,'Card processing cost','=C38*C29+C31'],
  [41,'Recurring billing cost','=C38*C32'],
  [42,'Fees and payment-loss allowance','=SUM(C40:C41)+C38*C33'],
  [43,'Contribution towards operating budget','=C39-C42-C30'],
];
for (const [r,label,f] of per) { value(model,`B${r}`,label);formula(model,`C${r}`,f);model.getRange(`C${r}`).setNumberFormat(eur); }
value(model,'I39','Costs exclude recoverable VAT and include unrecoverable taxes. No vendor VAT return calculation.');
value(model,'I40','Assumes one successful standard EEA card payment per paid workspace each month.');
value(model,'I43','Break-even holds current API usage and other cost quantities fixed as subscriber count changes.');
band(model,45,'Monthly operating costs');
model.getRange('B46:G46').values=[['Cost position','Quantity','Unit cost','Currency','Frequency','Monthly EUR']];heading(model,'B46:G46');
const costs = [
  ['Supabase Pro',1,25,'USD','Monthly',sources.supabase],
  ['Supabase extra audit/staging project',1,10,'USD','Monthly','Extra Micro project allowance. '+sources.supabase],
  ['Additional database compute',0,15,'USD','Monthly','Increment above included/extra project compute only. Enter actual quote to avoid double counting.'],
  ['AWS Lightsail hosting',1,12,'USD','Monthly',sources.aws],
  ['Google Cloud hosting allowance',1,30,'EUR','Monthly',sources.gcp],
  ['Hosting extras / worker allowance',1,5,'EUR','Monthly','Estimate for snapshots, traffic, logs or background worker. Adjust to selected configuration.'],
  ['Additional storage / egress',0,5,'EUR','Monthly','Overages above included Supabase and hosting allowances.'],
  ['Transactional email',1,5,'EUR','Monthly','Planning allowance. Replace with provider quote.'],
  ['Semantic-search API allowance',1,2,'EUR','Monthly','Planning allowance; not measured API usage.'],
  ['Monitoring and backups',1,5,'EUR','Monthly','Planning allowance. Avoid duplicating hosting extras.'],
  ['Domain renewal',1,20,'EUR','Annual','Illustrative annual renewal, spread over 12 months.'],
  ['Outsourced accounting',1,200,'EUR','Monthly',sources.accounts],
  ['Annual accounting report',1,300,'EUR','Annual','Illustrative separate fee. Set quantity to 0 when included in monthly accounting package.'],
  ['Business software',0,10,'EUR','Monthly','Optional, initially excluded.'],
  ['Marketing',0,50,'EUR','Monthly','Optional, initially excluded.'],
  ['Salary / contractor budget',0,1000,'EUR','Monthly','Optional total employer/contractor cost. No statutory payroll calculation.'],
  ['Support hours',0,15,'EUR','Monthly','Quantity is hours. Do not duplicate per-workspace allowance.'],
  ['Custom cost 1',0,0,'EUR','Monthly','Edit label, quantity, rate, currency and frequency.'],
  ['Custom cost 2',0,0,'EUR','Monthly',''],
  ['Custom cost 3',0,0,'EUR','Monthly',''],
  ['Custom cost 4',0,0,'EUR','Monthly',''],
  ['Custom cost 5',0,0,'EUR','Monthly',''],
];
model.getRange('B47:F68').values=costs.map(r=>r.slice(0,5));
model.getRange('I47:I68').values=costs.map(r=>[r[5]]);
editable(model,'B47:F68'); model.getRange('C47:D68').setNumberFormat(num);
model.getRange('E47:E68').dataValidation={rule:{type:'list',values:['EUR','USD']}};
model.getRange('F47:F68').dataValidation={rule:{type:'list',values:['Monthly','Annual']}};
decimalValidation(model,'C47:D68');
for(let r=47;r<=68;r++) {
  const base=`C${r}*D${r}*IF(E${r}="USD",$C$26,1)/IF(F${r}="Annual",12,1)`;
  formula(model,`G${r}`,r===50?`=IF($C$27="AWS",${base},0)`:r===51?`=IF($C$27="Google Cloud",${base},0)`:`=${base}`);
}
for(const [r,label,f,cross] of [
  [69,'Recurring subtotal','=SUM(G47:G68)'],
  [70,'Google APIs',"='Google APIs'!C10",true],
  [71,'Operating subtotal','=SUM(G69:G70)'],
  [72,'Contingency reserve','=G71*$C$28'],
  [73,'Monthly operating budget','=SUM(G71:G72)'],
]) {value(model,`B${r}`,label);formula(model,`G${r}`,f,cross);}
model.getRange('G47:G73').setNumberFormat(eur);
model.getRange('B73:G73').format.fill=pale; model.getRange('B73:G73').format.font.bold=true;
value(model,'I70','Dynamic Maps + Geocoding tiers and optional other Google charge. Inputs on Google APIs tab.');
value(model,'I73','Annual bills are reserved monthly. This is a budget, not a tax return or payment-timing forecast.');
band(model,75,'One-time launch costs');
model.getRange('B76:G76').values=[['Cost position','Quantity','Unit cost','Currency','Timing','Total EUR']];heading(model,'B76:G76');
const setup=['Company formation / setup','Legal terms and privacy review','Payment integration / setup','Launch design and assets','Initial marketing campaign','Equipment','Data migration / onboarding','Custom setup 1','Custom setup 2','Custom setup 3'];
model.getRange('B77:F86').values=setup.map(label=>[label,1,0,'EUR','One-time']);
editable(model,'B77:E86');model.getRange('C77:D86').setNumberFormat(num);decimalValidation(model,'C77:D86');
model.getRange('E77:E86').dataValidation={rule:{type:'list',values:['EUR','USD']}};
for(let r=77;r<=86;r++) {formula(model,`G${r}`,`=C${r}*D${r}*IF(E${r}="USD",$C$26,1)`);value(model,`I${r}`,'No quote supplied. Enter a cost, or keep 0 to exclude.');}
value(model,'B87','Setup contingency');formula(model,'G87','=SUM(G77:G86)*$C$28');
value(model,'B88','One-time launch budget');formula(model,'G88','=SUM(G77:G87)');
model.getRange('G77:G88').setNumberFormat(eur);model.getRange('B88:G88').format.fill=pale;model.getRange('B88:G88').format.font.bold=true;
band(model,90,'Using the estimate');
const guidance=[
  '1. Adjust paying workspaces and price in C22:C23. Choose VAT treatment and hosting in C24 and C27.',
  '2. Edit monthly cost rows 47–68. Annual expenses are divided by 12. Use custom rows before adding new rows.',
  '3. Enter monthly request volumes on Google APIs. Google usage is independent of the subscriber count.',
  '4. Enter one-time quotes in rows 77–86. Zero costs are excluded. Setup costs do not change monthly break-even.',
  '5. Defaults exclude salaries, advertising and booking-payment processing unless you enter them.',
  '6. Cost inputs should include unrecoverable taxes. This model does not calculate vendor reverse-charge VAT.',
];
for(let i=0;i<guidance.length;i++)value(model,`B${91+i}`,guidance[i]);
model.getRange('C11').conditionalFormats.add('cellIs',{operator:'lessThan',formula:0,format:{fill:'#FCE7E7',font:{color:'#B42318',bold:true}}});
model.getRange('C11').conditionalFormats.add('cellIs',{operator:'greaterThanOrEqual',formula:0,format:{fill:'#E4F2E8',font:{color:'#176138',bold:true}}});
model.getRange('C43').conditionalFormats.add('cellIs',{operator:'lessThanOrEqual',formula:0,format:{fill:'#FCE7E7',font:{color:'#B42318',bold:true}}});

for (const [col,width] of Object.entries({B:26,C:17,D:18,E:18,F:19,G:19,H:19,I:19}))api.getRange(`${col}:${col}`).format.columnWidth=width;
value(api,'B2','Google API request budget');
value(api,'B3','Monthly billable events. USD tier rates, converted to EUR using the Launch model assumption.');
api.getRange('B3').format.font={italic:true,color:'#536174'};
band(api,5,'Usage and monthly charges','I');
for(const [r,label,v]of[[6,'Dynamic Maps loads',5000],[7,'Geocoding requests',2000],[8,'Other Google charges (USD)',0]]){value(api,`B${r}`,label);value(api,`C${r}`,v);editable(api,`C${r}`,r===8?usd:integer);}
value(api,'B9','Total Google charges (USD)');formula(api,'C9','=SUM(G27,I27,C8)');api.getRange('C9').setNumberFormat(usd);
value(api,'B10','Total Google charges (EUR)');formula(api,'C10',"=C9*'Launch model'!C26",true);api.getRange('C10').setNumberFormat(eur);
value(api,'B12','EUR per USD');formula(api,'C12',"='Launch model'!C26",true);api.getRange('C12').setNumberFormat('0.0000');
value(api,'B13','Maps free events/month');value(api,'C13',10000);editable(api,'C13',integer);
value(api,'B14','Geocoding free events/month');value(api,'C14',10000);editable(api,'C14',integer);
countValidation(api,'C6:C7');decimalValidation(api,'C8');countValidation(api,'C13:C14');
value(api,'E6','Edit event counts in C6:C7.');
value(api,'E7','Address searches and registered addresses can both incur requests.');
value(api,'E8','Optional flat monthly total for other Google SKUs.');
value(api,'E12','Edit the exchange-rate assumption on Launch model, C26.');
value(api,'E13','Caps apply per SKU across the same billing account.');
band(api,18,'Tier calculation','I');
value(api,'B19','Rates below are USD per 1,000 events. Leave the last upper bound blank for an unlimited final tier.');
api.getRange('B20:I20').values=[['Lower bound','Upper bound','Maps / 1,000','Geocode / 1,000','Paid map events','Maps USD','Paid geo events','Geocode USD']];heading(api,'B20:I20');
api.getRange('B20:I20').format.wrapText=true;api.getRange('B20:I20').format.rowHeight=36;
const tiers=[[0,100000,7,5],[100000,500000,5.6,4],[500000,1000000,4.2,3],[1000000,5000000,2.1,1.5],[5000000,null,.53,.38]];
api.getRange('B21:E25').values=tiers;editable(api,'B21:E25');
api.getRange('B21:C25').setNumberFormat(integer);api.getRange('D21:E25').setNumberFormat(num);
decimalValidation(api,'B21:E25');
for(let r=21;r<=25;r++){
  formula(api,`F${r}`,`=MAX(0,IF(C${r}="",$C$6,MIN($C$6,C${r}))-MAX(B${r},$C$13))`);
  formula(api,`G${r}`,`=F${r}*D${r}/1000`);
  formula(api,`H${r}`,`=MAX(0,IF(C${r}="",$C$7,MIN($C$7,C${r}))-MAX(B${r},$C$14))`);
  formula(api,`I${r}`,`=H${r}*E${r}/1000`);
}
value(api,'B27','Calculated totals');for(const col of ['F','G','H','I'])formula(api,`${col}27`,`=SUM(${col}21:${col}25)`);
api.getRange('F21:F27').setNumberFormat(integer);api.getRange('H21:H27').setNumberFormat(integer);
api.getRange('G21:G27').setNumberFormat(usd);api.getRange('I21:I27').setNumberFormat(usd);
api.getRange('B27:I27').format.fill=pale;api.getRange('B27:I27').format.font.bold=true;
value(api,'B29','Free map events used');formula(api,'C29','=MIN(C6,C13)');
value(api,'B30','Free geocodes used');formula(api,'C30','=MIN(C7,C14)');api.getRange('C29:C30').setNumberFormat(integer);
band(api,34,'Source and scope','I');
const notes=[
  'Global pay-as-you-go pricing checked 22 October 2026. Standard pricing, without negotiated discounts.',
  sources.google,
  'Maps and Geocoding only. Other Google product costs can be entered in C8. A billing account may have other apps.',
  'A map load is a billable map initialisation, not one unique visitor or booking. Reloads can add events.',
  'Edit tier bounds and rates together if pricing changes. Keep contiguous increasing bands to avoid gaps or overlaps.',
  'For the first paid tier: MAX(0, MIN(requests, 100000) - free_cap) / 1000 * price_per_1000.',
  'Usage does not automatically scale with provider count. Enter a separate demand assumption when comparing costs.',
];
for(let i=0;i<notes.length;i++)value(api,`B${35+i}`,notes[i]);

// Verify actual recalculation on editable cells, then restore delivery defaults.
const cell=(sh,addr)=>sh.getRange(addr).values[0][0];
const close=(actual,expected,label)=>assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<1e-7,`${label}: ${actual} vs ${expected}`);
const tierCost=(requests,free,rates)=>{
  const bounds=[0,100000,500000,1000000,5000000,Infinity];
  return rates.reduce((sum,rate,i)=>sum+Math.max(0,Math.min(requests,bounds[i+1])-Math.max(free,bounds[i]))*rate/1000,0);
};
for(const [maps,geos]of[[0,0],[10000,10000],[10001,10001],[25000,10000],[50000,20000],[100001,100001],[500001,500001],[1000001,1000001],[5000001,5000001]]){
  value(api,'C6',maps);value(api,'C7',geos);wb.recalculate();
  const expected=tierCost(maps,10000,[7,5.6,4.2,2.1,.53])+tierCost(geos,10000,[5,4,3,1.5,.38]);
  close(cell(api,'C9'),expected,`Google ${maps}/${geos}`);close(cell(model,'G70'),expected*.9,'Google EUR link');
}
value(api,'C6',5000);value(api,'C7',2000);
for(const mode of ['Included','Added','None']){
  value(model,'C24',mode);wb.recalculate();
  const collected=mode==='Added'?19*1.21:19;
  const revenue=mode==='Included'?19/1.21:19;
  close(cell(model,'C43'),revenue-collected*(.015+.007)-.25,'VAT contribution '+mode);
}
value(model,'C24','Included');value(model,'C22',0);wb.recalculate();
close(cell(model,'C7'),0,'zero subscriber revenue');close(cell(model,'C11'),-cell(model,'G73'),'zero subscriber shortfall');
value(model,'C22',25);value(model,'C27','Google Cloud');wb.recalculate();
close(cell(model,'G50'),0,'AWS excluded');close(cell(model,'G51'),30,'Cloud allowance selected');
value(model,'C27','AWS');value(model,'D64',12);value(model,'C64',2);value(model,'F64','Annual');wb.recalculate();
close(cell(model,'G64'),2,'Custom annual position recalculates');
value(model,'C64',0);value(model,'D64',0);value(model,'F64','Monthly');
value(model,'D77',100);wb.recalculate();close(cell(model,'G88'),110,'setup cost and contingency');
value(model,'D77',0);value(model,'C23',0);wb.recalculate();assert.equal(cell(model,'C12'),'n.a.','nonpositive contribution has no finite break-even');
value(model,'C23',19);value(model,'C22',null);wb.recalculate();assert.equal(cell(model,'C11'),'n.a.','missing subscribers must not appear as valid zero');
value(model,'C22',25);wb.recalculate();
const independentCosts=(25+10+12)*.9+5+5+2+5+20/12+200+300/12;
close(cell(model,'G73'),independentCosts*1.1,'monthly operating budget');
const contribution=19/1.21-19*.022-.25;
close(cell(model,'C11'),25*contribution-independentCosts*1.1,'default monthly surplus');
assert.equal(cell(model,'C12'),Math.ceil(independentCosts*1.1/contribution),'default break-even');

const errorScan=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},summary:'Formula error scan'});
console.log(errorScan.ndjson);
await fs.writeFile(path.join(out,'_work','formula-scan.txt'),errorScan.ndjson);
console.log((await wb.inspect({kind:'table',range:"'Launch model'!B6:C17",include:'values,formulas',tableMaxRows:12,tableMaxCols:2,maxChars:3500})).ndjson);
for(const [sheet,range,file] of [
  ['Launch model','B2:G17','summary.png'],
  ['Launch model','B19:G43','inputs.png'],
  ['Launch model','B45:G73','costs.png'],
  ['Launch model','B75:G96','setup.png'],
  ['Google APIs','B2:I30','google.png'],
]){
  const preview=await wb.render({sheetName:sheet,range,scale:1.5,format:'png'});
  await fs.writeFile(path.join(out,'_work',file),new Uint8Array(await preview.arrayBuffer()));
}
const filename=path.join(out,'FitsMyTime_Latvia_Launch_Estimate.xlsx');
await (await SpreadsheetFile.exportXlsx(wb)).save(filename);
// Reimport checks that formulas/controls and cached results survive the file boundary.
const saved=await SpreadsheetFile.importXlsx(await FileBlob.load(filename));
saved.recalculate();
close(saved.worksheets.getItem('Launch model').getRange('C11').values[0][0],cell(model,'C11'),'exported surplus');
assert.equal(saved.worksheets.getItem('Launch model').getRange('C12').values[0][0],cell(model,'C12'),'exported break-even');
console.log(JSON.stringify({file:filename,monthlyCost:cell(model,'G73'),surplus:cell(model,'C11'),breakEven:cell(model,'C12'),tests:'Passed tier boundaries, VAT modes, hosting choice, zero/missing subscribers, custom cost, setup cost, error scan and XLSX reimport.'}));
