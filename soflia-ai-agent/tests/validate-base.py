"""Verificación geométrica de la base estructural abierta en Blender."""
import bpy
import bmesh
import json
import math
from pathlib import Path
from mathutils.bvhtree import BVHTree

graph=bpy.context.evaluated_depsgraph_get();rows=[]
for obj in bpy.data.objects:
    if obj.type!='MESH':continue
    evaluated=obj.evaluated_get(graph);data=evaluated.to_mesh();bm=bmesh.new();bm.from_mesh(data)
    boundary=sum(not edge.is_manifold for edge in bm.edges);volume=bm.calc_volume(signed=True)
    assert boundary==0,f'{obj.name}: bordes abiertos/no manifold'
    assert volume>0,f'{obj.name}: orientación o volumen incorrectos'
    assert all(math.isfinite(value) for vertex in data.vertices for value in vertex.co),'Coordenadas no finitas'
    row={'name':obj.name,'nonManifold':boundary,'signedVolume':volume,'dimensions':list(obj.dimensions),'euler':len(bm.verts)-len(bm.edges)+len(bm.faces)}
    if obj.name=='SHELL_UPPER':
        bm.normal_update();outer=int(obj['outer_face_count']);angles=[]
        for edge in bm.edges:
            if len(edge.link_faces)==2 and all(face.index<outer for face in edge.link_faces):
                angles.append(math.degrees(edge.link_faces[0].normal.angle(edge.link_faces[1].normal)))
        angles.sort();row['outerNormalP99Degrees']=angles[int(.99*(len(angles)-1))]
        assert row['outerNormalP99Degrees']<12,'La superficie superior conserva cambios bruscos de curvatura'
    if obj.name.startswith('FLOW_BAND_') and obj.type=='MESH':
        count=int(obj['section_count']);cross=int(obj['section_vertices']);widths=[];depths=[]
        for section in range(count):
            start=section*cross
            widths.append((data.vertices[start].co-data.vertices[start+cross//2].co).length)
            depths.append((data.vertices[start+cross//4].co-data.vertices[start+3*cross//4].co).length)
        row['widthRange']=[min(widths),max(widths)];row['thicknessRange']=[min(depths),max(depths)]
        assert max(widths)>4*min(widths) and max(depths)>4*min(depths),'La sección de la banda es rígida o constante'
    rows.append(row)
    bm.free();evaluated.to_mesh_clear()
body=next(row for row in rows if row['name']=='BODY_MAIN')
assert body['dimensions'][1]>1.2,'La profundidad del cuerpo es insuficiente'
assert .6<body['dimensions'][1]/body['dimensions'][0]<.9,'Masa posterior aplanada o excesiva'
bands=['FLOW_BAND_LEFT_SURFACE','FLOW_BAND_RIGHT_SURFACE']
intersections=[]
for index,a in enumerate(bands):
    row=next(row for row in rows if row['name']==a)
    assert row['euler']==2,f'{a}: debe ser una lámina sólida cerrada con extremos, no un toro'
    for b in bands[index+1:]:
        overlaps=BVHTree.FromObject(bpy.data.objects[a],graph).overlap(BVHTree.FromObject(bpy.data.objects[b],graph))
        centers=[bpy.data.objects[a].data.polygons[i].center for i,j in overlaps]
        from mathutils import Vector
        joint=Vector((-.66,-.60,-.64))
        outside=sum((point-joint).length>.24 for point in centers)
        intersections.append({'a':a,'b':b,'trianglePairs':len(overlaps),'outsideAnchoredJoint':outside})
report={'file':bpy.data.filepath,'blender':bpy.app.version_string,'meshes':rows,'bandIntersections':intersections,'bodyDepthRatio':body['dimensions'][1]/body['dimensions'][0],'animated':False}
folder=Path(__file__).resolve().parents[1]/'build';(folder/'geometry-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
assert all(pair['outsideAnchoredJoint']==0 for pair in intersections),f'Cruces fuera de la unión anclada: {intersections}'
print(json.dumps({'meshes':len(rows),'nonManifold':0,'negativeVolumes':0,'bandIntersections':intersections,'bodyDepthRatio':report['bodyDepthRatio']}))
