"""Validación independiente del acabado A guardado: forma, identidad y alcance."""
import sys
import json
import math
import hashlib
import zipfile
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri
from mathutils.kdtree import KDTree

ROOT=Path(__file__).resolve().parents[1]
REPORT={'reopened':bpy.data.filepath,'meshes':[],'eyes':[],'protectedFiles':[]}


def crosses(a,b):
    for i in range(3):
        start=a[i];edge=a[(i+1)%3]-start;length=edge.length
        if length<1e-8:continue
        hit=intersect_ray_tri(b[0],b[1],b[2],edge/length,start,True)
        if hit is not None and 1e-6<(hit-start).length<length-1e-6:return True
    return False


body=bpy.data.objects['BODY_MAIN'];eyes=[bpy.data.objects[n] for n in ('EYE_LEFT','EYE_RIGHT')]
assert all(o.animation_data is None for o in bpy.data.objects) and len(bpy.data.actions)==0
assert len([o for o in bpy.data.objects if o.type=='MESH' and not o.name.startswith(('ESTUDIO_','LOGO_','INDICATOR_'))])==3
assert len(body.material_slots)==2 and body.data.uv_layers.get('A_FLOW_UV')
assert bpy.data.images['A_mascaras_de_flujo_2k'].packed_file is not None
assert bpy.data.images['logo-original.png'].packed_file is not None
REPORT['packedTextures']=['A_mascaras_de_flujo_2k','logo-original.png']
view_modes={area.spaces.active.shading.type for screen in bpy.data.screens for area in screen.areas if area.type=='VIEW_3D'}
assert view_modes=={'MATERIAL'}
REPORT['materialPreviewOnOpen']=True
for obj in [body,*eyes]:
    evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh()
    data.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(data)
    verts=[v.co.copy() for v in data.vertices];tris=[tuple(t.vertices) for t in data.loop_triangles]
    assert all(math.isfinite(c) for v in verts for c in v)
    tree=BVHTree.FromPolygons(verts,tris,all_triangles=True);bad=[]
    if obj==body:body_tree=tree
    for i,j in tree.overlap(tree):
        if i>=j or set(tris[i]).intersection(tris[j]):continue
        a=[verts[k] for k in tris[i]];b=[verts[k] for k in tris[j]]
        if crosses(a,b) or crosses(b,a):bad.append([i,j])
    row={'name':obj.name,'evaluatedVertices':len(verts),'controlVertices':len(obj.data.vertices),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),
        'signedVolume':bm.calc_volume(signed=True),'euler':len(bm.verts)-len(bm.edges)+len(bm.faces),'selfIntersections':len(bad)}
    bm.free();evaluated.to_mesh_clear();REPORT['meshes'].append(row)
    assert row['nonManifoldEdges']==0 and row['signedVolume']>0 and row['euler']==2 and not bad,str(row)
for name,position in [('front',(0,-6,0)),('three_quarter_left',(-4.2426,-4.2426,0)),('three_quarter_right',(4.2426,-4.2426,0))]:
    for eye in eyes:
        hidden=0;tested=0
        for index in range(12,88,6):
            point=eye.data.vertices[index].co;direction=point-Vector(position)
            hit=body_tree.ray_cast(Vector(position),direction.normalized(),direction.length-1e-5)
            hidden+=hit[0] is not None;tested+=1
        REPORT['eyes'].append({'view':name,'eye':eye.name,'sampledPoints':tested,'hiddenByBody':hidden})
        assert hidden==0
original=ROOT/'blender/master/soflia_a_nucleo_horizontal_v1.blend'
with zipfile.ZipFile(ROOT/'build/soflia-a-nucleo-horizontal-v1.zip') as archive:
    old_hash=hashlib.sha256(archive.read(original.name)).hexdigest()
assert hashlib.sha256(original.read_bytes()).hexdigest()==old_hash
REPORT['greyBaseUnchanged']=True
with bpy.data.libraries.load(str(original),link=False) as (source,target):target.objects=['BODY_MAIN']
base=target.objects[0]
assert len(body.data.vertices)==len(base.data.vertices)
assert [tuple(p.vertices) for p in body.data.polygons]==[tuple(p.vertices) for p in base.data.polygons]
deltas=[(a.co-b.co).length for a,b in zip(body.data.vertices,base.data.vertices)]
REPORT['maxBodyDisplacement']=max(deltas);assert max(deltas)<=.0051
bpy.data.objects.remove(base,do_unlink=True)
source=json.loads((ROOT/'assets/logos/contours.json').read_text())
points=[p for layer in source['layers'] for polygon in layer['polygons'] for p in polygon]
minx,maxx=min(p[0] for p in points),max(p[0] for p in points)
miny,maxy=min(p[1] for p in points),max(p[1] for p in points)
scale=.135/(maxy-miny);center=(minx+maxx)/2;maximum=0
for layer in source['layers']:
    for index,polygon in enumerate(layer['polygons']):
        obj=bpy.data.objects['LOGO_'+layer['color']+'_'+str(index)]
        kd=KDTree(len(obj.data.vertices))
        for i,v in enumerate(obj.data.vertices):kd.insert((v.co.x,0,v.co.z),i)
        kd.balance()
        for x,y in polygon:
            _,_,distance=kd.find(((x-center)*scale,0,.755-(y-miny)*scale));maximum=max(maximum,distance)
        evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh()
        bm=bmesh.new();bm.from_mesh(data)
        assert all(edge.is_manifold for edge in bm.edges),'El relieve del logo no está cerrado'
        bm.free();evaluated.to_mesh_clear()
assert maximum<2e-6
REPORT['logoMaxProjectedControlPointError']=maximum
REPORT['logoSourceSha256']=hashlib.sha256((ROOT/'references/logo-original.png').read_bytes()).hexdigest()
assert REPORT['logoSourceSha256']=='57b2a9b18b84080c3a22e91c192bfeda0157e0e60c40594f175ea69ec9a547be'
for item in json.loads((ROOT/'build/v5-protected-hashes.json').read_text(encoding='utf-8-sig')):
    unchanged=hashlib.sha256((ROOT/item['path']).read_bytes()).hexdigest().upper()==item['hash']
    REPORT['protectedFiles'].append({'path':item['path'],'unchanged':unchanged});assert unchanged
REPORT['checksPassed']=True
(ROOT/'build/premium-a-v2/reopened-validation.json').write_text(json.dumps(REPORT,indent=2),encoding='utf8')
print(json.dumps(REPORT))
