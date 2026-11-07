import {assess,numericIndex} from './arithmetic.mjs';
export function assessIndexed(raw,input){
 try{
  if(typeof raw!=='object'||raw===null||Array.isArray(raw))return {kind:'rejected',reason:'Invalid indexed plan'};
  const plan=Object.hasOwn(raw,'qualifiers')?raw:{...raw,qualifiers:[]};
  if(Object.keys(plan).length!==4||!['kind','operations','outputs','qualifiers'].every(k=>Object.hasOwn(plan,k))||!Array.isArray(plan.operations)||!Array.isArray(plan.outputs))return {kind:'rejected',reason:'Unexpected indexed plan fields'};
  const operations=[];
  for(const [index,row] of plan.operations.entries()){
   if(typeof row!=='object'||row===null||Array.isArray(row)||Object.keys(row).length!==3||!['op','left','right'].every(k=>Object.hasOwn(row,k)))return {kind:'rejected',reason:'Operation rows have code-assigned IDs'};
   operations.push({...row,id:'r'+(index+1)});
  }
  const refs=new Set();
  for(const row of operations){refs.add(row.left);refs.add(row.right);}
  for(const output of plan.outputs){refs.add(output?.left);refs.add(output?.right);refs.add(output?.value);}
  const indexed=numericIndex(input).filter(q=>refs.has(q.id));
  const quantities=indexed.map(({id,sourceId,quote,token})=>({id,sourceId,quote,token}));
  const result=assess({...plan,operations,quantities},input);
  return result.kind==='numeric'?{...result,operands:indexed,quantitySource:'deterministic-index'}:result;
 }catch(error){return {kind:'rejected',reason:error instanceof Error?error.message:'Invalid numeric index'};}
}
