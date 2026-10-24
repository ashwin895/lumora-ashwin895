// Lumora front end. No framework, no third-party scripts.
// All personal data lives in this browser's localStorage and can be exported or deleted from Settings.

const $ = (s) => document.querySelector(s);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

const KEYS = {
  name: 'lumora.name',
  convs: 'lumora.conversations',
  memories: 'lumora.memories',
  prefs: 'lumora.prefs',
};
const DEFAULT_PREFS = { length: 'medium', level: 'standard', useMemory: true, speak: false };
const LIMITS = { textFileBytes: 200_000, textChars: 40_000, imageBytes: 15_000_000 };
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|js|mjs|ts|py|html|css|xml|yml|yaml|log|sql|java|c|cpp|cs|go|rs|rb|php|sh)$/i;

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const state = {
  name: localStorage.getItem(KEYS.name) || '',
  convs: store.get(KEYS.convs, []),          // { id, title, updated, messages: [{role, content, shown?}] }
  memories: store.get(KEYS.memories, []),    // { id, text, created }
  prefs: { ...DEFAULT_PREFS, ...store.get(KEYS.prefs, {}) },
  currentId: null,
  attachments: [],                           // { kind: 'image'|'text', name, dataUrl? | content? }
  busy: false,
  controller: null,
};

// ---------- Logo ----------
const MARK = (id) => `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6fd3bd"/><stop offset="1" stop-color="#8fa6ff"/>
  </linearGradient></defs>
  <g fill="none" stroke="url(#${id})" stroke-width="3.2" stroke-linecap="round">
    <path class="p1" pathLength="100" d="M50 14C72 30 72 70 50 86C28 70 28 30 50 14Z"/>
    <path class="p2" pathLength="100" d="M14 50C30 28 70 28 86 50C70 72 30 72 14 50Z"/>
  </g>
  <circle class="core" cx="50" cy="50" r="7" fill="url(#${id})"/>
</svg>`;
$('#splashMark').innerHTML = MARK('g-splash');
$('#gateLogo').innerHTML = MARK('g-gate');
$('#headLogo').innerHTML = MARK('g-head');

// ---------- Startup ----------
setTimeout(() => {
  $('#splash').classList.add('gone');
  if (state.name) enterApp();
  else showGate();
}, 3200);

function showGate() {
  $('#gate').hidden = false;
  setTimeout(() => $('#nameInput').focus(), 300);
}

$('#nameForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('#nameInput').value.trim().slice(0, 40);
  if (!name) return;
  const first = !state.name;
  state.name = name;
  localStorage.setItem(KEYS.name, name);
  $('#gate').hidden = true;
  enterApp();
  if (first) {
    newConversation();
    addAssistantBubble(false, `Hi ${name}! I'm Lumora, your thinking partner. What would you like to explore today?`);
  }
});

function enterApp() {
  $('#app').hidden = false;
  if (window.innerWidth > 800) $('#app').classList.remove('collapsed');
  $('#greet').textContent = `Hello, ${state.name}`;
  $('#nameEdit').value = state.name;
  renderSidebar();
  if (!state.currentId) {
    const latest = state.convs[0];
    if (latest) openConv(latest.id);
    else newConversation();
  }
}

// ---------- Conversations ----------
function save() {
  try {
    store.set(KEYS.convs, state.convs);
  } catch {
    toast('Browser storage is full. Delete some chats or memories to keep saving.');
  }
}

function currentConv() {
  return state.convs.find((c) => c.id === state.currentId) || null;
}

function newConversation() {
  state.currentId = null;
  $('#messages').innerHTML = '';
  setChatMode(false);
  renderSidebar();
  $('#input').focus();
}

function openConv(id) {
  const conv = state.convs.find((c) => c.id === id);
  if (!conv) return;
  state.currentId = id;
  $('#messages').innerHTML = '';
  conv.messages.forEach(renderStoredMessage);
  setChatMode(conv.messages.length > 0);
  renderSidebar();
  scrollDown();
  if (window.innerWidth <= 800) $('#app').classList.add('collapsed');
}

function deleteConv(id) {
  const conv = state.convs.find((c) => c.id === id);
  if (!conv || !confirm(`Delete the chat "${conv.title || 'New chat'}"? This cannot be undone.`)) return;
  state.convs = state.convs.filter((c) => c.id !== id);
  save();
  if (state.currentId === id) newConversation();
  renderSidebar();
}

function renderSidebar() {
  const list = $('#convList');
  list.innerHTML = '';
  if (!state.convs.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Your chats will appear here.';
    list.append(li);
    return;
  }
  for (const c of state.convs) {
    const title = c.title || 'New chat';
    const li = document.createElement('li');
    li.className = 'conv' + (c.id === state.currentId ? ' active' : '');
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'conv-open';
    open.textContent = title;
    if (c.id === state.currentId) open.setAttribute('aria-current', 'true');
    open.addEventListener('click', () => openConv(c.id));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'conv-del';
    del.textContent = '\u00D7';
    del.setAttribute('aria-label', `Delete chat ${title}`);
    del.addEventListener('click', () => deleteConv(c.id));
    li.append(open, del);
    list.append(li);
  }
}

function setChatMode(on) {
  document.body.classList.toggle('has-msgs', on);
  if (!on) document.body.classList.remove('focused');
}

$('#newChat').addEventListener('click', newConversation);
$('#toggleSidebar').addEventListener('click', () => {
  const app = $('#app');
  app.classList.toggle('collapsed');
  $('#toggleSidebar').setAttribute('aria-expanded', String(!app.classList.contains('collapsed')));
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !$('#app').hidden) {
    e.preventDefault();
    newConversation();
  }
});

// ---------- Rendering messages ----------
function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function inline(s) {
  // s is already HTML-escaped, so only trusted tags are created here
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) =>
      `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
}

// Small, safe Markdown renderer: everything is escaped before formatting is applied
function renderMarkdown(src) {
  const lines = String(src).replace(/\r/g, '').split('\n');
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) {
      out.push(`<p>${inline(esc(para.join(' ')))}</p>`);
      para = [];
    }
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```\s*([\w+-]*)\s*$/);
    if (fence) {
      flush();
      const code = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(
        `<div class="codeblock"><div class="codehead"><span>${esc(fence[1] || 'code')}</span>` +
        `<button class="copy" type="button">Copy</button></div><pre><code>${esc(code.join('\n'))}</code></pre></div>`
      );
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flush();
      const tag = `h${heading[1].length + 2}`;
      out.push(`<${tag}>${inline(esc(heading[2]))}</${tag}>`);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(esc(lines[i].replace(/^\s*[-*]\s+/, '')))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${inline(esc(lines[i].replace(/^\s*\d+[.)]\s+/, '')))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    para.push(line);
    i++;
  }
  flush();
  return out.join('');
}

function contentText(content) {
  if (typeof content === 'string') return content;
  return (content || []).map((p) => (p.type === 'text' ? p.text : '[image]')).join('\n');
}

function addUserBubble(text) {
  const wrap = document.createElement('div');
  wrap.className = 'msg user';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  wrap.append(bubble);
  $('#messages').append(wrap);
  setChatMode(true);
  scrollDown();
}

function addAssistantBubble(typing, text = '') {
  const wrap = document.createElement('div');
  wrap.className = 'msg assistant';
  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (typing ? ' typing' : '');
  if (text) bubble.innerHTML = renderMarkdown(text);
  wrap.append(bubble);
  $('#messages').append(wrap);
  setChatMode(true);
  if (!typing && text) addMessageActions(wrap);
  scrollDown();
  return bubble;
}

function addMessageActions(wrap) {
  const bar = document.createElement('div');
  bar.className = 'msg-actions';
  bar.innerHTML = '<button type="button" class="speak">Listen</button><button type="button" class="copy-msg">Copy</button>';
  wrap.append(bar);
}

function renderStoredMessage(m) {
  if (m.role === 'user') addUserBubble(m.shown || contentText(m.content));
  else addAssistantBubble(false, contentText(m.content));
}

function scrollDown() {
  const box = $('#messages');
  box.scrollTop = box.scrollHeight;
}

// Event delegation for code copy, message copy, and read-aloud
$('#messages').addEventListener('click', async (e) => {
  const copyCode = e.target.closest('.codeblock .copy');
  const copyMsg = e.target.closest('.copy-msg');
  const speakBtn = e.target.closest('.speak');
  try {
    if (copyCode) {
      await navigator.clipboard.writeText(copyCode.closest('.codeblock').querySelector('code').textContent);
      flash(copyCode, 'Copied');
    } else if (copyMsg) {
      const text = copyMsg.closest('.msg').querySelector('.bubble').textContent;
      await navigator.clipboard.writeText(text);
      flash(copyMsg, 'Copied');
    } else if (speakBtn) {
      speak(speakBtn.closest('.msg').querySelector('.bubble').textContent);
    }
  } catch {
    toast('Copying is not available in this browser.');
  }
});

function flash(btn, label) {
  const old = btn.textContent;
  btn.textContent = label;
  setTimeout(() => (btn.textContent = old), 1400);
}

function speak(text) {
  if (!('speechSynthesis' in window)) return toast('Read-aloud is not supported in this browser.');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*#`_]/g, '').slice(0, 4000));
  u.lang = navigator.language || 'en-US';
  speechSynthesis.speak(u);
}

// ---------- Sending ----------
const input = $('#input');
input.addEventListener('focus', () => document.body.classList.add('focused'));
input.addEventListener('blur', () => {
  if (!input.value.trim() && !document.body.classList.contains('has-msgs')) {
    document.body.classList.remove('focused');
  }
});
input.addEventListener('input', autosize);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send();
  }
});
$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  send();
});
$('#stopBtn').addEventListener('click', () => state.controller?.abort());

function autosize() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 180) + 'px';
}

function setBusy(on) {
  state.busy = on;
  $('#sendBtn').hidden = on;
  $('#stopBtn').hidden = !on;
  $('#messages').setAttribute('aria-busy', String(on));
}

let renderFrame = 0;
let pending = null;
function scheduleRender(bubble, text) {
  pending = { bubble, text };
  if (renderFrame) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    pending.bubble.innerHTML = renderMarkdown(pending.text);
    scrollDown();
  });
}

async function send() {
  if (state.busy) return;
  const typed = input.value.trim();
  if (!typed && !state.attachments.length) return;
  if (!state.name) return showGate();

  let conv = currentConv();
  if (!conv) {
    conv = { id: uid(), title: '', updated: Date.now(), messages: [] };
    state.convs.unshift(conv);
    state.currentId = conv.id;
  }

  const files = state.attachments;
  const images = files.filter((f) => f.kind === 'image');
  const fileNotes = files.filter((f) => f.kind === 'text').map((f) => `Attached file "${f.name}":\n\`\`\`\n${f.content}\n\`\`\``);
  const apiText = [typed || (images.length ? 'Please look at the attached image.' : ''), ...fileNotes].filter(Boolean).join('\n\n');
  const storedContent = [apiText, ...images.map((i) => `[Image attached: ${i.name}]`)].join('\n');
  const apiContent = images.length
    ? [{ type: 'text', text: apiText }, ...images.map((i) => ({ type: 'image_url', image_url: { url: i.dataUrl } }))]
    : apiText;
  const shown = typed || files.map((f) => f.name).join(', ');

  state.attachments = [];
  renderChips();
  input.value = '';
  autosize();

  conv.messages.push({ role: 'user', content: storedContent, shown });
  addUserBubble(shown);
  const bubble = addAssistantBubble(true);

  const history = conv.messages.map((m) => ({ role: m.role, content: m.content }));
  history[history.length - 1].content = apiContent;

  setBusy(true);
  const controller = new AbortController();
  state.controller = controller;
  let full = '';
  let succeeded = false;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: state.name,
        prefs: state.prefs,
        memories: state.prefs.useMemory ? state.memories.map((m) => m.text) : [],
        messages: history.slice(-30),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'The request could not be completed.');
    }
    await readStream(res, (text) => {
      full += text;
      scheduleRender(bubble, full);
    });
    if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = 0; }
    if (!full.trim()) throw new Error('The reply came back empty.');
    succeeded = true;
  } catch (err) {
    if (renderFrame) { cancelAnimationFrame(renderFrame); renderFrame = 0; }
    if (err.name === 'AbortError' && full.trim()) {
      succeeded = true;
      full += '\n\n*(stopped)*';
    } else if (err.name !== 'AbortError') {
      bubble.classList.remove('typing');
      bubble.classList.add('error');
      bubble.textContent = `I could not finish that. ${err.message}`;
    }
  } finally {
    setBusy(false);
    state.controller = null;
    bubble.classList.remove('typing');
    if (succeeded) {
      bubble.innerHTML = renderMarkdown(full);
      addMessageActions(bubble.closest('.msg'));
      conv.messages.push({ role: 'assistant', content: full });
      if (!conv.title) conv.title = (typed || files[0]?.name || 'New chat').slice(0, 40);
      conv.updated = Date.now();
      save();
      if (state.prefs.speak) speak(full);
    } else {
      // Roll back the unanswered user turn so the conversation stays valid and the message can be retried
      conv.messages.pop();
      if (!conv.messages.length) state.convs = state.convs.filter((c) => c.id !== conv.id);
      save();
      if (!bubble.classList.contains('error')) bubble.closest('.msg')?.remove();
      input.value = typed;
      autosize();
    }
    renderSidebar();
    scrollDown();
    input.focus();
  }
}

async function readStream(res, onText) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = block.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      const evt = JSON.parse(line.slice(6));
      if (evt.error) throw new Error(evt.error);
      if (evt.text) onText(evt.text);
      if (evt.done) return;
    }
  }
}

// ---------- Voice input ----------
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let micBase = '';
$('#micBtn').addEventListener('click', () => {
  if (!SpeechRec) return toast('Voice input is not supported in this browser. Try Chrome, Edge or Safari.');
  if (rec) return rec.stop();
  rec = new SpeechRec();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  micBase = input.value ? input.value.trimEnd() + ' ' : '';
  rec.onresult = (e) => {
    let text = '';
    for (const r of e.results) text += r[0].transcript;
    input.value = micBase + text;
    autosize();
  };
  rec.onerror = (e) => toast(`Voice input stopped: ${e.error}`);
  rec.onend = () => {
    rec = null;
    $('#micBtn').setAttribute('aria-pressed', 'false');
  };
  rec.start();
  $('#micBtn').setAttribute('aria-pressed', 'true');
});

// ---------- Attachments ----------
$('#attachBtn').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try {
      state.attachments.push(await readFile(file));
    } catch (err) {
      toast(err.message);
    }
  }
  e.target.value = '';
  renderChips();
});

async function readFile(file) {
  if (file.type.startsWith('image/')) {
    if (file.size > LIMITS.imageBytes) throw new Error(`${file.name} is too large (max 15 MB).`);
    return { kind: 'image', name: file.name, dataUrl: await shrinkImage(file) };
  }
  if (file.type.startsWith('text/') || TEXT_EXT.test(file.name)) {
    if (file.size > LIMITS.textFileBytes) throw new Error(`${file.name} is too large to read (max 200 KB).`);
    return { kind: 'text', name: file.name, content: (await file.text()).slice(0, LIMITS.textChars) };
  }
  throw new Error(`${file.name} is not supported yet. Try images, or text, Markdown, CSV, JSON or code files. PDF and Word support is on the roadmap.`);
}

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} could not be read as an image.`));
    };
    img.src = url;
  });
}

function renderChips() {
  const box = $('#attachments');
  box.innerHTML = '';
  state.attachments.forEach((a, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `${a.kind === 'image' ? 'Image' : 'File'}: ${a.name}`;
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'chip-x';
    x.textContent = '\u00D7';
    x.setAttribute('aria-label', `Remove ${a.name}`);
    x.addEventListener('click', () => {
      state.attachments.splice(i, 1);
      renderChips();
    });
    chip.append(x);
    box.append(chip);
  });
  box.hidden = !state.attachments.length;
}

// ---------- Settings: preferences, name, memory, data ----------
const settings = $('#settings');
$('#openSettings').addEventListener('click', () => {
  $('#prefLength').value = state.prefs.length;
  $('#prefLevel').value = state.prefs.level;
  $('#prefMemory').checked = state.prefs.useMemory;
  $('#prefSpeak').checked = state.prefs.speak;
  $('#nameEdit').value = state.name;
  renderMemories();
  settings.showModal();
});

function savePrefs() {
  state.prefs = {
    length: $('#prefLength').value,
    level: $('#prefLevel').value,
    useMemory: $('#prefMemory').checked,
    speak: $('#prefSpeak').checked,
  };
  store.set(KEYS.prefs, state.prefs);
}
['#prefLength', '#prefLevel', '#prefMemory', '#prefSpeak'].forEach((s) => $(s).addEventListener('change', savePrefs));

$('#nameEdit').addEventListener('change', (e) => {
  const name = e.target.value.trim().slice(0, 40);
  if (!name) {
    e.target.value = state.name;
    return;
  }
  state.name = name;
  localStorage.setItem(KEYS.name, name);
  $('#greet').textContent = `Hello, ${name}`;
  toast('Name updated.');
});

function saveMemories() {
  try {
    store.set(KEYS.memories, state.memories);
  } catch {
    toast('Browser storage is full. Delete some memories to keep saving.');
  }
}

function renderMemories() {
  const list = $('#memList');
  list.innerHTML = '';
  if (!state.memories.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No memories yet.';
    list.append(li);
    return;
  }
  for (const m of state.memories) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = m.text;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => {
      const next = prompt('Edit this memory:', m.text);
      if (next === null) return;
      const clean = next.trim().slice(0, 300);
      if (!clean) return;
      m.text = clean;
      saveMemories();
      renderMemories();
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      state.memories = state.memories.filter((x) => x.id !== m.id);
      saveMemories();
      renderMemories();
    });
    li.append(span, edit, del);
    list.append(li);
  }
}

$('#memForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#memInput').value.trim().slice(0, 300);
  if (!text) return;
  state.memories.unshift({ id: uid(), text, created: Date.now() });
  saveMemories();
  $('#memInput').value = '';
  renderMemories();
});

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#exportData').addEventListener('click', () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    name: state.name,
    preferences: state.prefs,
    memories: state.memories,
    conversations: state.convs,
  };
  download('lumora-data.json', JSON.stringify(payload, null, 2), 'application/json');
});

$('#exportChat').addEventListener('click', () => {
  const conv = currentConv();
  if (!conv) return toast('Open a chat first.');
  const md = `# ${conv.title || 'Lumora chat'}\n\n` + conv.messages
    .map((m) => `**${m.role === 'user' ? state.name || 'You' : 'Lumora'}:** ${contentText(m.content)}`)
    .join('\n\n');
  download(`lumora-${conv.id.slice(0, 8)}.md`, md, 'text/markdown');
});

$('#wipeData').addEventListener('click', () => {
  if (!confirm('Delete all conversations, memories, preferences and your name from this browser? This cannot be undone.')) return;
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  location.reload();
});

// ---------- Toast ----------
let toastTimer = 0;
function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4500);
}
