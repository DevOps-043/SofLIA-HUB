import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const folder=root+'previews/premium-a-v2/';
const views=[['front','Frente'],['three_quarter_left','Tres cuartos izquierdo'],['three_quarter_right','Tres cuartos derecho'],['side_left','Lateral izquierdo'],['side_right','Lateral derecho'],['back','Posterior'],['top','Superior']];
const tiles=[['reference','Referencia de acabado · ilustración'],...views];
const label=(value,width=420,height=48)=>Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#102538"/><text x="16" y="31" font-family="Segoe UI, sans-serif" font-size="18" fill="#d7ebf2">${value}</text></svg>`);
const composite=[];const size=420;
for (let i=0;i<tiles.length;i++){
  const [name,title]=tiles[i];const file=name==='reference'?root+'references/premium-reference.png':folder+name+'.png';
  const thumb=await sharp(file).resize(size,size,{fit:'contain',background:'#071727'}).png().toBuffer();
  const left=i%4*size,top=68+Math.floor(i/4)*(size+48);
  composite.push({input:thumb,left,top},{input:label(title),left,top:top+size});
}
composite.push({input:label('SOFLIA / A · ACABADO MARINO Y TURQUESA · SIETE VISTAS BLENDER SIN RESPLANDOR',1680,68),left:0,top:0});
await sharp({create:{width:1680,height:1004,channels:3,background:'#071727'}}).composite(composite).png().toFile(folder+'turnaround-premium-a-v2.png');
const beforeAfter=[];
for (const [i,[file,title]] of [[root+'previews/selected-a-v1/front.png','A · base gris conservada'],[folder+'front.png','A · acabado actual sin resplandor']].entries()){
  beforeAfter.push({input:await sharp(file).resize(640,640).png().toBuffer(),left:i*640,top:0},{input:label(title,640),left:i*640,top:640});
}
await sharp({create:{width:1280,height:688,channels:3,background:'#071727'}}).composite(beforeAfter).png().toFile(folder+'before-after-premium-a-v2.png');
console.log('Turnaround y comparación A generados.');
