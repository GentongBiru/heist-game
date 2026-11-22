// Keyboard + mouse input. The game reads a held-key set every frame for
// movement and a queue of one-shot actions (confirm, pause, grab, smoke,
// fuse, mute) fired on keydown, so a held key never double-fires an action.
export function createInput() {
  const held = new Set();
  const actions = [];
  const codes = {
    confirm: ['Space', 'Enter'],
    pause: ['KeyP', 'Escape'],
    grab: ['KeyE'],
    smoke: ['KeyQ'],
    fuse: ['KeyF'],
    mute: ['KeyM'],
  };
  const moveKeys = {
    KeyW: [0, -1], ArrowUp: [0, -1],
    KeyS: [0, 1], ArrowDown: [0, 1],
    KeyA: [-1, 0], ArrowLeft: [-1, 0],
    KeyD: [1, 0], ArrowRight: [1, 0],
  };

  function onKeyDown(event) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    held.add(event.code);
    for (const [name, list] of Object.entries(codes)) {
      if (list.includes(event.code)) actions.push(name);
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseDown() {
    actions.push('confirm');
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);

  return {
    // Movement direction for this frame, from the keys held down now.
    direction() {
      let mx = 0;
      let my = 0;
      for (const code of held) {
        const delta = moveKeys[code];
        if (delta) {
          mx += delta[0];
          my += delta[1];
        }
      }
      return { mx, my, sneak: held.has('ShiftLeft') || held.has('ShiftRight') };
    },
    // Drain the one-shot actions queued since the last frame.
    takeActions() {
      const out = actions.splice(0, actions.length);
      return out;
    },
    hasAction(name) {
      const i = actions.indexOf(name);
      if (i === -1) return false;
      actions.splice(i, 1);
      return true;
    },
  };
}
