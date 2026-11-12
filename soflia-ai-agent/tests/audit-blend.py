"""Auditoría medible de la escena abierta, sin modificarla."""
import bpy
import bmesh
import json
from pathlib import Path
report={'file':bpy.data.filepath,'meshes':[],'materials':[],'images':[image.name for image in bpy.data.images],'animations':[]}
for obj in bpy.data.objects:
    if obj.type=='MESH':
        data=obj.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
        bm=bmesh.new();bm.from_mesh(data)
        report['meshes'].append({'name':obj.name,'vertices':len(data.vertices),'triangles':sum(len(p.vertices)-2 for p in data.polygons),'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'signedVolume':bm.calc_volume(signed=True),'smoothFaces':sum(p.use_smooth for p in data.polygons),'dimensions':list(obj.dimensions),'modifiers':[m.type for m in obj.modifiers]})
        bm.free()
    if obj.animation_data:report['animations'].append({'object':obj.name,'tracks':[track.name for track in obj.animation_data.nla_tracks]})
for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    node=mat.node_tree.nodes.get('Principled BSDF')
    if node:report['materials'].append({'name':mat.name,'color':list(node.inputs['Base Color'].default_value),'metallic':node.inputs['Metallic'].default_value,'roughness':node.inputs['Roughness'].default_value,'emission':node.inputs['Emission Strength'].default_value,'transmission':node.inputs['Transmission Weight'].default_value})
name='audit-base.json' if 'reconstructed' in bpy.data.filepath else 'audit-v2.json'
out=Path(__file__).resolve().parents[1]/'build'/name;out.write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({'file':str(out),'meshes':len(report['meshes']),'images':report['images'],'nonManifold':[m['name'] for m in report['meshes'] if m['nonManifoldEdges']],'negativeVolume':[m['name'] for m in report['meshes'] if m['signedVolume']<0]}))
