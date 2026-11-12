"""Rutas ópticas independientes: ojos, abertura facial y tapas de las láminas."""
import bpy
import json
import math
from pathlib import Path
from collections import Counter
from mathutils import Vector
from mathutils.bvhtree import BVHTree

graph=bpy.context.evaluated_depsgraph_get();trees={}
for obj in bpy.data.objects:
    if obj.type!='MESH':continue
    evaluated=obj.evaluated_get(graph);data=evaluated.to_mesh()
    vertices=[obj.matrix_world@vertex.co for vertex in data.vertices]
    trees[obj.name]=BVHTree.FromPolygons(vertices,[tuple(face.vertices) for face in data.polygons])
    evaluated.to_mesh_clear()


def blocker(camera,target,exclude=()):
    direction=target-camera;distance=direction.length;direction.normalize();hits=[]
    for name,tree in trees.items():
        if name in exclude:continue
        hit,normal,index,length=tree.ray_cast(camera,direction,distance-.002)
        if hit is not None:hits.append((length,name))
    return min(hits)[1] if hits else None


views={'front':(0,-6,-.093),'three_quarter_left':(-4.2426,-4.2426,-.093),'three_quarter_right':(4.2426,-4.2426,-.093),
    'side_left':(-6,0,-.093),'side_right':(6,0,-.093),'back':(0,6,-.093),'top':(0,0,6)}
eyes={};aperture={}
for name in ('front','three_quarter_left','three_quarter_right'):
    camera=Vector(views[name]);eyes[name]={}
    for eye in ('EYE_LEFT_LENS','EYE_RIGHT_LENS'):
        obj=bpy.data.objects[eye];occluders=[]
        for i in range(4,45,5):
            point=obj.matrix_world@((obj.data.vertices[2*i].co+obj.data.vertices[2*i+1].co)*.5)
            # Evaluar la primera superficie óptica de la lente, no su cara
            # posterior ni un punto que quede dentro del espesor del objeto.
            own_hit,_,_,_=trees[eye].ray_cast(camera,(point-camera).normalized())
            if own_hit is not None:point=own_hit
            occluders.append(blocker(camera,point,(eye,)))
        eyes[name][eye]={'samples':len(occluders),'visible':occluders.count(None),'occluders':dict(Counter(value for value in occluders if value))}
    face=bpy.data.objects['FACE_DISPLAY'];occluders=[]
    excluded=['FACE_DISPLAY','EYE_LEFT_LENS','EYE_RIGHT_LENS']
    for ring in range(2,9):
        for step in range(0,112,14):
            point=face.matrix_world@face.data.vertices[1+(ring-1)*112+step].co
            occluders.append(blocker(camera,point,excluded))
    aperture[name]={'samples':len(occluders),'visible':occluders.count(None),'occluders':dict(Counter(value for value in occluders if value))}

endpoints={}
for name in ('FLOW_BAND_LEFT_SURFACE','FLOW_BAND_RIGHT_SURFACE'):
    obj=bpy.data.objects[name];endpoints[name]={}
    for endpoint in (-2,-1):
        target=obj.matrix_world@obj.data.vertices[endpoint].co
        section=0 if endpoint==-2 else int(obj['section_count'])-1;cross=int(obj['section_vertices'])
        rim=[obj.matrix_world@obj.data.vertices[section*cross+i].co for i in range(cross)]
        endpoints[name][str(endpoint)]={view:{'centerOccluder':blocker(Vector(camera),target,(name,)),
            'visibleRimPoints':sum(blocker(Vector(camera),point,(name,)) is None for point in rim)} for view,camera in views.items()}

report={'eyes':eyes,'aperture':aperture,'endpointOccluders':endpoints}
out=Path(__file__).resolve().parents[1]/'build/visibility-validation.json';out.write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
for view,values in eyes.items():
    for eye,data in values.items():
        assert data['visible']/data['samples']>=.77,f'Ojo oculto en {view}: {eye}, {data}'
        assert not any(name.startswith('FLOW_BAND') for name in data['occluders']),f'Una banda oculta el ojo en {view}'
for band,values in endpoints.items():
    for endpoint,cameras in values.items():assert all(value['centerOccluder'] and value['visibleRimPoints']==0 for value in cameras.values()),f'Tapa expuesta de {band}: {cameras}'
for view,data in aperture.items():assert data['visible']/data['samples']>=.65,f'Visor reducido en {view}: {data}'
