const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const state = {
  emails: [],
  selectedId: null,
  view: 'inbox',
  filter: 'all',
  query: '',
  status: { mode: 'demo', novaReady: false, outlookReady: false, outlookConnected: false, deviceAuth: null },
  draftEdits: new Map(),
  busy: false,
  refreshing: false,
  installPrompt: null,
  lastDeviceError: '',
};

const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const demoEmails = [
  {
    id: 'demo-mia', sender: 'mia.park@studio-mail.com', senderName: 'Mia Park', initials: 'MP', tone: 'tone-lilac',
    subject: 'A quick question about next week’s workshop',
    body: 'Hi there,\n\nI’m looking forward to the workshop next week. Could you let me know what time we’ll be starting and whether I should bring anything along?\n\nThanks so much!\nMia',
    preview: 'I’m looking forward to the workshop next week. Could you let me know what time we’ll be starting…',
    receivedAt: hoursAgo(1), status: 'draft', trusted: true, category: 'Priority',
    draft: 'Hi Mia,\n\nThanks for reaching out! I’m glad you’re joining us. I’ll confirm the start time and any materials you’ll need shortly.\n\nLooking forward to it,\nNova',
  },
  {
    id: 'demo-eli', sender: 'eli.chen@northstar.io', senderName: 'Eli Chen', initials: 'EC', tone: 'tone-blue',
    subject: 'Re: Invoice #4821',
    body: 'Hey,\n\nJust checking whether the revised invoice is ready. I’d love to get it into this month’s books before Friday.\n\nBest,\nEli',
    preview: 'Just checking whether the revised invoice is ready. I’d love to get it into this month’s books…',
    receivedAt: hoursAgo(3), status: 'draft', trusted: true, category: 'Follow up',
    draft: 'Hi Eli,\n\nThanks for checking in. I’m looking into the revised invoice now and will send you an update before Friday.\n\nBest,\nNova',
  },
  {
    id: 'demo-samira', sender: 'samira@fieldnotes.design', senderName: 'Samira Okafor', initials: 'SO', tone: 'tone-peach',
    subject: 'Could we move our Thursday call?',
    body: 'Hello,\n\nSomething has come up on my calendar Thursday afternoon. Would it be possible to move our call to Friday morning? I’m free before 11.\n\nThanks,\nSamira',
    preview: 'Something has come up on my calendar Thursday afternoon. Would it be possible to move our call…',
    receivedAt: hoursAgo(22), status: 'needs_draft', trusted: true, category: 'Personal',
    draft: 'Hi Samira,\n\nFriday morning could work. Let me check my calendar and I’ll confirm a time before 11.\n\nThanks,\nNova',
  },
  {
    id: 'demo-oliver', sender: 'oliver@brightday.co', senderName: 'Oliver Grant', initials: 'OG', tone: 'tone-green',
    subject: 'Thanks for the thoughtful walkthrough',
    body: 'Hi,\n\nReally appreciated you taking the time to walk me through the project today. It’s exciting to see how everything is coming together.\n\nLet’s stay in touch,\nOliver',
    preview: 'Really appreciated you taking the time to walk me through the project today. It’s exciting…',
    receivedAt: hoursAgo(30), status: 'sent', trusted: true, category: 'Personal',
    draft: 'Hi Oliver,\n\nThanks for the kind note. I enjoyed the conversation too and am glad the walkthrough was helpful. Let’s keep in touch!\n\nBest,\nNova',
    sentAt: hoursAgo(28),
  },
];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function initialsFor(email) {
  return (email.senderName || email.sender || '?')
    .split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function senderTone(email) {
  if (email.tone) return email.tone;
  const tones = ['tone-lilac', 'tone-peach', 'tone-blue', 'tone-green', 'tone-rose'];
  let hash = 0;
  for (const character of String(email.sender || '')) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return tones[Math.abs(hash) % tones.length];
}

function relativeTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  if (hours < 48) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fullDate(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function updateStatus() {
  const pill = $('#connection-pill');
  if (state.status.outlookConnected) {
    pill.classList.add('live');
    pill.innerHTML = '<span class="pulse-dot"></span><span>Outlook connected</span>';
  } else {
    pill.classList.remove('live');
    pill.innerHTML = '<span class="pulse-dot"></span><span>' + (state.status.outlookReady ? 'Connect Outlook' : 'Setup needed') + '</span>';
  }
  $('#nova-mark').textContent = state.status.novaReady ? '✓' : '○';
  $('#outlook-mark').textContent = state.status.outlookConnected ? '✓' : '○';
  $('#nova-mark').classList.toggle('ready', state.status.novaReady);
  $('#outlook-mark').classList.toggle('ready', state.status.outlookConnected);
  $('#outlook-account').textContent = state.status.outlookConnected
    ? (state.status.outlookAccount || 'Mailbox connected · automatic sync on')
    : 'Inbox, drafts · approved replies';
  const connectButton = $('#connect-outlook');
  if (connectButton) {
    connectButton.disabled = !state.status.outlookReady || state.status.outlookConnected;
    connectButton.textContent = state.status.outlookConnected ? 'Outlook connected' : 'Connect Outlook';
  }
  renderDeviceAuth();
  $('#sync-button').disabled = !state.status.outlookConnected || state.refreshing;
  $('#sync-button').classList.toggle('syncing', state.refreshing);
}

function renderDeviceAuth() {
  const box = $('#device-code');
  const device = state.status.deviceAuth;
  const waiting = device?.status === 'waiting';
  box.classList.toggle('hidden', !waiting);
  if (waiting) {
    state.lastDeviceError = '';
    $('#device-link').href = device.verificationUri || 'https://microsoft.com/devicelogin';
    $('#device-user-code').textContent = device.userCode || '';
  } else if (device?.status === 'error' && device.error && state.lastDeviceError !== device.error) {
    state.lastDeviceError = device.error;
    toast(device.error);
  }
}

function visibleEmails() {
  let emails = [...state.emails];
  if (state.view === 'drafts') emails = emails.filter((email) => email.status === 'draft' || email.status === 'needs_draft');
  if (state.view === 'sent') emails = emails.filter((email) => email.status === 'sent');
  if (state.view === 'snoozed') emails = [];
  if (state.view === 'priority') emails = emails.filter((email) => email.category === 'Priority' || email.status === 'needs_draft');
  if (state.view === 'follow-up') emails = emails.filter((email) => email.category === 'Follow up');
  if (state.view === 'personal') emails = emails.filter((email) => email.category === 'Personal');
  if (state.filter === 'unread') emails = emails.filter((email) => email.status === 'needs_draft' || email.status === 'draft');
  if (state.filter === 'needs-reply') emails = emails.filter((email) => email.status === 'draft' || email.status === 'needs_draft');
  const query = state.query.trim().toLowerCase();
  if (query) emails = emails.filter((email) => [email.sender, email.senderName, email.subject, email.body].join(' ').toLowerCase().includes(query));
  return emails;
}

function rowTag(email) {
  if (email.status === 'sent') return '<span class="row-tag green-tag">Replied</span>';
  if (email.status === 'blocked' || email.status === 'send_failed') return '<span class="row-tag amber-tag">' + (email.status === 'blocked' ? 'Blocked' : 'Check send') + '</span>';
  if (email.category === 'Priority') return '<span class="row-tag">Priority</span>';
  if (email.category === 'Follow up') return '<span class="row-tag amber-tag">Follow up</span>';
  return '';
}

function renderList() {
  const items = visibleEmails();
  const container = $('#message-list');
  $('#view-count').textContent = String(items.length);
  $('#all-count').textContent = String(state.emails.filter((email) => email.status !== 'sent').length);
  $('#all-tab-count').textContent = String(state.emails.length);
  $('#draft-count').textContent = String(state.emails.filter((email) => email.status === 'draft' || email.status === 'needs_draft').length);
  if (!items.length) {
    container.innerHTML = `<div class="no-messages"><div>✳</div><b>${state.query ? 'No matching emails' : 'Nothing here yet'}</b><span>${state.query ? 'Try another search.' : 'New messages will show up here.'}</span></div>`;
    return;
  }
  container.innerHTML = items.map((email) => {
    const selected = email.id === state.selectedId;
    const unread = email.status === 'needs_draft';
    const preview = email.preview || email.body || email.draftError || '';
    return `<article class="message-row ${selected ? 'selected' : ''} ${unread ? 'unread' : ''}" data-id="${escapeHtml(email.id)}" tabindex="0" role="button" aria-label="Email from ${escapeHtml(email.senderName || email.sender)}: ${escapeHtml(email.subject)}">
      <div class="row-avatar ${senderTone(email)}">${escapeHtml(initialsFor(email))}</div>
      <div class="row-content">
        <div class="row-top"><span class="message-sender">${escapeHtml(email.senderName || email.sender)}</span><span class="message-time">${escapeHtml(relativeTime(email.receivedAt))}</span>${unread ? '<span class="unread-mark"></span>' : ''}</div>
        <div class="message-subject">${escapeHtml(email.subject || '(no subject)')}</div>
        <div class="message-preview">${escapeHtml(preview)}</div>
        <div class="row-meta">${rowTag(email)}${email.status === 'draft' ? '<span class="row-tag">AI draft</span>' : ''}<span class="row-star">${email.category === 'Priority' ? '★' : ''}</span></div>
      </div>
    </article>`;
  }).join('');
  $$('.message-row', container).forEach((row) => {
    row.addEventListener('click', () => selectEmail(row.dataset.id));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectEmail(row.dataset.id); }
    });
  });
}

function statusLabel(email) {
  if (email.status === 'sent') return 'Reply sent';
  if (email.status === 'blocked') return 'Sender blocked';
  if (email.status === 'sending') return 'Sending reply';
  if (email.status === 'send_failed') return 'Send needs review';
  if (email.status === 'processing') return 'Drafting reply';
  if (email.status === 'needs_draft') return 'Needs a draft';
  return 'Draft ready';
}

function getDraft(email) {
  return state.draftEdits.has(email.id) ? state.draftEdits.get(email.id) : (email.draft || '');
}

function renderDetail() {
  const email = state.emails.find((item) => item.id === state.selectedId);
  const empty = $('#detail-empty');
  const content = $('#detail-content');
  if (!email) {
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    $('#detail-panel').classList.remove('mobile-open');
    return;
  }
  empty.classList.add('hidden');
  content.classList.remove('hidden');
  $('#detail-panel').classList.add('mobile-open');
  const canSend = state.status.outlookConnected && email.trusted && email.status !== 'sent' && email.status !== 'blocked' && email.status !== 'sending' && email.status !== 'send_failed';
  const canDraft = state.status.novaReady && email.trusted && email.status !== 'sent' && email.status !== 'send_failed' && email.status !== 'sending';
  const draft = getDraft(email);
  const statusText = email.status === 'blocked' ? 'Not processed' : statusLabel(email);
  const errorMarkup = email.draftError && email.status !== 'sent'
    ? `<div class="draft-error">${escapeHtml(email.draftError)}</div>` : '';
  const draftMarkup = email.status === 'sent'
    ? `<div class="sent-banner"><span>✓</span><strong>Reply sent</strong><span>${escapeHtml(fullDate(email.sentAt))}</span></div>`
    : `<section class="ai-draft-card">
        <div class="draft-heading"><div class="draft-title"><span class="draft-sparkle">✳</span> AI reply draft</div><div class="draft-state">${escapeHtml(statusText)}</div></div>
        ${email.trusted ? `<textarea class="draft-body" id="draft-body" aria-label="Edit reply draft" placeholder="Your AI reply draft will appear here…">${escapeHtml(draft)}</textarea>` : `<div class="draft-error">This message came from an address outside your sender allowlist. Its contents were not shown to NOVA V8.</div>`}
        ${errorMarkup}
        <div class="draft-bottom"><div class="draft-hint"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5v2m0 11v2m7.5-7.5h-2m-11 0h-2m12.8-5.3-1.4 1.4m-7.8 7.8-1.4 1.4m10.6 0-1.4-1.4m-7.8-7.8L5.3 4.7"/><circle cx="10" cy="10" r="3"/></svg> Review and edit before sending</div>
          <div class="draft-buttons">
            <button class="button-secondary" id="regenerate-button" type="button" ${canDraft ? '' : 'disabled'}>${email.draft ? 'Regenerate' : 'Generate draft'}</button>
            <button class="button-primary" id="send-button" type="button" ${canSend && draft.trim() ? '' : 'disabled'}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m18 2-6 16-3.5-7.5L1 7Z"/><path d="M18 2 8.5 10.5"/></svg>${email.status === 'send_failed' ? 'Check Sent Items' : (canSend ? 'Send reply' : (state.status.outlookConnected ? 'Send reply' : 'Connect Outlook'))}</button>
          </div>
        </div>
      </section>
      <p class="ai-disclaimer">AI can make mistakes. Check names, dates, and details before sending.</p>`;

  content.innerHTML = `<div class="detail-toolbar">
    <div class="detail-breadcrumb"><span>Inbox</span><span class="slash">/</span><strong>${escapeHtml(email.category || 'Conversation')}</strong></div>
    <div class="detail-actions"><button class="detail-icon back-to-list" id="back-to-list" type="button" aria-label="Back to inbox"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button><button class="detail-icon" id="archive-button" type="button" aria-label="Archive message"><svg viewBox="0 0 24 24"><path d="M4 4h16v4H4zM5 8v11h14V8M10 12h4"/></svg></button><button class="detail-icon" id="more-detail-button" type="button" aria-label="More options">···</button></div>
  </div>
  <div class="detail-subject-row"><h2 class="detail-subject">${escapeHtml(email.subject || '(no subject)')}</h2><div class="detail-labels">${email.category ? `<span class="subject-label">${escapeHtml(email.category)}</span>` : ''}${email.status === 'draft' ? '<span class="subject-label">AI draft</span>' : ''}</div></div>
  <article class="email-card">
    <div class="email-header"><div class="row-avatar ${senderTone(email)}">${escapeHtml(initialsFor(email))}</div><div class="email-sender-copy"><b>${escapeHtml(email.senderName || email.sender)}</b><span>${escapeHtml(email.sender)} · to me</span></div><time class="email-date">${escapeHtml(fullDate(email.receivedAt))}</time></div>
    <div class="email-body">${escapeHtml(email.trusted ? (email.body || email.preview || 'No readable message body was included.') : 'This message is outside your trusted sender list. Its contents are hidden and were not sent to NOVA V8.')}</div>
    <div class="email-footer">↳ &nbsp;Reply to <strong>${escapeHtml(email.sender)}</strong></div>
  </article>
  ${draftMarkup}`;

  const textarea = $('#draft-body', content);
  if (textarea) textarea.addEventListener('input', () => {
    state.draftEdits.set(email.id, textarea.value);
    const sendButton = $('#send-button', content);
    if (sendButton) sendButton.disabled = !(canSend && textarea.value.trim());
  });
  $('#regenerate-button', content)?.addEventListener('click', () => regenerateDraft(email));
  $('#send-button', content)?.addEventListener('click', () => sendReply(email));
  $('#back-to-list', content)?.addEventListener('click', () => $('#detail-panel').classList.remove('mobile-open'));
  $('#archive-button', content)?.addEventListener('click', () => toast('Archive is ready to connect to your mail provider.'));
  $('#more-detail-button', content)?.addEventListener('click', () => toast('More message actions will be added here.'));
}

function selectEmail(id) {
  state.selectedId = id;
  const item = state.emails.find((email) => email.id === id);
  if (item?.status === 'needs_draft' && item.body) item.status = 'needs_draft';
  renderList();
  renderDetail();
}

function setView(view) {
  state.view = view;
  const labels = { inbox: 'All mail', drafts: 'Drafts', sent: 'Sent', snoozed: 'Snoozed', priority: 'Priority', 'follow-up': 'Follow up', personal: 'Personal' };
  $('#breadcrumb-view').textContent = labels[view] || 'All mail';
  $('#view-title').textContent = labels[view] === 'All mail' ? 'Inbox' : (labels[view] || 'Inbox');
  $$('.nav-item[data-view], .label-item[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  renderList();
  const items = visibleEmails();
  if (!items.some((item) => item.id === state.selectedId)) {
    state.selectedId = items[0]?.id || null;
    renderList();
    renderDetail();
  }
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2800);
}

async function regenerateDraft(email) {
  if (email.id.startsWith('demo-')) {
    toast('Connect Outlook to draft from your inbox.');
    openSettings();
    return;
  }
  const button = $('#regenerate-button');
  if (button) { button.disabled = true; button.textContent = 'Writing…'; }
  try {
    const response = await fetch(`/api/draft/${encodeURIComponent(email.id)}`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not generate a draft.');
    const index = state.emails.findIndex((item) => item.id === email.id);
    state.emails[index] = result.email;
    state.draftEdits.delete(email.id);
    renderDetail();
    renderList();
    toast('A fresh draft is ready to review.');
  } catch (error) {
    toast(error.message);
    if (button) { button.disabled = false; button.textContent = 'Try again'; }
  }
}

async function sendReply(email) {
  if (email.id.startsWith('demo-')) {
    toast('Connect Outlook to send a real reply.');
    openSettings();
    return;
  }
  const textarea = $('#draft-body');
  const draft = textarea?.value.trim() || '';
  if (!draft) { toast('Add a reply before sending.'); return; }
  const button = $('#send-button');
  if (button) { button.disabled = true; button.textContent = 'Sending…'; }
  try {
    const response = await fetch(`/api/send/${encodeURIComponent(email.id)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draft }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not send the reply.');
    const index = state.emails.findIndex((item) => item.id === email.id);
    state.emails[index] = result.email;
    state.draftEdits.delete(email.id);
    renderList();
    renderDetail();
    toast('Reply sent.');
  } catch (error) {
    toast(error.message);
    await refreshData(false);
  }
}

function openSettings() {
  $('#settings-drawer').classList.add('open');
  $('#settings-drawer').setAttribute('aria-hidden', 'false');
  $('#overlay').classList.remove('hidden');
  requestAnimationFrame(() => $('#overlay').classList.add('visible'));
}

function closeSettings() {
  $('#settings-drawer').classList.remove('open');
  $('#settings-drawer').setAttribute('aria-hidden', 'true');
  $('#overlay').classList.remove('visible');
  setTimeout(() => $('#overlay').classList.add('hidden'), 210);
}

async function loadData() {
  await refreshData(true);
}

async function refreshData(syncMailbox = false, quiet = true) {
  if (state.refreshing) return;
  const wasConnected = state.status.outlookConnected;
  state.refreshing = true;
  updateStatus();
  let succeeded = false;
  try {
    const statusResponse = await fetch('/api/status', { cache: 'no-store' });
    if (!statusResponse.ok) throw new Error('Server unavailable');
    state.status = await statusResponse.json();
    if ((syncMailbox || (!wasConnected && state.status.outlookConnected)) && state.status.outlookConnected) {
      const syncResponse = await fetch('/api/sync', { method: 'POST', cache: 'no-store' });
      if (!syncResponse.ok) {
        const result = await syncResponse.json().catch(() => ({}));
        throw new Error(result.error || 'Could not sync Outlook.');
      }
    }
    const emailsResponse = await fetch('/api/emails', { cache: 'no-store' });
    if (!emailsResponse.ok) throw new Error('Could not load inbox.');
    const result = await emailsResponse.json();
    state.emails = result.emails.length ? result.emails : (state.status.outlookConnected ? [] : demoEmails);
    succeeded = true;
  } catch (error) {
    if (!quiet) toast(error.message || 'Could not refresh Outlook.');
    if (!state.status.outlookConnected) {
      state.status = { mode: 'demo', novaReady: false, outlookReady: false, outlookConnected: false, deviceAuth: null };
      state.emails = demoEmails;
    }
  } finally {
    state.refreshing = false;
  }
  const date = new Date();
  $('.inbox-heading .eyebrow').textContent = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  updateStatus();
  const currentSelectionExists = state.emails.some((email) => email.id === state.selectedId);
  if (!currentSelectionExists) state.selectedId = visibleEmails()[0]?.id || null;
  renderList();
  renderDetail();
  return succeeded;
}

async function connectOutlook() {
  const button = $('#connect-outlook');
  if (button) { button.disabled = true; button.textContent = 'Starting…'; }
  try {
    const response = await fetch('/api/outlook/connect', { method: 'POST' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Could not start Outlook sign-in.');
    toast('Use the Microsoft sign-in code shown here.');
    await refreshData(false);
  } catch (error) {
    toast(error.message);
  } finally {
    if (button) {
      button.disabled = !state.status.outlookReady || state.status.outlookConnected;
      button.textContent = state.status.outlookConnected ? 'Outlook connected' : 'Connect Outlook';
    }
  }
}

async function syncNow() {
  if (!state.status.outlookConnected) {
    openSettings();
    toast('Connect Outlook to sync your inbox.');
    return;
  }
  if (await refreshData(true, false)) toast('Outlook inbox is up to date.');
}

function setupInstallAndUpdates() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPrompt = event;
    $('#install-button').hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    state.installPrompt = null;
    $('#install-button').hidden = true;
    toast('NOVA RESPONSE installed.');
  });
  $('#install-button').addEventListener('click', async () => {
    if (!state.installPrompt) {
      toast('Use your browser menu to install NOVA RESPONSE.');
      return;
    }
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    $('#install-button').hidden = true;
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.update().catch(() => {});
      setInterval(() => registration.update().catch(() => {}), 5 * 60 * 1000);
    }).catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }
}

$$('.nav-item[data-view], .label-item[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
$$('.list-tab').forEach((button) => button.addEventListener('click', () => {
  $$('.list-tab').forEach((tab) => tab.classList.remove('selected'));
  button.classList.add('selected');
  state.filter = button.dataset.listFilter;
  renderList();
  const items = visibleEmails();
  if (!items.some((item) => item.id === state.selectedId)) {
    state.selectedId = items[0]?.id || null;
    renderList(); renderDetail();
  }
}));
$('#search-input').addEventListener('input', (event) => {
  state.query = event.target.value;
  renderList();
  const items = visibleEmails();
  if (!items.some((item) => item.id === state.selectedId)) {
    state.selectedId = items[0]?.id || null;
    renderList(); renderDetail();
  }
});
$('#filter-button').addEventListener('click', () => toast('Use the All, Unread, and Needs reply filters to narrow this inbox.'));
$('#workspace-button').addEventListener('click', openSettings);
$('#settings-open').addEventListener('click', openSettings);
$('#help-open').addEventListener('click', openSettings);
$('#empty-setup').addEventListener('click', openSettings);
$('#settings-close').addEventListener('click', closeSettings);
$('#overlay').addEventListener('click', closeSettings);
$('#compose-button').addEventListener('click', () => $('#compose-dialog').showModal());
$('#connect-outlook').addEventListener('click', connectOutlook);
$('#sync-button').addEventListener('click', syncNow);
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault(); $('#search-input').focus();
  }
  if (event.key === 'Escape') closeSettings();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshData(true);
});
setInterval(() => {
  if (document.visibilityState === 'visible') refreshData(true);
}, 60_000);
setInterval(() => {
  if (state.status.deviceAuth?.status === 'waiting' || state.status.deviceAuth?.status === 'starting') refreshData(false);
}, 2_000);
setupInstallAndUpdates();
loadData();
