"""Estudio Eevee transparente y renders de los estados a 512 px."""
import math
import bpy
from common import ROOT, FPS, STATES, aim, set_state


def studio():
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.eevee.taa_render_samples=64
    scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=True;scene.render.fps=FPS
    scene.view_settings.view_transform='AgX'
    scene.view_settings.exposure=-.65
    scene.world.color=(.12,.12,.12)
    bpy.ops.object.camera_add(location=(0,-5.5,.42))
    camera=bpy.context.object;camera.name='CAMERA_FRONT';camera.data.type='ORTHO';camera.data.ortho_scale=3.18
    aim(camera,(0,0,.02));scene.camera=camera
    for name,pos,power,size,color in [
        ('KEY',(-3,-4,5),550,4,(.38,.58,1)),
        ('RIM',(3,1,3),1100,3,(.0,.8,1)),
        ('FILL',(-3,1,0),500,3,(.10,.3,1)),
        ('FRONT',(0,-4,0),40,3,(.10,.5,.8))]:
        bpy.ops.object.light_add(type='AREA',location=pos)
        lamp=bpy.context.object;lamp.name=name;lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size;lamp.data.color=color;aim(lamp)
    # Resplandor de render; no se espera que este compositor exista en glTF.
    scene.use_nodes=True
    tree=scene.compositing_node_group
    if tree is None:
        tree=bpy.data.node_groups.new('Composicion_SofLIA','CompositorNodeTree')
        scene.compositing_node_group=tree
        tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    tree.nodes.clear()
    source=tree.nodes.new('CompositorNodeRLayers')
    glare=tree.nodes.new('CompositorNodeGlare')
    if hasattr(glare,'glare_type'):
        glare.glare_type='FOG_GLOW';glare.quality='MEDIUM'
    else:
        glare.inputs['Type'].default_value='Fog Glow';glare.inputs['Quality'].default_value='Medium'
        glare.inputs['Size'].default_value=.08;glare.inputs['Strength'].default_value=.6;glare.inputs['Threshold'].default_value=1.5
    output=tree.nodes.new('NodeGroupOutput')
    tree.links.new(source.outputs['Image'],glare.inputs['Image'])
    # El bloom necesita alfa propio para conservar el halo al componer el PNG.
    luminance=tree.nodes.new('CompositorNodeRGBToBW')
    tree.links.new(glare.outputs['Glare'],luminance.inputs[0])
    alpha=tree.nodes.new('ShaderNodeMath');alpha.operation='MAXIMUM'
    tree.links.new(source.outputs['Alpha'],alpha.inputs[0]);tree.links.new(luminance.outputs[0],alpha.inputs[1])
    setalpha=tree.nodes.new('CompositorNodeSetAlpha')
    if 'Type' in setalpha.inputs:setalpha.inputs['Type'].default_value='Replace Alpha'
    tree.links.new(glare.outputs['Image'],setalpha.inputs['Image']);tree.links.new(alpha.outputs[0],setalpha.inputs['Alpha'])
    tree.links.new(setalpha.outputs['Image'],output.inputs['Image'])


def stills():
    scene=bpy.context.scene;camera=scene.camera
    path=ROOT/'previews';path.mkdir(parents=True,exist_ok=True)
    set_state('idle');scene.frame_set(1)
    for name,location in [('avatar_front',(0,-5.5,.42)),('avatar_three_quarter',(3,-5,.7)),('avatar_side',(5.5,0,.5))]:
        camera.location=location;aim(camera,(0,0,.02));scene.render.filepath=str(path/(name+'.png'));bpy.ops.render.render(write_still=True)
    camera.location=(0,-5.5,.42);aim(camera,(0,0,.02))
    for state in STATES:
        set_state(state);scene.frame_set(1+int(STATES[state]*FPS*.3))
        scene.render.filepath=str(path/('state_'+state+'.png'));bpy.ops.render.render(write_still=True)


def render_states(selected=None):
    scene=bpy.context.scene
    for state,duration in STATES.items():
        if selected and state not in selected:continue
        set_state(state)
        folder=ROOT/'animations/frames'/state;folder.mkdir(parents=True,exist_ok=True)
        # No duplicar el último fotograma igual al primero en los bucles.
        for frame in range(1,duration*FPS+1):
            target=folder/f'{frame:04d}.png'
            scene.frame_set(frame);scene.render.filepath=str(target);bpy.ops.render.render(write_still=True)
