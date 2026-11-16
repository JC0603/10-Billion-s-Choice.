importScripts('./vendor/xlsx.full.min.js','./engine.js');
let model;
self.onmessage=async({data:{id,type,payload}})=>{
 try{let result;if(type==='load'){
  self.postMessage({status:'엑셀 시트를 읽고 유발계수를 검증하고 있습니다…'});
  const wb=XLSX.read(payload,{type:'array'}),book={};for(const name of wb.SheetNames)book[name]=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,blankrows:true});model=IOEngine.fromSheets(book);
  result={n:model.n,sectors:model.codes.map((code,i)=>({code,name:model.names[i],output:model.outputs[i]})).filter(s=>s.output>0),sheets:Object.keys(book),validation:model.validation};
 }else{if(!model)throw Error('먼저 엑셀을 불러오세요.');if(type==='compare')result={cases:payload.cases.map(c=>IOEngine.simulate(model,c.items,payload.budget)),ranking:IOEngine.ranking(model,payload.budget)};else if(type==='sheet')result=IOEngine.sheetInfo(model,payload);else if(type==='explore')result=IOEngine.explore(model,payload.sheet,payload.row);else throw Error('알 수 없는 요청입니다.');}self.postMessage({id,ok:true,result});
 }catch(e){self.postMessage({id,ok:false,error:e.message});}
};
