"""Acabados físicos y flujos integrados para la base A, sin piezas orbitales."""
import math
import json
import hashlib
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from common import ROOT, empty
from selected_a_geometry import section
from selected_a_geometry import surface_y

FLOW=[(-1.85,-.15,.14),(-1.35,-.32,.16),(-.7,-.48,.22),(0,-.52,.25),
      (.65,-.43,.26),(1.15,-.20,.29),(1.6,.09,.24),(2.05,.25,.18),(2.5,.32,.14),(2.9,.30,.14)]
NAVY_FLOW=[(-3.10,-.25,.16),(-2.6,-.12,.20),(-2.1,.12,.20),(-1.65,.30,.16),(-1.4,.33,.14)]


def smoothstep(a,b,value):
    t=max(0,min(1,(value-a)/(b-a)));return t*t*(3-2*t)


def profile(points,a):
    if not points[0][0]<a<points[-1][0]:return None
    for i in range(len(points)-1):
        if a<=points[i+1][0]:
            p0=points[max(0,i-1)];p1=points[i];p2=points[i+1];p3=points[min(len(points)-1,i+2)]
            u=(a-p1[0])/(p2[0]-p1[0])
            values=[]
            for k in (1,2):
                m1=(p2[k]-p0[k])/(p2[0]-p0[0])*(p2[0]-p1[0])
                m2=(p3[k]-p1[k])/(p3[0]-p1[0])*(p2[0]-p1[0])
                values.append((2*u**3-3*u*u+1)*p1[k]+(u**3-2*u*u+u)*m1+(-2*u**3+3*u*u)*p2[k]+(u**3-u*u)*m2)
            return values


def flow_values(position,points,volumetric=False):
    x,y,z=position;_,rx,cx,cy,_,_=section(z)
    q=max(-1,min(1,(x-cx)/max(rx,1e-6)));a=math.asin(q)
    if y>cy:a=math.pi-a if a>=0 else -math.pi-a
    p=profile(points,a)
    if p is None:return 0.,0.,0.
    center,width=p;width=max(.005,width)
    d=(z-center)/(.5*width)
    # Campo de distancia con capuchones elípticos: termina redondo, sin cuña ni corte recto.
    cap=.14;end_distance=max(points[0][0]+cap-a,a-(points[-1][0]-cap),0)/cap
    distance=math.sqrt(d*d+end_distance*end_distance)
    mask=1-smoothstep(.80,1,distance)
    edge=math.exp(-((distance-.90)/.06)**2)*smoothstep(-.15,.2,d)
    relief=math.cos(distance*math.pi*.5)**2 if volumetric and distance<1 else (0 if volumetric else mask*mask)
    return mask,edge,relief


def apply_flows(body,settings=None):
    settings=settings or {};teal_points=settings.get('teal',FLOW);navy_points=settings.get('navy',NAVY_FLOW)
    volumetric=settings.get('volumetric',False);heights=settings.get('heights',(.003,.002))
    data=body.data;data.update()
    attrs=[data.attributes.new(name=n,type='FLOAT',domain='POINT') for n in ('A_TEAL_FLOW','A_FLOW_EDGE','A_NAVY_FLOW')]
    face_vertices=set()
    for face in data.polygons:
        if face.material_index==1:face_vertices.update(face.vertices)
    original_positions=[v.co.copy() for v in data.vertices]
    normals=[v.normal.copy() for v in data.vertices];maximum=0
    for v in data.vertices:
        teal,edge,r=flow_values(v.co,teal_points,volumetric);navy,_,nr=flow_values(v.co,navy_points,volumetric)
        if v.index in face_vertices:teal=edge=r=navy=nr=0
        attrs[0].data[v.index].value=teal;attrs[1].data[v.index].value=edge;attrs[2].data[v.index].value=navy
        if volumetric:
            x,y,z=v.co;_,_,_,cy,_,_=section(z)
            face_radius=((abs((x-.045)/.96))**2.2+(abs((z-.14)/.48))**2.2)**(1/2.2)
            clearance=smoothstep(1.02,1.16,face_radius) if y<cy else 1
            offset=((heights[0]*r)**4+(heights[1]*nr)**4)**.25*clearance
            direction=normals[v.index].copy()
            scale=settings['contourScale']*(1-smoothstep(.68,.78,abs(z)))
            direction.x*=scale;direction.z*=scale
        else:
            offset=heights[0]*r+heights[1]*nr;direction=normals[v.index]
        maximum=max(maximum,offset);v.co+=direction*offset
    data.update();body['acabado']='Flujos de material y relieve integrados en la misma malla; sin bandas independientes'
    # UV angular y longitudinal: las máscaras de píxel evitan bordes festoneados
    # que aparecen al interpolar una banda estrecha entre vértices de un loft.
    uv=data.uv_layers.new(name='A_FLOW_UV')
    for polygon in data.polygons:
        coords=[]
        for index in polygon.vertices:
            x,y,z=original_positions[index];_,rx,cx,cy,_,_=section(z)
            a=math.asin(max(-1,min(1,(x-cx)/max(rx,1e-6))))
            if y>cy:a=math.pi-a if a>=0 else -math.pi-a
            coords.append(((a+math.pi)/(2*math.pi),(z+.8)/1.6))
        seam=max(p[0] for p in coords)-min(p[0] for p in coords)>.5
        for loop,coord in zip(polygon.loop_indices,coords):
            u,v=coord;uv.data[loop].uv=(u+1 if seam and u<.5 else u,v)
    return {'maxRelief':maximum,'flowControlPoints':teal_points,'navyControlPoints':navy_points,
        'bodyTopologyUnchanged':True,'volumetric':volumetric,'section':'coseno cuadrado' if volumetric else 'microrelieve'}


def mask_texture(settings=None):
    settings=settings or {};teal_points=settings.get('teal',FLOW);navy_points=settings.get('navy',NAVY_FLOW)
    import numpy as np
    width,height=2048,1024
    pixels=np.zeros((height,width,4),dtype=np.float32);pixels[:,:,3]=1
    zs=np.linspace(-.8,.8,height)[:,None]
    for column,a in enumerate(np.linspace(-math.pi,math.pi,width)):
        for points,channel in [(teal_points,0),(navy_points,2)]:
            p=profile(points,a)
            if p is None:continue
            center,span=p;d=(zs[:,0]-center)/max(.0025,.5*span)
            cap=.14;end_distance=max(points[0][0]+cap-a,a-(points[-1][0]-cap),0)/cap
            distance=np.sqrt(d*d+end_distance*end_distance)
            t=np.clip((distance-.80)/.20,0,1)
            pixels[:,column,channel]=1-t*t*(3-2*t)
            if channel==0:
                upper=np.clip((d+.15)/.35,0,1)
                pixels[:,column,1]=np.exp(-((distance-.90)/.06)**2)*upper*upper*(3-2*upper)
    image=bpy.data.images.new('A_mascaras_de_flujo_2k',width=width,height=height,alpha=True,float_buffer=False)
    image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(pixels.ravel());image.pack()
    return image


def refine_eyes(eyes):
    for eye,center in zip(eyes,(-.36,.44)):
        for v in eye.data.vertices:
            layer=v.index//98;step=(v.index%98)//2;t=step/48
            x=center+(t-.5)*.44
            z=.145+(.065*math.sin(math.pi*t)**.9-.006 if v.index%2==0 else .13*math.sin(math.pi*t)**.75)
            v.co=(x,surface_y(x,z)-.008+layer*.004,z)
        eye.data.update()


def principled(name,color,metallic=0,roughness=.3,coat=.25,emission=0,transmission=0):
    mat=bpy.data.materials.new(name);mat.use_nodes=True;mat.diffuse_color=(*color,1)
    mat.node_tree.nodes.clear();p=mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metallic
    p.inputs['Roughness'].default_value=roughness;p.inputs['Coat Weight'].default_value=coat
    p.inputs['Coat Roughness'].default_value=.18;p.inputs['Emission Color'].default_value=(*color,1)
    p.inputs['Emission Strength'].default_value=emission;p.inputs['Transmission Weight'].default_value=transmission
    out=mat.node_tree.nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(p.outputs['BSDF'],out.inputs['Surface'])
    return mat,p,out


def make_materials(settings=None):
    body,p,out=principled('A_marino_satinado',(.008,.023,.061),.40,.34,.24)
    nodes=body.node_tree.nodes;links=body.node_tree.links
    # Los tres acabados pertenecen al mismo sólido, con máscaras interpoladas.
    texture=nodes.new('ShaderNodeTexImage');texture.image=mask_texture(settings);texture.interpolation='Linear'
    uv=nodes.new('ShaderNodeUVMap');uv.uv_map='A_FLOW_UV';links.new(uv.outputs['UV'],texture.inputs['Vector'])
    separate=nodes.new('ShaderNodeSeparateColor');links.new(texture.outputs['Color'],separate.inputs['Color'])
    blue=nodes.new('ShaderNodeBsdfPrincipled');blue.inputs['Base Color'].default_value=(.011,.030,.075,1)
    blue.inputs['Metallic'].default_value=.40;blue.inputs['Roughness'].default_value=.36;blue.inputs['Coat Weight'].default_value=.20
    if settings:blue.inputs['Base Color'].default_value=(.013,.045,.10,1)
    blue.inputs['Emission Strength'].default_value=0
    blue_mix=nodes.new('ShaderNodeMixShader');links.new(separate.outputs['Blue'],blue_mix.inputs[0])
    links.new(p.outputs['BSDF'],blue_mix.inputs[1]);links.new(blue.outputs['BSDF'],blue_mix.inputs[2])
    teal=nodes.new('ShaderNodeBsdfPrincipled');teal.inputs['Base Color'].default_value=(.002,.42,.40,1)
    teal.inputs['Metallic'].default_value=.24;teal.inputs['Roughness'].default_value=.28;teal.inputs['Coat Weight'].default_value=.30
    teal.inputs['Transmission Weight'].default_value=.08;teal.inputs['IOR'].default_value=1.46
    teal.inputs['Emission Color'].default_value=(.002,.65,.62,1)
    multiply=nodes.new('ShaderNodeMath');multiply.operation='MULTIPLY_ADD'
    multiply.inputs[1].default_value=1.8;multiply.inputs[2].default_value=.16
    links.new(separate.outputs['Green'],multiply.inputs[0]);links.new(multiply.outputs[0],teal.inputs['Emission Strength'])
    mix=nodes.new('ShaderNodeMixShader');links.new(separate.outputs['Red'],mix.inputs[0])
    links.new(blue_mix.outputs[0],mix.inputs[1]);links.new(teal.outputs['BSDF'],mix.inputs[2]);links.new(mix.outputs[0],out.inputs['Surface'])
    display,visor,_=principled('A_visor_obsidiana',(.001,.003,.006),0,.30,0)
    visor.inputs['Specular IOR Level'].default_value=.06
    eyes,_,_=principled('A_ojos_cian',(.035,.90,1.0),.08,.22,.2,5.0)
    logo,node,_=principled('A_logo_PNG_original',(.01,.2,.2),.08,.38,0,.10)
    node.inputs['Specular IOR Level'].default_value=.15
    image=bpy.data.images.load(str(ROOT/'references/logo-original.png'),check_existing=True);image.pack()
    tex=logo.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    logo.node_tree.links.new(tex.outputs['Color'],node.inputs['Base Color'])
    logo.node_tree.links.new(tex.outputs['Color'],node.inputs['Emission Color'])
    return {'body':body,'display':display,'eyes':eyes,'logo_navy':logo,'logo_teal':logo}


def add_indicators(body,material,parent):
    bpy.context.view_layer.update()
    tree=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
    result=[]
    for index,x in enumerate((-.075,0,.075)):
        hit,normal,_,_=tree.ray_cast(Vector((x,-3,-.715)),Vector((0,1,0)),6)
        assert hit is not None
        bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.015,depth=.002,
            location=hit+normal*.0013,rotation=normal.to_track_quat('Z','Y').to_euler())
        obj=bpy.context.object;obj.name='INDICATOR_'+str(index+1);obj.parent=parent;obj.data.materials.append(material)
        for face in obj.data.polygons:face.use_smooth=True
        bevel=obj.modifiers.new('Canto_suave','BEVEL');bevel.width=.0008;bevel.segments=3
        result.append(obj)
    return result


def add_original_logo(body,materials,parent):
    original=ROOT/'references/logo-original.png'
    expected='57b2a9b18b84080c3a22e91c192bfeda0157e0e60c40594f175ea69ec9a547be'
    digest=hashlib.sha256(original.read_bytes()).hexdigest()
    assert digest==expected,'El logotipo original no coincide con la fuente preservada'
    source=json.loads((ROOT/'assets/logos/contours.json').read_text())
    all_points=[p for layer in source['layers'] for polygon in layer['polygons'] for p in polygon]
    minx,maxx=min(p[0] for p in all_points),max(p[0] for p in all_points)
    miny,maxy=min(p[1] for p in all_points),max(p[1] for p in all_points)
    scale=.135/(maxy-miny);center=(minx+maxx)/2
    group=empty('LOGO_SOFLIA_ORIGINAL',parent);group['sha256_original']=digest
    bpy.context.view_layer.update()
    tree=BVHTree.FromObject(body,bpy.context.evaluated_depsgraph_get())
    meshes=[]
    for layer in source['layers']:
        for index,polygon in enumerate(layer['polygons']):
            verts=[((x-center)*scale,0,.755-(y-miny)*scale) for x,y in polygon]
            data=bpy.data.meshes.new('Contorno_original');data.from_pydata(verts,[],[tuple(range(len(verts)))]);data.update()
            obj=bpy.data.objects.new('LOGO_'+layer['color']+'_'+str(index),data);bpy.context.collection.objects.link(obj);obj.parent=group
            data.materials.append(materials['logo_'+layer['color']]);bpy.context.view_layer.objects.active=obj
            tri=obj.modifiers.new('Triangulacion_original','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
            bm=bmesh.new();bm.from_mesh(data)
            for _ in range(5):
                long=[edge for edge in bm.edges if edge.calc_length()>.009]
                if not long:break
                bmesh.ops.subdivide_edges(bm,edges=long,cuts=1,use_grid_fill=True)
                bmesh.ops.triangulate(bm,faces=list(bm.faces))
            bm.to_mesh(data);bm.free()
            for v in data.vertices:
                hit,_,_,_=tree.ray_cast(Vector((v.co.x,-3,v.co.z)),Vector((0,1,0)),6)
                if hit is None:raise ValueError('El logotipo excede el volumen A')
                v.co.y=hit.y-.0015
            bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
            if sum(face.normal.y for face in bm.faces)>0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
            bm.to_mesh(data);bm.free()
            uv=data.uv_layers.new(name='LOGO_PNG_ORIGINAL')
            for face in data.polygons:
                for loop_index in face.loop_indices:
                    v=data.vertices[data.loops[loop_index].vertex_index]
                    original_x=v.co.x/scale+center;original_y=miny+(.755-v.co.z)/scale
                    uv.data[loop_index].uv=(original_x/source['width'],1-original_y/source['height'])
            solid=obj.modifiers.new('Relieve_sutil','SOLIDIFY');solid.thickness=.0008
            for face in data.polygons:face.use_smooth=True
            meshes.append(obj)
    return group,{'sha256':digest,'method':'Contornos alfa originales y PNG original empaquetado; proporción XZ uniforme',
                  'originalAspect':(maxx-minx)/(maxy-miny),'height':.135,'sourcePolygons':len(meshes)}
