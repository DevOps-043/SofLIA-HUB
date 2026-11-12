/** Vectorización del archivo original: contornos de píxel, sin recrear nodos. */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const original=process.argv[2] || root+'references/logo-original.png';
const {data,info}=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const {width:w,height:h}=info;
function simplify(points,tolerance=.65){
  if(points.length<3)return points;
  const a=points[0],b=points.at(-1);let max=0,index=0;
  for(let i=1;i<points.length-1;i++){
    const p=points[i],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    const d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
    if(d>max){max=d;index=i;}
  }
  return max>tolerance?[...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)]:[a,b];
}
const layers=[];
for(const color of ['navy','teal']){
  const mask=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++)mask[i]=data[i*4+3]>=128 && (color==='navy'?data[i*4+1]<110:data[i*4+1]>=110)?1:0;
  const edges=new Map();
  const inside=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&mask[y*w+x];
  const add=(x,y,u,v)=>{const key=`${x},${y}`;if(!edges.has(key))edges.set(key,[]);edges.get(key).push([u,v]);};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(inside(x,y)){
    if(!inside(x,y-1))add(x,y,x+1,y);
    if(!inside(x+1,y))add(x+1,y,x+1,y+1);
    if(!inside(x,y+1))add(x+1,y+1,x,y+1);
    if(!inside(x-1,y))add(x,y+1,x,y);
  }
  const polygons=[];
  while(edges.size){
    const start=edges.keys().next().value;let key=start;const points=[];
    do{const options=edges.get(key);if(!options?.length)throw Error('Contorno abierto en el logo');
      const next=options.pop();points.push(key.split(',').map(Number));if(!options.length)edges.delete(key);key=next.join(',');
    }while(key!==start);
    const simple=points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});
    const area=simple.reduce((s,p,i)=>{const q=simple[(i+1)%simple.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;
    if(area>20){const mid=Math.floor(simple.length/2);polygons.push([...simplify(simple.slice(0,mid+1)).slice(0,-1),...simplify([...simple.slice(mid),simple[0]]).slice(0,-1)]);}
  }
  layers.push({color,polygons});
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${layers.map(l=>`<path fill="${l.color==='navy'?'#062940':'#09bca5'}" d="${l.polygons.map(p=>'M'+p.map(x=>x.join(' ')).join('L')+'Z').join('')}"/>`).join('')}</svg>`;
await mkdir(root+'assets/logos',{recursive:true});
await writeFile(root+'assets/logos/soflia-original.svg',svg);
await writeFile(root+'assets/logos/contours.json',JSON.stringify({width:w,height:h,layers}));
const raster=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
let union=0,intersection=0;
for(let i=0;i<w*h;i++){const a=data[i*4+3]>=128,b=raster[i*4+3]>=128;union+=a||b;intersection+=a&&b;}
const report={original:{width:w,height:h},method:'Contorno del alfa y dos regiones de color, sin reconstruir topología',silhouetteIoU:intersection/union,regions:layers.map(l=>({color:l.color,count:l.polygons.length,vertices:l.polygons.reduce((n,p)=>n+p.length,0)}))};
await mkdir(root+'build',{recursive:true});await writeFile(root+'build/logo-validation.json',JSON.stringify(report,null,2));
if(report.silhouetteIoU<.99)throw Error('La vectorización no conserva suficientemente el alfa');
console.info(JSON.stringify(report));
