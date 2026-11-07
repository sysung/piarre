import { assess } from './arithmetic.mjs';
const words=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
const pattern=new RegExp('[+-]?\\d{1,13}(?:\\.\\d{1,6})?|'+words.toSorted((a,b)=>b.length-a.length).join('|'),'giu');
function isolated(text,at,length){
 const before=text[at-1]??'',after=text[at+length]??'';
 const wordOrSign=/[\p{L}\p{N}_+\-/]/u.test(before)||/[\p{L}\p{N}_+\-/]/u.test(after);
 const prefix=/[.,]/.test(before)&&/\d/.test(text[at-2]??'');
 const suffix=/[.,]/.test(after)&&/\d/.test(text[at+length+1]??'');
 return !wordOrSign&&!prefix&&!suffix;
}
export function numericIndex(input){
 const entries=[];
 for(const source of input.sources){
  for(const match of source.text.matchAll(pattern)){
   if(!isolated(source.text,match.index,match[0].length))continue;
   if(entries.length===24)throw new Error('Numeric index exceeds24 literals');
   const token=match[0],word=words.indexOf(token.toLowerCase());
   entries.push({id:'q'+(entries.length+1),sourceId:source.id,token,quote:source.text.slice(Math.max(0,match.index-40),match.index+token.length+40),value:word>=0?String(word):token,status:source.status});
  }
 }
 return entries;
}
export function assessIndexed(raw,input){
 if(typeof raw!=='object'||raw===null||Array.isArray(raw))return {kind:'rejected',reason:'Invalid indexed plan'};
 const plan=Object.hasOwn(raw,'qualifiers')?raw:{...raw,qualifiers:[]};
 if(Object.keys(plan).length!==4||!['kind','operations','outputs','qualifiers'].every(k=>Object.hasOwn(plan,k))||!Array.isArray(plan.operations)||!Array.isArray(plan.outputs))return {kind:'rejected',reason:'Unexpected indexed plan fields'};
 const refs=new Set();
 for(const row of plan.operations){refs.add(row?.left);refs.add(row?.right);}
 for(const output of plan.outputs){refs.add(output?.left);refs.add(output?.right);refs.add(output?.value);}
 const quantities=numericIndex(input).filter(q=>refs.has(q.id)).map(({id,sourceId,quote,token})=>({id,sourceId,quote,token}));
 return assess({...plan,quantities},input);
}
