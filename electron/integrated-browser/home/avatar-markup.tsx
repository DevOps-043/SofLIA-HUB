import { renderToStaticMarkup } from 'react-dom/server';
import { AvatarFace } from '../../../src/components/avatar/AvatarFace';
import { AVATAR_EXPRESSIONS, EXPRESSION_LABELS } from '../../../src/components/avatar/avatar-model';
import { AVATAR_MOTION_PROFILES } from '../../../src/components/avatar/avatar-motion';
import rules from '../../../src/shared/avatar-draft-rules.json';
import body from '../../../src/assets/soflia-avatar/body.png?inline';
import light from '../../../src/assets/soflia-avatar/light.png?inline';

/** Solo plantillas locales de confianza: el borrador nunca se inserta como HTML. */
export function browserHomeAvatar() {
  const config = JSON.stringify({ rules, profiles: AVATAR_MOTION_PROFILES, labels: EXPRESSION_LABELS }).replace(/[<>&]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return renderToStaticMarkup(<>
    <div id="home-avatar" className="soflia-avatar" data-expression="curious" data-running="false" role="img" aria-label="SofLIA: Curiosidad">
      <div className="soflia-avatar__shadow" aria-hidden="true" />
      <div className="soflia-avatar__rig" aria-hidden="true">
        <img className="soflia-avatar__layer" src={body} alt="" draggable={false} />
        <div className="soflia-avatar__expression"><div className="soflia-avatar__gaze"><AvatarFace expression="curious" /></div></div>
        <img className="soflia-avatar__layer soflia-avatar__light" src={light} alt="" draggable={false} />
      </div>
    </div>
    {AVATAR_EXPRESSIONS.map(expression => <template key={expression} data-avatar-template={expression}><AvatarFace expression={expression} /></template>)}
    <template id="home-avatar-config">{config}</template>
  </>);
}
