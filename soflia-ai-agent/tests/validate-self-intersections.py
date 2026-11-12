"""Descartar penetraciones propias con pruebas de arista contra triángulo."""
import bpy
import json
from pathlib import Path
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri


def crosses(a,b):
    for i in range(3):
        start=a[i];edge=a[(i+1)%3]-start;length=edge.length
        if length<1e-8:continue
        hit=intersect_ray_tri(b[0],b[1],b[2],edge/length,start,True)
        if hit is not None and 1e-6<(hit-start).length<length-1e-6:return True
    return False


report=[]
for name in ('SHELL_UPPER','FLOW_BAND_LEFT_SURFACE','FLOW_BAND_RIGHT_SURFACE'):
    data=bpy.data.objects[name].data;data.calc_loop_triangles()
    vertices=[vertex.co.copy() for vertex in data.vertices]
    triangles=[tuple(triangle.vertices) for triangle in data.loop_triangles]
    tree=BVHTree.FromPolygons(vertices,triangles,all_triangles=True);bad=[];checked=0
    for i,j in tree.overlap(tree):
        if i>=j or set(triangles[i]).intersection(triangles[j]):continue
        checked+=1;a=[vertices[k] for k in triangles[i]];b=[vertices[k] for k in triangles[j]]
        if crosses(a,b) or crosses(b,a):bad.append((i,j))
    report.append({'name':name,'candidatePairsChecked':checked,'selfIntersections':len(bad),'firstPairs':bad[:10]})
out=Path(__file__).resolve().parents[1]/'build/self-intersection-validation.json';out.write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
assert all(row['selfIntersections']==0 for row in report),'Quedan penetraciones propias en la carcasa o las bandas'
