"""Seis pistas NLA exportables. Los extremos de cada bucle coinciden exactamente."""
import math
from common import FPS, STATES, set_state


def animate(obj,state,duration,pose):
    obj.animation_data_create()
    obj.animation_data.action=None
    count=duration*FPS
    for frame in range(count+1):
        location,rotation,scale=pose(frame/count)
        obj.location=location;obj.rotation_euler=rotation;obj.scale=scale
        for path in ('location','rotation_euler','scale'):
            obj.keyframe_insert(data_path=path,frame=frame+1)
    action=obj.animation_data.action
    slot=obj.animation_data.action_slot
    action.name='STATE_'+state.upper()+'__'+obj.name
    track=obj.animation_data.nla_tracks.new();track.name='STATE_'+state.upper()
    strip=track.strips.new(action.name,1,action)
    strip.action_slot=slot
    strip.extrapolation='NOTHING';strip.blend_type='REPLACE'
    obj.animation_data.action=None
    track.mute=True


def create_animations(parts):
    tau=2*math.pi
    for state,duration in STATES.items():
        def body(t):
            wave=math.sin(tau*t)
            transient=math.sin(math.pi*t)**2
            bob=.028*wave if state!='warning' else .007*wave
            nod=-.075*math.sin(tau*t)*transient if state=='success' else 0
            pitch=-.045 if state=='listening' else (.018*wave if state=='speaking' else 0)
            roll=.035*wave if state=='thinking' else .012*wave
            breath=1+.006*math.sin(tau*t)
            return (0,0,bob),(pitch+nod,0,roll),(breath,breath,breath)
        animate(parts['motion'],state,duration,body)
        for i,eye in enumerate(parts['eyes']):
            x=(-.36,.36)[i]
            def expression(t,i=i,x=x):
                blink=1-.94*max(0,1-abs(t-.72)/.035) if state=='idle' else 1
                zscale={'idle':1,'listening':1.32,'thinking':.4,'speaking':.9,'success':1.15,'warning':.48}[state]
                if state in ('success','warning'):zscale=1+(zscale-1)*math.sin(math.pi*t)**2
                rot=(.1 if i else -.1) if state=='thinking' else 0
                return (x,-.70,.06),(0,rot,0),(1,1,max(.025,zscale*blink))
            animate(eye,state,duration,expression)
        for i,band in enumerate(parts['bands']):
            def flowing(t,i=i):
                a={'idle':.008,'listening':.018,'thinking':.024,'speaking':.029,'success':.035,'warning':.004}[state]
                wave=math.sin(tau*t*(2 if state=='speaking' else 1)+i*math.pi)
                return (0,0,a*wave),(a*.5*wave,0,a*.3*wave),(1+a*.4*wave,1+a*.4*wave,1+a*wave)
            animate(band,state,duration,flowing)
        for key in ('audio','success','warning'):
            target={'audio':state=='speaking','success':state=='success','warning':state=='warning'}[key]
            def symbol(t,key=key,target=target):
                visibility=1 if target else .00001
                if key!='audio' and target:visibility=max(.00001,math.sin(math.pi*t)**2)
                return (0,0,0),(0,0,0),(visibility,1,visibility)
            animate(parts[key],state,duration,symbol)
        for i,obj in enumerate(parts['indicators'].children):
            location=tuple(obj.location);scale=tuple(obj.scale)
            def status(t,i=i,location=location,scale=scale):
                pulse=1+.35*math.sin(tau*t-i*2.094) if state=='thinking' else 1
                return location,(0,0,0),tuple(s*pulse for s in scale)
            animate(obj,state,duration,status)
    set_state('idle')
