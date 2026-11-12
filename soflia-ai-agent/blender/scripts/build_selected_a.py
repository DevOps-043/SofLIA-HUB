"""Construir la primera base A elegida; no altera escenas, UI ni animaciones anteriores."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
import bmesh
import json
import logging
from common import ROOT, aim
from selected_a_geometry import create_selected_a, PARAMETERS


VIEWS={'front':(0,-6,0),'three_quarter_left':(-4.2426,-4.2426,0),'three_quarter_right':(4.2426,-4.2426,0),
    'side_left':(-6,0,0),'side_right':(6,0,0),'back':(0,6,0),'top':(0,0,6)}


def material(name,color):
    mat=bpy.data.materials.new(name);mat.use_nodes=True;mat.diffuse_color=(*color,1)
    mat.node_tree.nodes.clear();node=mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    node.inputs['Base Color'].default_value=(*color,1);node.inputs['Roughness'].default_value=.7
    node.inputs['Specular IOR Level'].default_value=.22
    node.inputs['Emission Strength'].default_value=0;node.inputs['Transmission Weight'].default_value=0
    out=mat.node_tree.nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(node.outputs['BSDF'],out.inputs['Surface'])
    return mat


def main():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for old_material in list(bpy.data.materials):
        if old_material.users==0:bpy.data.materials.remove(old_material)
    mats={'body':material('A_arcilla_gris',(.28,.28,.28)),
        'display':material('A_visor_integrado_gris',(.035,.035,.035)),
        'eyes':material('A_ojos_gris_claro',(.73,.73,.73))}
    root,body,eyes=create_selected_a(mats)
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.eevee.taa_render_samples=128
    scene.eevee.use_raytracing=False;scene.render.use_compositing=False
    scene.render.resolution_x=768;scene.render.resolution_y=768;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=False;scene.view_settings.view_transform='AgX';scene.view_settings.exposure=0
    scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.8,.8,.8,1)
    scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.6
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.80))
    floor=bpy.context.object;floor.name='ESTUDIO_SUELO';floor.data.materials.append(material('A_fondo_gris',(.7,.7,.7)))
    bpy.ops.object.camera_add(location=VIEWS['front']);camera=bpy.context.object;camera.name='CAMERA_A'
    camera.data.type='ORTHO';camera.data.ortho_scale=3.2;scene.camera=camera;aim(camera)
    for name,position,power,size in [('KEY',(-3,-4,5),500,5),('FILL',(4,-2,3),250,4),('RIM',(1,4,4),450,4)]:
        bpy.ops.object.light_add(type='AREA',location=position);light=bpy.context.object;light.name=name
        light.data.energy=power;light.data.shape='DISK';light.data.size=size;aim(light)
    folder=ROOT/'previews/selected-a-v1';folder.mkdir(parents=True,exist_ok=True)
    build=ROOT/'build/selected-a-v1';build.mkdir(parents=True,exist_ok=True)
    master=ROOT/'blender/master/soflia_a_nucleo_horizontal_v1.blend';master.parent.mkdir(parents=True,exist_ok=True)
    camera.location=VIEWS['front'];aim(camera)
    for obj in scene.objects:
        obj.select_set(False)
        if obj.type in ('LIGHT','CAMERA') or obj==floor:obj.hide_set(True)
    bpy.context.view_layer.objects.active=body
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active;space.shading.color_type='MATERIAL'
                space.region_3d.view_location=(0,0,0);space.region_3d.view_distance=4.5
                space.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
                space.region_3d.view_perspective='ORTHO'
    bpy.ops.wm.save_as_mainfile(filepath=str(master))
    for name,position in VIEWS.items():
        floor.hide_render=name=='top';camera.location=position;aim(camera)
        scene.render.filepath=str(folder/(name+'.png'));bpy.ops.render.render(write_still=True)
    report={'selection':'A — Núcleo horizontal','blender':bpy.app.version_string,'master':str(master),
        'parameters':PARAMETERS,'views':VIEWS,'meshes':[],'animated':False,'emission':False,'sourceMeshesReused':False}
    for obj in [body,*eyes]:
        obj.data.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(obj.data)
        row={'name':obj.name,'vertices':len(obj.data.vertices),'triangles':len(obj.data.loop_triangles),
            'nonManifoldEdges':sum(not edge.is_manifold for edge in bm.edges),'signedVolume':bm.calc_volume(signed=True),
            'euler':len(bm.verts)-len(bm.edges)+len(bm.faces)}
        bm.free();report['meshes'].append(row)
        assert row['nonManifoldEdges']==0 and row['signedVolume']>0 and row['euler']==2,str(row)
        assert obj.animation_data is None
    report['materialSlots']=[slot.material.name for slot in body.material_slots]
    report['integratedVisor']=len(body.material_slots)==2
    boundary=1+(PARAMETERS['front_rings']+PARAMETERS['grey_rings']-1)*PARAMETERS['outline_segments']
    display=1+(PARAMETERS['front_rings']-1)*PARAMETERS['outline_segments']
    report['frontContours']={label:[[body.data.vertices[start+i].co.x,body.data.vertices[start+i].co.z]
        for i in range(PARAMETERS['outline_segments'])] for label,start in [('body',boundary),('display',display)]}
    (build/'geometry-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps(report))


if __name__=='__main__':
    try:main()
    except Exception:
        logging.exception('Falló la construcción de la propuesta A');sys.exit(1)
