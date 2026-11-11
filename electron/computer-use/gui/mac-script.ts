/** Sólo Quartz para mouse; conserva System Events para teclado sin dependencia nueva. */
export const MAC_MOUSE_SCRIPT = `import base64, json, sys, time
import Quartz as q
data = json.loads(base64.b64decode(sys.stdin.read()).decode('utf-8'))
action = data['action']
point = (data['x'], data['y'])
button = q.kCGMouseButtonLeft
down, up = q.kCGEventLeftMouseDown, q.kCGEventLeftMouseUp
if action == 'right_click':
    button, down, up = q.kCGMouseButtonRight, q.kCGEventRightMouseDown, q.kCGEventRightMouseUp
elif action == 'middle_click':
    button, down, up = q.kCGMouseButtonCenter, q.kCGEventOtherMouseDown, q.kCGEventOtherMouseUp
def post(kind, position, count=1):
    event = q.CGEventCreateMouseEvent(None, kind, position, button)
    q.CGEventSetIntegerValueField(event, q.kCGMouseEventClickState, count)
    q.CGEventPost(q.kCGHIDEventTap, event)
if action == 'left_click_drag':
    start = q.CGEventGetLocation(q.CGEventCreate(None))
    try:
        post(down, (start.x, start.y))
        post(q.kCGEventLeftMouseDragged, point)
    finally:
        post(up, point)
else:
    post(q.kCGEventMouseMoved, point)
    if action != 'mouse_move':
        for index in range(2 if action == 'double_click' else 1):
            try:
                post(down, point, index + 1)
            finally:
                post(up, point, index + 1)
            if action == 'double_click' and index == 0:
                time.sleep(0.05)
`;
export const MAC_TYPE_SCRIPT = 'on run argv\n tell application "System Events" to keystroke (item 1 of argv)\nend run';
