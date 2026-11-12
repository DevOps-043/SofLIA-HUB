"""Reconstrucción por superficies específicas del concepto aprobado de SofLIA."""
import math
from common import empty, mesh, sphere
from reference_surfaces import volume, ribbon
from flow_housing import hull, shell, inset, petal, skin, skin_normal, crown_edge


def create_reference_model(m):
    root=empty('SOFLIA_ROOT');rig=empty('RIG_CONTROLLER',root);motion=empty('STATE_MOTION',rig)
    hull(m['navy'],motion)
    face=volume('FACE_DISPLAY',[(308,582,-.47),(374,486,-.49),(538,415,-.49),(680,423,-.49),(850,480,-.46),(1000,554,-.42),(1045,620,-.38),(1010,711,-.43),(894,785,-.49),(716,832,-.48),(558,822,-.49),(422,756,-.49),(335,660,-.48)],(668,626,-.755),m['face'],motion,back_depth=.075,thickness=.018,bulge=.01)
    upper=shell('SHELL_UPPER',m['navy'],motion)
    inset('SHELL_INNER_BROW',-1.30,.55,lambda t:crown_edge(t)-.025,lambda t:crown_edge(t)+.17,m['edge'],motion)
    shell('SHELL_LOWER',m['navy'],motion,upper=False,rings=28)
    def anchor(phi,theta):return skin(phi,theta)-skin_normal(phi,theta)*.014
    left=empty('FLOW_BAND_LEFT',motion)
    petal('FLOW_BAND_LEFT_SURFACE',[anchor(.95,-1.1),(-.94,-.24,.21),(-1.015,-.28,-.05),(-.90,-.51,-.35),(-.66,-.60,-.64),(-.30,-.46,-.86),anchor(3.0,-.3)],[.008,.17,.25,.28,.30,.23,.006],[.004,.055,.075,.085,.085,.055,.003],m['navy'],left)
    right=empty('FLOW_BAND_RIGHT',motion)
    petal('FLOW_BAND_RIGHT_SURFACE',[(-.66,-.60,-.64),(-.30,-.61,-.62),(.30,-.63,-.58),(.70,-.57,-.44),(1.01,-.28,-.14),(1.035,.15,.12),skin(1.2,1.95)+skin_normal(1.2,1.95)*.04,skin(.97,2.15)+skin_normal(.97,2.15)*.02,skin(.72,2.12)+skin_normal(.72,2.12)*.01,skin(.44,2.05)+skin_normal(.44,2.05)*.005,anchor(.18,2.0)],[.006,.15,.18,.22,.27,.29,.25,.23,.20,.12,.006],[.003,.035,.042,.05,.065,.07,.055,.05,.04,.022,.003],m['teal'],right,m['glow'],segments=240)
    face_controls=empty('FACE_CONTROLS',motion);gaze=empty('GAZE_CONTROLLER',face_controls)
    import bpy
    from mathutils.bvhtree import BVHTree
    from mathutils import Vector
    bpy.context.view_layer.update()
    display_surface=BVHTree.FromObject(face,bpy.context.evaluated_depsgraph_get())
    upper_surface=BVHTree.FromObject(upper,bpy.context.evaluated_depsgraph_get())
    perforations=[];perforation_faces=[]
    for row in range(8):
        for col in range(6):
            px=917+col*22+row*7;py=367+row*24+col*3
            x=(px-656)/480;z=(555-py)/480
            hit,_,_,_=upper_surface.ray_cast(Vector((x,-3,z)),Vector((0,1,0)),6)
            if hit is None:continue
            start=len(perforations)
            for depth in (0,.004):
                for k in range(10):
                    angle=2*math.pi*k/10;perforations.append((x+.0028*math.cos(angle),hit.y-.005+depth,z+.0028*math.sin(angle)))
            perforation_faces.extend([tuple(start+k for k in range(10)),tuple(start+10+k for k in range(10))])
            for k in range(10):perforation_faces.append((start+k,start+(k+1)%10,start+(k+1)%10+10,start+k+10))
    from reference_surfaces import finish
    finish('REFERENCE_PANEL_LIGHTS',perforations,perforation_faces,m['glow'],motion)
    eyes=[]
    for name,x,width in [('EYE_LEFT',-.304,.425),('EYE_RIGHT',.361,.375)]:
        eye=empty(name,gaze);eye.location=(x,-.70,-.194);verts=[];faces=[]
        for i in range(49):
            t=i/48;xx=(t-.5)*width
            for z in (.072*math.sin(math.pi*t)**.9-.018,.166*math.sin(math.pi*t)**.65):
                # Sobre la lente negra, con relieve de sólo 6 mm.
                hit,_,_,_=display_surface.ray_cast(Vector((xx+x,-3,z-.194)),Vector((0,1,0)),6)
                if hit is None:raise ValueError('Un punto de los ojos cae fuera del visor')
                verts.append((xx,hit.y+.70-.009,z))
        for i in range(48):faces.append((i*2,i*2+1,i*2+3,i*2+2))
        lens=mesh(name+'_LENS',verts,faces,m['white'],eye)
        solid=lens.modifiers.new('Relieve_lente','SOLIDIFY');solid.thickness=.006
        eyes.append(eye)
    status=empty('STATUS_INDICATORS',motion)
    chin_surface=BVHTree.FromObject(bpy.data.objects['SHELL_LOWER'],bpy.context.evaluated_depsgraph_get())
    band_surface=BVHTree.FromObject(bpy.data.objects['FLOW_BAND_LEFT_SURFACE'],bpy.context.evaluated_depsgraph_get())
    for i in range(3):
        x=(i-1)*.078;hit,_,_,_=chin_surface.ray_cast(Vector((x,-3,-.80)),Vector((0,1,0)),6)
        band_hit,_,_,_=band_surface.ray_cast(Vector((x,-3,-.80)),Vector((0,1,0)),6)
        surface_y=min(hit.y,band_hit.y) if band_hit else hit.y
        sphere('STATUS_'+str(i),(x,surface_y-.007,-.80),(.023,.012,.023),m['white'],status,20,10)
    audio=empty('AUDIO_INDICATORS',motion)
    for i in range(5):sphere('AUDIO_'+str(i),((i-2)*.055,-.752,-.35),(.009,.008,.035),m['glow'],audio,12,8)
    audio.scale=(.00001,1,.00001)
    success=empty('SUCCESS_MARK',motion);success.scale=(.00001,1,.00001)
    warning=empty('WARNING_MARK',motion);warning.scale=(.00001,1,.00001)
    empty('LIGHT_EMISSIVE',motion)
    # El aro de proyección de la referencia es una banda horizontal con sección propia.
    outer=[];inner=[]
    for i in range(129):
        t=2*math.pi*i/128
        outer.append((656+388*math.cos(t),1037+30*math.sin(t), .48*math.sin(t)))
        inner.append((656+382*math.cos(t),1037+29.5*math.sin(t), .472*math.sin(t)))
    ribbon('HOLOGRAM_RING',outer,inner,m['glow'],root,segments=128,width_steps=1,thickness=.003)
    return dict(root=root,rig=rig,motion=motion,face=face_controls,gaze=gaze,eyes=eyes,bands=[left,right],audio=audio,success=success,warning=warning,indicators=status)
