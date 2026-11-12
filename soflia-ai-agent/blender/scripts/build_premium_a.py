"""Presentación estática premium de A y turnaround sin resplandor de posproducción."""
import sys
import json
import logging
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from common import ROOT, aim
from selected_a_geometry import create_selected_a
from build_selected_a import VIEWS
from premium_a_finish import make_materials, apply_flows, add_original_logo, principled, refine_eyes, add_indicators


def configure_compositor(scene):
    group=bpy.data.node_groups.new('A_resplandor_sutil','CompositorNodeTree')
    group.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    layers=group.nodes.new('CompositorNodeRLayers');glare=group.nodes.new('CompositorNodeGlare')
    glare.inputs['Type'].default_value='Fog Glow';glare.inputs['Quality'].default_value='High'
    glare.inputs['Threshold'].default_value=1.0;glare.inputs['Strength'].default_value=.30
    glare.inputs['Size'].default_value=.25
    out=group.nodes.new('NodeGroupOutput');group.links.new(layers.outputs['Image'],glare.inputs['Image'])
    group.links.new(glare.outputs['Image'],out.inputs['Image']);scene.compositing_node_group=group


def main():
    quick='--quick' in sys.argv;volume='--volume' in sys.argv
    if volume:
        from volumetric_a_flows import SETTINGS
        settings=SETTINGS
    else:settings=None
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for mat in list(bpy.data.materials):
        if mat.users==0:bpy.data.materials.remove(mat)
    mats=make_materials(settings);root,body,eyes=create_selected_a(mats)
    # La malla A preservada no se modifica: esta escena reconstruye su base y añade acabado.
    flow_report=apply_flows(body,settings)
    smooth=body.modifiers.new('Continuidad_de_superficie','SUBSURF');smooth.levels=1;smooth.render_levels=1
    refine_eyes(eyes);logo,logo_report=add_original_logo(body,mats,root)
    add_indicators(body,mats['eyes'],root)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU'
    scene.cycles.samples=32 if quick else 96;scene.cycles.use_denoising=True
    scene.cycles.max_bounces=8;scene.cycles.glossy_bounces=4;scene.cycles.transmission_bounces=4
    if quick and '--fast' in sys.argv:
        scene.render.engine='BLENDER_EEVEE';scene.eevee.taa_render_samples=64;scene.eevee.use_raytracing=True
    scene.render.use_compositing=False
    scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=False
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=0
    scene.world.use_nodes=True
    background=scene.world.node_tree.nodes.get('Background');background.inputs[0].default_value=(.025,.055,.11,1)
    background.inputs[1].default_value=.32
    floor_material,_,_=principled('ESTUDIO_marino',(.008,.019,.038),.15,.38,.1)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-1.03))
    floor=bpy.context.object;floor.name='ESTUDIO_SUELO';floor.data.materials.append(floor_material)
    halo_material,_,_=principled('ESTUDIO_halo_cian',(.001,.45,.55),.1,.3,.1,2.2)
    bpy.ops.mesh.primitive_torus_add(major_radius=.94,minor_radius=.003,major_segments=192,minor_segments=8,location=(0,0,-1.017))
    halo=bpy.context.object;halo.name='ESTUDIO_HALO';halo.scale.y=.76;halo.data.materials.append(halo_material)
    halo.hide_render=True
    bpy.ops.object.camera_add(location=VIEWS['front']);camera=bpy.context.object;camera.name='CAMERA_A_PREMIUM'
    camera.data.type='ORTHO';camera.data.ortho_scale=3.2;scene.camera=camera;aim(camera)
    lighting=[('KEY',(-3,-4,4),400,1.8,(.72,.84,1)),('FILL',(3,-4,1),120,3,(.35,.8,1)),
        ('RIM_LEFT',(-3,1,2),450,2.8,(.14,.55,1)),('RIM_RIGHT',(4,2,3),700,3,(.05,.95,1)),
        ('TOP',(0,1,5),150,3,(.65,.85,1))]
    for name,position,power,size,color in lighting:
        bpy.ops.object.light_add(type='AREA',location=position);light=bpy.context.object;light.name='ESTUDIO_'+name
        light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.data.color=color;aim(light)
    version='volumetric-a-v3' if volume else 'premium-a-v2'
    folder=ROOT/'previews'/version;folder.mkdir(parents=True,exist_ok=True)
    build=ROOT/'build'/version;build.mkdir(parents=True,exist_ok=True)
    for obj in scene.objects:
        obj.select_set(False)
        if (obj.name.startswith('ESTUDIO_') and obj.type!='LIGHT') or obj.type=='CAMERA':obj.hide_set(True)
    bpy.context.view_layer.objects.active=body
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active;space.shading.color_type='MATERIAL';space.shading.type='MATERIAL'
                space.shading.use_scene_lights=True;space.shading.use_scene_world=True
                space.overlay.show_extras=False;space.overlay.show_floor=False
                space.region_3d.view_location=(0,0,0);space.region_3d.view_distance=4.5
                space.region_3d.view_rotation=camera.rotation_euler.to_quaternion();space.region_3d.view_perspective='ORTHO'
    size=768 if quick else 1024;scene.render.resolution_x=size;scene.render.resolution_y=size
    draft_name='back' if '--back' in sys.argv else ('three_quarter_right' if '--quarter' in sys.argv else 'front')
    draft_views=[(name,VIEWS[name]) for name in ('front','three_quarter_right','side_left','side_right','back')] if '--draft-set' in sys.argv else [(draft_name,VIEWS[draft_name])]
    for name,position in (draft_views if quick else VIEWS.items()):
        floor.hide_render=name=='top';camera.location=position;aim(camera)
        scene.render.filepath=str(folder/(name+'.png'));bpy.ops.render.render(write_still=True)
    if quick and '--no-hero' in sys.argv:return
    floor.hide_render=False;halo.hide_render=False;camera.location=(1.15,-7,1.5)
    camera.data.ortho_scale=2.65;aim(camera,(0,0,-.10))
    scene.render.resolution_x=1024 if quick else 1536;scene.render.resolution_y=768 if quick else 1152
    configure_compositor(scene);scene.render.use_compositing=True
    scene.render.filepath=str(folder/('hero-draft.png' if quick else ('hero-a-volumetric-v3.png' if volume else 'hero-a-premium-v2.png')))
    if not quick:
        master=ROOT/'blender/master'/('soflia_a_volumetric_v3.blend' if volume else 'soflia_a_premium_v2.blend')
        bpy.ops.wm.save_as_mainfile(filepath=str(master),compress=True)
    bpy.ops.render.render(write_still=True)
    report={'base':'A — Núcleo horizontal','phase':'Acabado premium estático','quick':quick,
        'bodyControlVertices':len(body.data.vertices),'bodyControlPolygons':len(body.data.polygons),
        'subdivisionLevels':1,'flows':flow_report,
        'logo':logo_report,'views':VIEWS,'lighting':lighting,'turnaroundGlow':False,'heroGlareStrength':.30,
        'engine':scene.render.engine,'samples':scene.cycles.samples,'version':version,
        'animated':False,'bodyComponents':1,'separateBands':0,'originalGreyBasePreserved':True}
    (build/'finish-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print('Acabado A generado; logo original verificado; modo rápido:',quick)


if __name__=='__main__':
    try:main()
    except Exception:
        logging.exception('Falló la presentación premium de A');sys.exit(1)
