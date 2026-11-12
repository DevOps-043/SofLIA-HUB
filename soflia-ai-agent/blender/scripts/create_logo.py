"""Malla del contorno original, curvada sobre la carcasa sin cambiar su topología."""
import json
import math
import bpy
from common import ROOT, empty, mesh


def create_logo(materials, parent):
    source=json.loads((ROOT/'assets/logos/contours.json').read_text())
    group=empty('LOGO_SOFLIA',parent)
    for layer in source['layers']:
        for i,polygon in enumerate(layer['polygons']):
            vertices=[((x/source['width']-.5)*.34,0,.88-y/source['height']*.51) for x,y in polygon]
            obj=mesh('LOGO_'+layer['color']+'_'+str(i),vertices,[tuple(range(len(vertices)))],materials['logo_'+layer['color']],group)
            # Triangular antes de curvar evita triangulación inestable de polígonos no planos.
            bpy.context.view_layer.objects.active=obj
            tri=obj.modifiers.new('Triangulacion_fiel','TRIANGULATE')
            bpy.ops.object.modifier_apply(modifier=tri.name)
            # Subdividir sólo triángulos largos antes de proyectar sobre la curva.
            import bmesh
            bm=bmesh.new();bm.from_mesh(obj.data)
            for _ in range(7):
                long=[edge for edge in bm.edges if edge.calc_length()>.035]
                if not long:break
                bmesh.ops.subdivide_edges(bm,edges=long,cuts=1,use_grid_fill=True)
                bmesh.ops.triangulate(bm,faces=list(bm.faces))
            bm.to_mesh(obj.data);bm.free()
            from mathutils.bvhtree import BVHTree
            from mathutils import Vector
            bpy.context.view_layer.update()
            surface=BVHTree.FromObject(bpy.data.objects['SHELL_UPPER'],bpy.context.evaluated_depsgraph_get())
            for vertex in obj.data.vertices:
                x,_,z=vertex.co
                hit,_,_,_=surface.ray_cast(Vector((x,-3,z)),Vector((0,1,0)),6)
                if hit is None:raise ValueError('Un punto del logotipo cae fuera de la capucha')
                vertex.co.y=hit.y-.007
            solid=obj.modifiers.new('Relieve_logo','SOLIDIFY');solid.thickness=.006
    group['fuente']='references/logo-original.png; assets/logos/soflia-original.svg'
    return group
