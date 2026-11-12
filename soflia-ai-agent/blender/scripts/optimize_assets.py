"""Convertir curvas/modificadores; contar geometría real tras evaluación."""
import bpy


def optimize_assets(root):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in root.children_recursive:
        if obj.type in ('MESH','CURVE'):
            obj.select_set(True)
    bpy.context.view_layer.objects.active=next(o for o in root.children_recursive if o.type=='MESH')
    bpy.ops.object.convert(target='MESH')
    # El maestro conserva toda la resolución. El recurso web reduce zonas rígidas.
    for obj in list(root.children_recursive):
        if obj.type=='MESH' and (obj.name.startswith('LOGO_') or obj.name.startswith('SHELL_')):
            bpy.context.view_layer.objects.active=obj
            modifier=obj.modifiers.new('Reduccion_web','DECIMATE')
            modifier.ratio=.25 if obj.name.startswith('LOGO_') else .5
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Los puntos decorativos estáticos comparten una malla/material en producción.
    points=[obj for obj in root.children_recursive if obj.name.startswith('CONNECTIVITY_') and obj.type=='MESH']
    if points:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in points:obj.select_set(True)
        bpy.context.view_layer.objects.active=points[0]
        bpy.ops.object.join();bpy.context.object.name='CONNECTIVITY_POINTS'
    bpy.ops.object.select_all(action='DESELECT')
    triangles=0
    for obj in root.children_recursive:
        if obj.type=='MESH':
            obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
    return {'triangles':triangles,'meshObjects':sum(o.type=='MESH' for o in root.children_recursive),'materials':len(bpy.data.materials)}
