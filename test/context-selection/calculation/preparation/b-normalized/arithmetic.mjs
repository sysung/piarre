import { Buffer } from 'node:buffer';

const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
const bound = 1_000_000_000_000n;
function check(condition, reason) { if (!condition) throw new Error(reason); }
function shape(value, keys) {
 check(typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key)), 'Unexpected fields');
}
function text(value, max=400) { check(typeof value==='string' && value.trim() && value.length<=max, 'Invalid text');return value; }
function id(value) { check(typeof value==='string' && /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(value),'Invalid quantity or row ID');return value; }
function gcd(a,b) { while(b) [a,b]=[b,a%b];return a<0n?-a:a; }
function rational(n,d=1n) {
 check(d!==0n,'Division by zero');if(d<0n){n=-n;d=-d;}const factor=gcd(n,d);n/=factor;d/=factor;
 check(n<=bound && n>=-bound && d<=bound,'Arithmetic limit exceeded');return {n,d};
}
function literal(token) {
 text(token,40);const word=words.indexOf(token.toLowerCase());if(word>=0)return rational(BigInt(word));
 check(/^[+-]?\d{1,13}(?:\.\d{1,6})?$/.test(token),'Unsupported numeric token');
 const parts=token.split('.');return rational(BigInt(parts.join('')),10n**BigInt(parts[1]?.length??0));
}
function format(value) { return value.d===1n?String(value.n):value.n+'/'+value.d; }
function operate(op,left,right) {
 switch(op){
  case 'add':return rational(left.n*right.d+right.n*left.d,left.d*right.d);
  case 'subtract':return rational(left.n*right.d-right.n*left.d,left.d*right.d);
  case 'multiply':return rational(left.n*right.n,left.d*right.d);
  case 'divide':return rational(left.n*right.d,left.d*right.n);
  default:throw new Error('Unsupported operator');
 }
}
function quote(anchor, sources) {
 shape(anchor,['sourceId','quote']);text(anchor.sourceId,200);text(anchor.quote);
 const source=sources.get(anchor.sourceId);check(source && source.text.includes(anchor.quote),'Quotation is not in the original source');return source;
}

const compoundWords=new Set([...words,'thirty','forty','fifty','sixty','seventy','eighty','ninety','hundred','thousand','million','billion','trillion']);
const fractionWords='half|halves|quarter|quarters|third|thirds|fourth|fourths|fifth|fifths|sixth|sixths|seventh|sevenths|eighth|eighths|ninth|ninths|tenth|tenths';
const fractionNames=new Set(fractionWords.split('|'));
const fractionContext=new RegExp('^\\s+(?:'+fractionWords+')\\b|^\\s+and\\s+(?:(?:a|one|\\d+)\\s+)?(?:'+fractionWords+')\\b|^\\s+and\\s+\\d+\\s*/\\s*\\d+\\b','iu');
function isolated(source,start,end) {
 const before=source[start-1]??'',after=source[end]??'';
 const prefix=source.slice(0,start),suffix=source.slice(end);
 const modifier=suffix.match(/^[-‐‑]([\p{L}]+)(?=$|[^\p{L}\p{N}_])/u)?.[1]?.toLowerCase();
 const wordModifier=modifier && !compoundWords.has(modifier) && !fractionNames.has(modifier);
 if(/[\p{L}\p{N}_+\-/−＋－﹣‐‑‒–—―]/u.test(before) || /[\p{L}\p{N}_+\-/−＋－﹣‐‑‒–—―]/u.test(after) && !wordModifier)return false;
 if(/[.,]/.test(before) && /\d/.test(source[start-2]??'') || /[.,]/.test(after) && /\d/.test(source[end+1]??''))return false;
 if(/[+\-/−＋－﹣‐‑‒–—―]\s*$/.test(prefix) || /^\s*[+\-/−＋－﹣‐‑‒–—―]/.test(suffix) && !wordModifier)return false;
 const prior=prefix.match(/([\p{L}\p{N}_]+)\s+$/u)?.[1]?.toLowerCase();
 const next=suffix.match(/^\s+([\p{L}\p{N}_]+)/u)?.[1]?.toLowerCase();
 if(prior && (compoundWords.has(prior) || /^\d+$/.test(prior) || ['minus','negative','plus','positive'].includes(prior)))return false;
 if(next && (compoundWords.has(next) || /^\d+$/.test(next)))return false;
 if(fractionContext.test(suffix))return false;
 if(/\b(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)\s+and\s+$/iu.test(prefix) || /^\s+and\s+(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)\b/iu.test(suffix))return false;
 return true;
}
function* sourceLiterals(source) {
 // Scan complete words, avoiding a short cardinal prefix inside a longer word.
 for(const match of source.text.matchAll(/[+-]?\d+(?:\.\d+)?|[\p{L}]+/gu)){
  const start=match.index,end=start+match[0].length;
  if(!isolated(source.text,start,end))continue;
  let value;try{value=literal(match[0]);}catch{continue;}
  yield {value,token:match[0],start,end};
 }
}
function sourceMap(input) {
 check(typeof input.question==='string' && input.question.trim() && Array.isArray(input.sources) && input.sources.length<=20,'Invalid inquiry');
 check(Buffer.byteLength(JSON.stringify(input))<=6000,'Inquiry too large');
 const sources=new Map();
 for(const source of input.sources){text(source.id,200);text(source.text,6000);text(source.status,40);check(!sources.has(source.id),'Duplicate source');sources.set(source.id,source);}
 return sources;
}
export function numericIndex(input) {
 const entries=[];
 for(const source of sourceMap(input).values()){
  if(source.status!=='confirmed' && source.status!=='user-input')continue;
  for(const found of sourceLiterals(source)){
   check(entries.length<24,'Numeric index exceeds 24 supported occurrences');
   entries.push({id:'q'+(entries.length+1),sourceId:source.id,token:found.token,
    quote:source.text.slice(Math.max(0,found.start-40),found.end+40),value:format(found.value),status:source.status,start:found.start,end:found.end});
  }
 }
 return entries;
}
function sourceQuantity(quantity,source) {
 const requested=literal(text(quantity.token,40));
 const spans=[];
 for(let start=source.text.indexOf(quantity.quote);start>=0;start=source.text.indexOf(quantity.quote,start+1))spans.push({start,end:start+quantity.quote.length});
 for(const found of sourceLiterals(source)){
  if(spans.some(span=>span.start<=found.start && found.end<=span.end) && found.value.n===requested.n && found.value.d===requested.d)return {...found,modelToken:quantity.token,sourceId:source.id,quote:quantity.quote};
 }
 throw new Error('Numeric value has no isolated original source token inside the quotation');
}

export function assess(raw,input) {
 try {
  const sources=sourceMap(input);
  const keys=['kind','quantities','operations','outputs'];
  shape(raw,raw && Object.hasOwn(raw,'qualifiers')?[...keys,'qualifiers']:keys);check(raw.kind==='numeric','Unsupported proposal kind');
  const qualifiers=Object.hasOwn(raw,'qualifiers')?raw.qualifiers:[];
  check(Array.isArray(raw.quantities) && raw.quantities.length>0 && raw.quantities.length<=12,'Quantity limit');
  check(Array.isArray(raw.operations) && raw.operations.length<=20,'Operation limit');
  check(Array.isArray(raw.outputs) && raw.outputs.length>0 && raw.outputs.length<=4,'Output limit');
  check(Array.isArray(qualifiers) && qualifiers.length<=8,'Qualification limit');
  const values=new Map(),operands=[];
  const get=ref=>{const value=values.get(ref);check(typeof ref==='string' && value,'Unknown or forward reference');return value;};
  for(const quantity of raw.quantities){
   shape(quantity,['id','sourceId','quote','token']);const key=id(quantity.id);check(!values.has(key),'Duplicate numeric ID');
   const source=quote({sourceId:quantity.sourceId,quote:quantity.quote},sources);
   check(source.status==='confirmed' || source.status==='user-input','Unconfirmed numeric operand');
   const operand=sourceQuantity(quantity,source);operands.push({id:key,...operand,value:format(operand.value)});
   values.set(key,{value:operand.value,sourceIds:[source.id]});
  }
  for(const row of raw.operations){
   shape(row,['id','op','left','right']);const key=id(row.id);check(!values.has(key),'Duplicate numeric ID');
   const left=get(row.left),right=get(row.right);
   values.set(key,{value:operate(row.op,left.value,right.value),sourceIds:[...new Set([...left.sourceIds,...right.sourceIds])]});
  }
  const used=new Set();const computed=[];
  const cite=refs=>{for(const source of refs)used.add(source);return ' ['+refs.join(', ')+']';};
  const lines=['Calculated numerical conditions. These results do not grant authorization.'];
  for(const output of raw.outputs){
   const label=text(output.label,120);
   if(output.kind==='value'){
    shape(output,['kind','label','value']);const result=get(output.value);
    computed.push({label,value:format(result.value),sourceIds:result.sourceIds});
    lines.push(label+': '+format(result.value)+cite(result.sourceIds));
   }else{
    shape(output,['kind','label','left','relation','right']);check(output.kind==='comparison','Invalid output kind');
    const left=get(output.left),right=get(output.right);const a=left.value.n*right.value.d,b=right.value.n*left.value.d;
    const relations={lt:[a<b,'<'],le:[a<=b,'<='],eq:[a===b,'='],ge:[a>=b,'>='],gt:[a>b,'>']};
    check(Object.hasOwn(relations,output.relation),'Unsupported numeric relation');
    const [value,symbol]=relations[output.relation];const refs=[...new Set([...left.sourceIds,...right.sourceIds])];
    computed.push({label,left:format(left.value),relation:symbol,right:format(right.value),value,sourceIds:refs});
    lines.push(label+': '+format(left.value)+' '+symbol+' '+format(right.value)+': '+value+cite(refs));
   }
  }
  for(const qualifier of qualifiers){const source=quote(qualifier,sources);lines.push('Source qualification: '+qualifier.quote+cite([source.id]));}
  return {kind:'numeric',text:lines.join('\n'),sourceIds:[...used],computed,operands,semanticValidation:'not-established',unitValidation:'not-established'};
 }catch(error){return {kind:'rejected',reason:error instanceof Error?error.message:'Invalid plan'};}
}
