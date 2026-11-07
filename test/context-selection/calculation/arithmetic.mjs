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

export function assess(raw,input) {
 try {
  check(typeof input.question==='string' && input.question.trim() && Array.isArray(input.sources) && input.sources.length<=20,'Invalid inquiry');
  check(Buffer.byteLength(JSON.stringify(input))<=6000,'Inquiry too large');
  const sources=new Map();
  for(const source of input.sources){text(source.id,200);text(source.text,6000);text(source.status,40);check(!sources.has(source.id),'Duplicate source');sources.set(source.id,source);}
  shape(raw,['kind','quantities','operations','outputs','qualifiers']);check(raw.kind==='numeric','Unsupported proposal kind');
  check(Array.isArray(raw.quantities) && raw.quantities.length>0 && raw.quantities.length<=12,'Quantity limit');
  check(Array.isArray(raw.operations) && raw.operations.length<=20,'Operation limit');
  check(Array.isArray(raw.outputs) && raw.outputs.length>0 && raw.outputs.length<=4,'Output limit');
  check(Array.isArray(raw.qualifiers) && raw.qualifiers.length<=8,'Qualification limit');
  const values=new Map();
  const get=ref=>{const value=values.get(ref);check(typeof ref==='string' && value,'Unknown or forward reference');return value;};
  for(const quantity of raw.quantities){
   shape(quantity,['id','sourceId','quote','token']);const key=id(quantity.id);check(!values.has(key),'Duplicate numeric ID');
   const source=quote({sourceId:quantity.sourceId,quote:quantity.quote},sources);
   check(source.status==='confirmed' || source.status==='user-input','Unconfirmed numeric operand');
   const token=text(quantity.token,40);const escaped=token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   let isolated=false;
   const pattern=new RegExp(escaped,'giu');
   for(const match of quantity.quote.matchAll(pattern)){
    for(let start=source.text.indexOf(quantity.quote);start>=0;start=source.text.indexOf(quantity.quote,start+1)){
     const at=start+match.index;const before=source.text[at-1]??'',after=source.text[at+match[0].length]??'';
     const signedOrWord=/[\p{L}\p{N}_+\-/]/u.test(before) || /[\p{L}\p{N}_+\-/]/u.test(after);
     const numericPrefix=/[.,]/.test(before) && /\d/.test(source.text[at-2]??'');
     const numericSuffix=/[.,]/.test(after) && /\d/.test(source.text[at+match[0].length+1]??'');
     if(!signedOrWord && !numericPrefix && !numericSuffix)isolated=true;
    }
   }
   check(isolated,'Numeric token is not an isolated source token');
   values.set(key,{value:literal(token),sourceIds:[source.id]});
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
  for(const qualifier of raw.qualifiers){const source=quote(qualifier,sources);lines.push('Source qualification: '+qualifier.quote+cite([source.id]));}
  return {kind:'numeric',text:lines.join('\n'),sourceIds:[...used],computed,semanticValidation:'not-established',unitValidation:'not-established'};
 }catch(error){return {kind:'rejected',reason:error instanceof Error?error.message:'Invalid plan'};}
}
