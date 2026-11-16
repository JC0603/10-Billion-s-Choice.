(function(root){
'use strict';
const code=v=>String(v??'').trim();
const num=(v,label)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(label+'에 숫자가 아닌 값이 있습니다.');return v;};
function fromSheets(book){
 const adRows=book['국산투입계수(Ad)'];
 if(!adRows?.[4])throw Error('국산투입계수(Ad) 시트가 없습니다. 한국은행 생산자가격 투입산출표를 사용하세요.');
 if(!Object.values(book).some(r=>String(r[1]?.[0]).includes('2023')))throw Error('이 앱은 2023년 자료를 지원합니다.');
 const rowCodes=new Set(adRows.slice(6).map(r=>code(r[0])));
 const codes=adRows[4].slice(2).map(code).filter(c=>c&&rowCodes.has(c)&&!(Number(c)>=9000));
 const n=codes.length;if(![33,83,165,380].includes(n)||new Set(codes).size!==n)throw Error('산업 수와 코드가 올바르지 않습니다. 33·83·165·380개 부문을 지원합니다.');
 const namesByCode=new Map(adRows.slice(6).map(r=>[code(r[0]),String(r[1]??'').trim()]));
 function matrix(sheet){const rows=book[sheet];if(!rows)throw Error(sheet+' 시트가 없습니다.');const ri=new Map(rows.slice(6).map(r=>[code(r[0]),r])),ci=new Map(rows[4].map((c,i)=>[code(c),i]));const a=new Float64Array(n*n);for(let i=0;i<n;i++)for(let j=0;j<n;j++)a[i*n+j]=num(ri.get(codes[i])?.[ci.get(codes[j])],sheet);return a;}
 const L=matrix('생산유발계수'),M=matrix('수입유발계수'),V=matrix('부가가치유발계수'),Ad=matrix('국산투입계수(Ad)'),Am=matrix('수입투입계수(Am)');
 const total=book['총투입계수(A)'];if(!total)throw Error('총투입계수(A) 시트가 없습니다.');const va=total.find(r=>code(r[0])==='9690');if(!va)throw Error('부가가치계(9690)가 없습니다.');const ci=new Map(total[4].map((c,i)=>[code(c),i])),v=codes.map(c=>num(va[ci.get(c)],'부가가치계'));
 let production=0,imports=0,valueAdded=0;
 for(let i=0;i<n;i++){const dl=new Float64Array(n),ml=new Float64Array(n);for(let k=0;k<n;k++){const a=Ad[i*n+k],b=Am[i*n+k];for(let j=0;j<n;j++){dl[j]+=a*L[k*n+j];ml[j]+=b*L[k*n+j];}}for(let j=0;j<n;j++){production=Math.max(production,Math.abs(L[i*n+j]-dl[j]-(i===j?1:0)));imports=Math.max(imports,Math.abs(ml[j]-M[i*n+j]));valueAdded=Math.max(valueAdded,Math.abs(v[i]*L[i*n+j]-V[i*n+j]));}}
 const tolerance=1e-8,validation={production,imports,valueAdded,tolerance};if(Math.max(production,imports,valueAdded)>=tolerance)throw Error('계수 검증에 실패했습니다. 같은 연도와 분류의 시트를 사용하세요.');
 const transactions=book['A표_총거래표(생산자)'];if(!transactions)throw Error('총거래표가 없습니다.');const outputRow=transactions.find(r=>code(r[0])==='9790'),outputCols=new Map(transactions[4].map((c,i)=>[code(c),i]));const outputs=codes.map(c=>num(outputRow?.[outputCols.get(c)],'총투입계'));
 return {codes,names:codes.map(c=>namesByCode.get(c)),n,L,M,V,book,validation,outputs};
}
const sum=a=>Array.from(a).reduce((a,b)=>a+b,0);
function simulate(model,items,budget){
 if(!Number.isFinite(budget)||budget<=0||budget>1e8)throw Error('분석 금액은 0보다 크고 1,000,000억 원 이하여야 합니다.');if(!items.length)throw Error('산업을 하나 이상 선택하세요.');let share=0;const f=new Float64Array(model.n);
 for(const item of items){const i=model.codes.indexOf(item.code);if(i<0)throw Error('산업코드를 찾을 수 없습니다.');if(!Number.isFinite(item.share)||item.share<0||item.share>100)throw Error('배분 비중은 0~100%로 입력하세요.');if(item.share>0&&model.outputs[i]<=0)throw Error('국내 생산이 없는 부문에는 국산품 수요를 배분할 수 없습니다.');share+=item.share;f[i]+=budget*item.share/100;}
 if(Math.abs(share-100)>1e-7)throw Error('각 시나리오의 배분 비중 합계는 100%여야 합니다.');
 const mul=a=>{const r=new Float64Array(model.n);for(let i=0;i<model.n;i++)for(let j=0;j<model.n;j++)r[i]+=a[i*model.n+j]*f[j];return r;};const x=mul(model.L),m=mul(model.M),v=mul(model.V);
 return {demand:sum(f),production:sum(x),imports:sum(m),valueAdded:sum(v),multiplier:sum(x)/budget,rows:model.codes.map((code,i)=>({code,name:model.names[i],demand:f[i],production:x[i],indirect:x[i]-f[i],imports:m[i],valueAdded:v[i]}))};
}
function ranking(model,budget){return model.codes.map((code,j)=>{let production=0,imports=0,valueAdded=0;for(let i=0;i<model.n;i++){production+=model.L[i*model.n+j]*budget;imports+=model.M[i*model.n+j]*budget;valueAdded+=model.V[i*model.n+j]*budget;}return {code,name:model.names[j],production,imports,valueAdded,output:model.outputs[j]};}).filter(x=>x.output>0);}
function sheetInfo(model,sheet){const r=model.book[sheet];if(!r)throw Error('시트를 선택하세요.');return {rows:r.slice(6).filter(x=>x[0]!=null&&x[1]!=null).map(x=>({code:code(x[0]),name:String(x[1]).trim()})),unit:String(r[3]?.[0]||'계수 / 비율 (행·열 이름 확인)')};}
function explore(model,sheet,row){const r=model.book[sheet];if(!r)throw Error('시트가 없습니다.');const selected=r.slice(6).find(r=>code(r[0])===row);if(!selected)throw Error('행을 선택하세요.');return r[4].map((c,i)=>({code:code(c),name:String(r[5]?.[i]??''),value:selected[i]??null})).filter((r,i)=>i>=2&&r.code);}
const api={fromSheets,simulate,ranking,sheetInfo,explore};root.IOEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof self!=='undefined'?self:globalThis);
