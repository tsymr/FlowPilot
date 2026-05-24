const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

test('new user guide prompt is only eligible before the one-time dismissal is set', () => {
  const bundle = [
    extractFunction('isPromptDismissed'),
    extractFunction('setPromptDismissed'),
    extractFunction('isNewUserGuidePromptDismissed'),
    extractFunction('setNewUserGuidePromptDismissed'),
    extractFunction('shouldPromptNewUserGuide'),
  ].join('\n');

  const api = new Function(`
const NEW_USER_GUIDE_PROMPT_DISMISSED_STORAGE_KEY = 'multipage-new-user-guide-prompt-dismissed';
const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};
let latestState = {};
${bundle}
return {
  shouldPromptNewUserGuide,
  setDismissed(value) {
    setNewUserGuidePromptDismissed(value);
  },
};
`)();

  assert.equal(api.shouldPromptNewUserGuide(), true);

  api.setDismissed(true);
  assert.equal(api.shouldPromptNewUserGuide(), false);

  api.setDismissed(false);
  assert.equal(api.shouldPromptNewUserGuide(), false);

  assert.equal(api.shouldPromptNewUserGuide(), false);
});

