import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('.',import.meta.url));
const folder=root+'previews/selected-a-v1/';
const geometry=JSON.parse(await readFile(root+'build/selected-a-v1/geometry-report.json','utf8'));
const landmarks=JSON.parse(await readFile(root+'references/selected-a-landmarks.json','utf8'));
const source=await readFile(root+'references/'+landmarks.source);
const front=await readFile(folder+'front.png');
const range=points=>({minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))});
const rb=range(landmarks.body),mb=range(geometry.frontContours.body);
const rs=540/(rb.maxX-rb.minX),ms=540/(mb.maxX-mb.minX);
const rc=[(rb.minX+rb.maxX)/2,(rb.minY+rb.maxY)/2],mc=[(mb.minX+mb.maxX)/2,(mb.minY+mb.maxY)/2];
const rp=([x,y])=>[320+(x-rc[0])*rs,300+(y-rc[1])*rs];
const mp=([x,z])=>[320+(x-mc[0])*ms,300-(z-mc[1])*ms];
const path=points=>'M'+points.map(p=>p.map(v=>v.toFixed(2)).join(',')).join('L')+'Z';
const text=(x,y,value,size=20,color='#27333c')=>`<text x="${x}" y="${y}" font-family="Segoe UI, sans-serif" font-size="${size}" fill="${color}">${value}</text>`;
const referenceImage=`<clipPath id="referenceCrop"><rect width="640" height="530"/></clipPath><g clip-path="url(#referenceCrop)"><image href="data:image/png;base64,${source.toString('base64')}" x="${320-rc[0]*rs}" y="${300-rc[1]*rs}" width="${1774*rs}" height="${887*rs}"/></g>`;
const imageScale=ms/(768/3.2);
const modelImage=`<image href="data:image/png;base64,${front.toString('base64')}" x="${320-(384+mc[0]*240)*imageScale}" y="${300-(384-mc[1]*240)*imageScale}" width="${768*imageScale}" height="${768*imageScale}"/>`;
const overlay=`<path d="${path(geometry.frontContours.body.map(mp))}" fill="#d8dde1"/>
<path d="${path(geometry.frontContours.display.map(mp))}" fill="#515b64"/>
${['body','display'].map(key=>`<path d="${path(landmarks[key].map(rp))}" fill="none" stroke="#167da5" stroke-width="3" stroke-dasharray="8 5"/>
<path d="${path(geometry.frontContours[key].map(mp))}" fill="none" stroke="#c15c42" stroke-width="2"/>`).join('')}
<path d="M55,512h45" stroke="#167da5" stroke-width="3" stroke-dasharray="8 5"/>${text(112,518,'A · trazado aproximado',16)}
<path d="M55,542h45" stroke="#c15c42" stroke-width="2"/>${text(112,548,'Malla Blender · cuerpo y visor',16)}`;
const panels=[['A seleccionada · referencia formal',referenceImage],['A · nueva geometría Blender',modelImage],['Superposición de contornos',overlay]];
const content=panels.map(([title,body],i)=>`<g transform="translate(${i*640},70)"><clipPath id="clip${i}"><rect width="640" height="560"/></clipPath><g clip-path="url(#clip${i})">${body}</g><rect y="0" width="640" height="48" fill="#edf0f2"/>${text(22,32,title,21)}</g>`).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="700"><rect width="1920" height="700" fill="#f5f5f4"/>${text(24,43,'SOFLIA / A — NÚCLEO HORIZONTAL · PRIMERA BASE TRIDIMENSIONAL',26)}${content}${text(24,672,'Alineación por anchura y centro del contorno. Sin deformación de escala. El trazado conceptual es aproximado.',19)}</svg>`;
await sharp(Buffer.from(svg)).png().toFile(folder+'front-comparison-a-v1.png');
const views=[['front','Frente'],['three_quarter_left','Tres cuartos izquierdo'],['three_quarter_right','Tres cuartos derecho'],['side_left','Lateral izquierdo'],['side_right','Lateral derecho'],['back','Posterior · decisión de modelado'],['top','Superior']];
const tiles=[['reference','A seleccionada · referencia formal'],...views];
const composite=[];const size=420;
for (let i=0;i<tiles.length;i++){
  const [name,label]=tiles[i];
  const thumb=name==='reference'?await sharp(source).extract({left:8,top:218,width:667,height:465}).resize(size,size,{fit:'contain',background:'#dedede'}).png().toBuffer():await sharp(folder+name+'.png').resize(size,size).png().toBuffer();
  const x=(i%4)*size,y=70+Math.floor(i/4)*(size+48);
  composite.push({input:thumb,left:x,top:y});
  composite.push({input:Buffer.from(`<svg width="${size}" height="48"><rect width="${size}" height="48" fill="#edf0f2"/>${text(14,31,label,18)}</svg>`),left:x,top:y+size});
}
composite.push({input:Buffer.from(`<svg width="1680" height="70">${text(22,44,'SOFLIA / A · SIETE VISTAS REALES DE LA MISMA MALLA · GRIS NEUTRO',25)}</svg>`),left:0,top:0});
await sharp({create:{width:1680,height:1006,channels:3,background:'#f5f5f4'}}).composite(composite).png().toFile(folder+'turnaround-a-v1.png');
const rd=range(landmarks.display),md=range(geometry.frontContours.display);
const measurements={sourceHash:createHash('sha256').update(source).digest('hex'),method:landmarks.method,
  referenceApproximate:{bodyAspect:(rb.maxX-rb.minX)/(rb.maxY-rb.minY),displayWidthOverBody:(rd.maxX-rd.minX)/(rb.maxX-rb.minX),displayHeightOverBody:(rd.maxY-rd.minY)/(rb.maxY-rb.minY)},
  modelMeasured:{bodyAspect:(mb.maxX-mb.minX)/(mb.maxY-mb.minY),displayWidthOverBody:(md.maxX-md.minX)/(mb.maxX-mb.minX),displayHeightOverBody:(md.maxY-md.minY)/(mb.maxY-mb.minY)},
  alignment:'Anchura uniforme y centro de la caja de contorno; sin estirar ejes por separado.',unobserved:landmarks.unobserved};
await writeFile(root+'build/selected-a-v1/comparison-measurements.json',JSON.stringify(measurements,null,2));
console.log(JSON.stringify(measurements));
