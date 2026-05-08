import { describe, expect, it } from 'vitest';
import {
  LEFTDOWN,
  LEFTUP,
  PINVOKE_HEADER,
  RIGHTDOWN,
  RIGHTUP,
  SEND_KEYS_MAP,
  WHEEL,
} from './fixture';

describe('Key Mapping & Constants', () => {
  it('CU-121: SEND_KEYS_MAP maps enter to {ENTER}', () => {
    expect(SEND_KEYS_MAP.enter).toBe('{ENTER}');
  });

  it('CU-122: SEND_KEYS_MAP maps tab to {TAB}', () => {
    expect(SEND_KEYS_MAP.tab).toBe('{TAB}');
  });

  it('CU-123: SEND_KEYS_MAP maps escape/esc to {ESC}', () => {
    expect(SEND_KEYS_MAP.escape).toBe('{ESC}');
    expect(SEND_KEYS_MAP.esc).toBe('{ESC}');
  });

  it('CU-124: SEND_KEYS_MAP maps ctrl+c to ^c', () => {
    expect(SEND_KEYS_MAP['ctrl+c']).toBe('^c');
  });

  it('CU-125: SEND_KEYS_MAP maps ctrl+v to ^v', () => {
    expect(SEND_KEYS_MAP['ctrl+v']).toBe('^v');
  });

  it('CU-126: SEND_KEYS_MAP maps alt+f4 to %{F4}', () => {
    expect(SEND_KEYS_MAP['alt+f4']).toBe('%{F4}');
  });

  it('CU-127: SEND_KEYS_MAP maps F1-F12 function keys', () => {
    for (let index = 1; index <= 12; index += 1) expect(SEND_KEYS_MAP[`f${index}`]).toBe(`{F${index}}`);
  });

  it('CU-128: PINVOKE_HEADER contains user32.dll imports', () => {
    expect(PINVOKE_HEADER).toContain('user32.dll');
    expect(PINVOKE_HEADER).toContain('SetCursorPos');
    expect(PINVOKE_HEADER).toContain('mouse_event');
  });

  it('CU-129: mouse event flags have correct values', () => {
    expect([LEFTDOWN, LEFTUP, RIGHTDOWN, RIGHTUP, WHEEL]).toEqual([2, 4, 0x0008, 0x0010, 0x0800]);
  });

  it('CU-130: SEND_KEYS_MAP maps arrow keys', () => {
    expect(SEND_KEYS_MAP.up).toBe('{UP}');
    expect(SEND_KEYS_MAP.down).toBe('{DOWN}');
    expect(SEND_KEYS_MAP.left).toBe('{LEFT}');
    expect(SEND_KEYS_MAP.right).toBe('{RIGHT}');
  });
});
