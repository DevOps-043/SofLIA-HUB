"""Verificar la base A guardada sin depender del estado del generador."""
import hashlib
import json
import math
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri

ROOT=Path(__file__).resolve().parents[1]


def crosses(a,b):
    for i in range(3):
        start=a[i];edge=a[(i+1)%3]-start;length=edge.length
        if length<1e-8:continue
        hit=intersect_ray_tri(b[0],b[1],b[2],edge/length,start,True)
        if hit is not None and 1e-6<(hit-start).length<length-1e-6:return True
    return False


report={'reopened':bpy.data.filepath,'meshes':[],'eyeVisibility':[],'protectedFiles':[]}
body=bpy.data.objects['BODY_MAIN']
character=[body,bpy.data.objects['EYE_LEFT'],bpy.data.objects['EYE_RIGHT']]
assert len([o for o in bpy.data.objects if o.type=='MESH' and o.name!='ESTUDIO_SUELO'])==3
assert body.parent.name=='SOFLIA_A_ROOT'
assert len(body.material_slots)==2
assert set(p.material_index for p in body.data.polygons)=={0,1}
assert all(o.animation_data is None for o in bpy.data.objects)
assert len(bpy.data.actions)==0
assert abs(body.dimensions.x/ body.dimensions.z-2.4/1.56)<.01
for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    for node in mat.node_tree.nodes:
        assert node.type!='EMISSION'
        if node.type=='BSDF_PRINCIPLED':
            assert node.inputs['Emission Strength'].default_value==0
            assert node.inputs['Transmission Weight'].default_value==0
for obj in character:
    data=obj.data;data.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(data)
    verts=[v.co.copy() for v in data.vertices];tris=[tuple(t.vertices) for t in data.loop_triangles]
    assert all(math.isfinite(value) for v in verts for value in v)
    tree=BVHTree.FromPolygons(verts,tris,all_triangles=True);bad=[];checked=0
    for i,j in tree.overlap(tree):
        if i>=j or set(tris[i]).intersection(tris[j]):continue
        checked+=1;a=[verts[k] for k in tris[i]];b=[verts[k] for k in tris[j]]
        if crosses(a,b) or crosses(b,a):bad.append([i,j])
    row={'name':obj.name,'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),
        'signedVolume':bm.calc_volume(signed=True),'euler':len(bm.verts)-len(bm.edges)+len(bm.faces),
        'selfIntersections':len(bad),'candidatePairsChecked':checked,'dimensions':list(obj.dimensions)}
    bm.free();report['meshes'].append(row)
    assert row['nonManifoldEdges']==0 and row['signedVolume']>0 and row['euler']==2
    assert not bad,str(bad[:5])
body_tree=BVHTree.FromPolygons([v.co.copy() for v in body.data.vertices],
    [tuple(t.vertices) for t in body.data.loop_triangles],all_triangles=True)
for label,origin in [('front',(0,-6,0)),('three_quarter_left',(-4.2426,-4.2426,0)),('three_quarter_right',(4.2426,-4.2426,0))]:
    for eye in character[1:]:
        tested=0;hidden=0
        for index in range(12,88,6):
            point=eye.data.vertices[index].co;ray=point-Vector(origin);distance=ray.length
            hit=body_tree.ray_cast(Vector(origin),ray.normalized(),distance-1e-5)
            tested+=1;hidden+=hit[0] is not None
        report['eyeVisibility'].append({'view':label,'eye':eye.name,'sampledPoints':tested,'occludedByBody':hidden})
        assert hidden==0,f'{label}: {eye.name} oculto por el cuerpo'
for item in json.loads((ROOT/'build/v5-protected-hashes.json').read_text(encoding='utf-8-sig')):
    path=ROOT/item['path'];actual=hashlib.sha256(path.read_bytes()).hexdigest().upper()
    report['protectedFiles'].append({'path':item['path'],'unchanged':actual==item['hash']})
assert all(item['unchanged'] for item in report['protectedFiles'])
report['checksPassed']=True
(ROOT/'build/selected-a-v1/reopened-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
