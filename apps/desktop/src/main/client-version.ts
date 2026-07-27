function numericParts(value: string): number[] | undefined {
  if (!/^\d+(?:\.\d+)*$/.test(value)) return undefined;
  return value.split(".").map(Number);
}

export function isClientVersionNewer(candidate: string, current: string): boolean {
  const left=numericParts(candidate),right=numericParts(current);
  if(!left||!right)return false;
  const length=Math.max(left.length,right.length);
  for(let index=0;index<length;index+=1){const difference=(left[index]??0)-(right[index]??0);if(difference!==0)return difference>0;}
  return false;
}
