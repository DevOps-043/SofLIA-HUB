import geometry from '../../../resources/audiovisual/soflia-logo-geometry.json';
export const sofliaGeometry=geometry;
export const ecosystemPoints=[[1050,320],[1670,400],[350,560],[960,510],[1560,700],[960,785],[390,875],[1260,920]];
export function brandPoint(index:number){const node=geometry.nodes[index],scale=250/961;return[960+(node.x-424.5)*scale,425+(node.y-607.5)*scale];}
