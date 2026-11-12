"""Reconstruir sólo la base. No crear seis clips ni sobrescribir animaciones."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import json
import logging
import shutil
import bpy
from common import ROOT, aim
from create_materials import create_materials
from create_model import create_model
from create_logo import create_logo
from create_rig import create_rig
from render_states import studio


def main():
    (ROOT/'build').mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    materials=create_materials()
    # Transmisión PBR exportable. La transparencia no se simula con alfa global.
    materials['teal'].node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value=.28
    materials['teal'].node_tree.nodes['Principled BSDF'].inputs['IOR'].default_value=1.35
    parts=create_model(materials);create_logo(materials,parts['motion']);create_rig(parts)
    studio();scene=bpy.context.scene;scene.view_settings.exposure=0
    scene.eevee.taa_render_samples=128
    scene.eevee.use_raytracing=True
    scene.camera.data.ortho_scale=2.75
    scene.render.resolution_x=768;scene.render.resolution_y=768
    # Revisión de la base sin bloom: los defectos deben permanecer visibles.
    scene.render.use_compositing=False
    for name,energy in [('KEY',450),('RIM',500),('FILL',180),('FRONT',25)]:bpy.data.objects[name].data.energy=energy
    bpy.data.objects['RIM'].location=(3,4,.5);aim(bpy.data.objects['RIM'])
    folder=ROOT/'previews/reconstruction';folder.mkdir(parents=True,exist_ok=True)
    scene.camera.location=(0,-6,-.093);aim(scene.camera,(0,0,-.093))
    master=ROOT/'blender/master/soflia_agent_reconstructed_base.blend';master.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(master))
    for name,position in [('front',(0,-6,-.093)),
        ('three_quarter_right',(4.2426,-4.2426,-.093)),('three_quarter_left',(-4.2426,-4.2426,-.093)),
        ('side_right',(6,0,-.093)),('side_left',(-6,0,-.093)),
        ('back',(0,6,-.093)),('top',(0,0,6))]:
        scene.camera.location=position;aim(scene.camera,(0,0,-.093));scene.render.filepath=str(folder/(name+'.png'));bpy.ops.render.render(write_still=True)
    shutil.copyfile(folder/'three_quarter_right.png',folder/'three_quarter.png')
    shutil.copyfile(folder/'side_right.png',folder/'side.png')
    scene.camera.location=(0,-6,-.093);aim(scene.camera,(0,0,-.093))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts['root'].children_recursive:
        if obj.type in ('MESH','CURVE'):obj.select_set(True)
    bpy.context.view_layer.objects.active=bpy.data.objects['BODY_MAIN'];bpy.ops.object.convert(target='MESH')
    import bmesh
    for obj in parts['root'].children_recursive:
        if obj.type=='MESH':
            bm=bmesh.new();bm.from_mesh(obj.data)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
            if bm.calc_volume(signed=True)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
            bm.to_mesh(obj.data);bm.free()
    optimized=ROOT/'blender/optimized/soflia_agent_reconstructed_base.blend';optimized.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(optimized))
    parts['root'].select_set(True)
    for obj in parts['root'].children_recursive:obj.select_set(True)
    path=ROOT/'assets/glb/soflia_agent_base.glb'
    path.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_extras=True)
    triangles=0
    for obj in parts['root'].children_recursive:
        if obj.type=='MESH':obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
    (ROOT/'build/reconstructed-base.json').write_text(json.dumps({'triangles':triangles,'bytes':path.stat().st_size,'animated':False,'source':'Contornos explícitos de la referencia; vista posterior inferida','postprocessing':False},indent=2),encoding='utf8')


if __name__=='__main__':
    try:main()
    except Exception:
        logging.exception('Falló la reconstrucción de la base');sys.exit(1)
