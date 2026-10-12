// Account page: sign in, create an account, reset a password, and manage saved files.
(function (App) {
  'use strict';

  var UI = App.UI, $ = UI.$, esc = UI.esc;
  var Account = App.Account;
  var mode = 'signin';         // 'signin' | 'signup' | 'reset'
  var current = null;          // { parsed, source } of the file loaded in this browser
  var confirmDelete = null;    // id of the saved file waiting for delete confirmation
  var renaming = null;         // id of the saved file being renamed

  var SECTIONS = ['acc-loading', 'acc-off', 'acc-unavailable', 'acc-auth', 'acc-reset', 'acc-newpass', 'acc-signed-in', 'acc-save', 'acc-files'];

  function showOnly(ids) {
    SECTIONS.forEach(function (id) { $(id).hidden = ids.indexOf(id) === -1; });
  }

  function message(id, text, isError) {
    var el = $(id);
    el.textContent = text || '';
    el.classList.toggle('error-text', !!isError);
  }

  function busy(button, on, label) {
    button.disabled = on;
    if (label) button.textContent = label;
  }

  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function fmtDay(iso) {
    if (!iso) return '–';
    var d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ---------- Signed-out forms ----------

  function setMode(m) {
    mode = m;
    var signup = m === 'signup';
    $('tab-signin').setAttribute('aria-selected', String(!signup));
    $('tab-signup').setAttribute('aria-selected', String(signup));
    $('confirm-field').hidden = !signup;
    $('password-hint').hidden = !signup;
    $('auth-password').setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
    $('auth-submit').textContent = signup ? 'Create account' : 'Sign in';
    $('h-auth').textContent = signup ? 'Create account' : 'Sign in';
    $('show-reset').hidden = signup;
    message('auth-message', '');
    render();
  }

  $('tab-signin').addEventListener('click', function () { setMode('signin'); });
  $('tab-signup').addEventListener('click', function () { setMode('signup'); });
  $('show-reset').addEventListener('click', function () {
    $('reset-email').value = $('auth-email').value;
    setMode('reset');
  });
  $('back-to-signin').addEventListener('click', function () { setMode('signin'); });

  $('toggle-password').addEventListener('click', function () {
    var input = $('auth-password');
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('auth-confirm').type = input.type;
    this.textContent = show ? 'Hide' : 'Show';
  });

  $('auth-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('auth-email').value.trim();
    var password = $('auth-password').value;
    var button = $('auth-submit');
    if (!validEmail(email)) { message('auth-message', 'Enter a valid email address.', true); return; }
    if (mode === 'signup') {
      if (password.length < 8) { message('auth-message', 'Choose a password with at least 8 characters.', true); return; }
      if (password !== $('auth-confirm').value) { message('auth-message', 'The two passwords don’t match.', true); return; }
      busy(button, true, 'Creating account…');
      Account.signUp(email, password).then(function (r) {
        busy(button, false, 'Create account');
        $('auth-password').value = $('auth-confirm').value = '';
        message('auth-message', r.needsConfirmation
          ? 'Account created. We’ve sent a confirmation link to ' + email + '. Open it, then sign in here.'
          : 'Account created and signed in.');
        if (r.needsConfirmation) setMode('signin');
      }, function (err) {
        busy(button, false, 'Create account');
        message('auth-message', err.message, true);
      });
    } else {
      if (!password) { message('auth-message', 'Enter your password.', true); return; }
      busy(button, true, 'Signing in…');
      Account.signIn(email, password).then(function () {
        busy(button, false, 'Sign in');
        $('auth-password').value = '';
        message('auth-message', '');
      }, function (err) {
        busy(button, false, 'Sign in');
        message('auth-message', err.message, true);
      });
    }
  });

  $('reset-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('reset-email').value.trim();
    var button = $('reset-submit');
    if (!validEmail(email)) { message('reset-message', 'Enter a valid email address.', true); return; }
    busy(button, true, 'Sending…');
    Account.sendReset(email).then(function () {
      busy(button, false, 'Send reset link');
      // Same message whether or not the account exists, so the form doesn't reveal who has an account.
      message('reset-message', 'If there’s an account for ' + email + ', a reset link is on its way. Check your inbox.');
    }, function (err) {
      busy(button, false, 'Send reset link');
      message('reset-message', err.message, true);
    });
  });

  $('newpass-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = $('newpass').value;
    var button = $('newpass-submit');
    if (p.length < 8) { message('newpass-message', 'Choose a password with at least 8 characters.', true); return; }
    if (p !== $('newpass-confirm').value) { message('newpass-message', 'The two passwords don’t match.', true); return; }
    busy(button, true, 'Saving…');
    Account.setNewPassword(p).then(function () {
      busy(button, false, 'Save new password');
      $('newpass').value = $('newpass-confirm').value = '';
      UI.notice('Your password has been changed.');
    }, function (err) {
      busy(button, false, 'Save new password');
      message('newpass-message', err.message, true);
    });
  });

  // ---------- Signed in ----------

  $('sign-out').addEventListener('click', function () {
    Account.signOut().catch(function (err) { UI.notice('<p class="error-text">' + esc(err.message) + '</p>'); });
  });

  function renderSave() {
    var upload = App.Site.currentUpload();
    var hasFile = current && current.source && current.source.kind === 'upload' && !current.source.temporary;
    $('save-name-field').hidden = $('save-current').hidden = !hasFile || !!(upload && upload.accountId);
    if (!hasFile) {
      $('save-text').textContent = 'No file of yours is loaded in this browser. Load one on any page, then come back here to save it.';
    } else if (upload && upload.accountId) {
      $('save-text').textContent = '“' + current.source.name + '” is already saved in your account.';
    } else {
      $('save-text').textContent = 'Save “' + current.source.name + '” so you can open it again on any device.';
      if (!$('save-name').value) $('save-name').value = current.source.name.replace(/\.json$/i, '');
    }
  }

  $('save-current').addEventListener('click', function () {
    var name = $('save-name').value.trim();
    var button = this;
    if (!name) { message('save-message', 'Give the file a name.', true); return; }
    busy(button, true, 'Saving…');
    Account.saveFile(name, current.parsed).then(function (row) {
      busy(button, false, 'Save to my account');
      App.Site.markUploadSaved(row.id);
      message('save-message', 'Saved as “' + row.name + '”.');
      renderSave();
      App.Site.refreshBanner();
      loadFiles();
    }, function (err) {
      busy(button, false, 'Save to my account');
      message('save-message', err.message, true);
    });
  });

  var files = [];

  function loadFiles() {
    message('files-message', 'Loading your files…');
    Account.listFiles().then(function (rows) {
      files = rows || [];
      message('files-message', files.length ? '' : 'You haven’t saved any files yet.');
      renderFiles();
    }, function (err) {
      message('files-message', err.message, true);
    });
  }

  function renderFiles() {
    var upload = App.Site.currentUpload();
    if (!files.length) { $('files-table').innerHTML = ''; return; }
    $('files-table').innerHTML =
      '<thead><tr><th>Name</th><th class="num">Shops</th><th>Covers</th><th>Saved</th><th class="actions-col">Actions</th></tr></thead><tbody>' +
      files.map(function (f) {
        var open = upload && upload.accountId === f.id;
        var nameCell = renaming === f.id
          ? '<input type="text" class="rename-input" id="rename-' + f.id + '" value="' + esc(f.name) + '" maxlength="200" aria-label="New name">'
          : esc(f.name) + (open ? ' <span class="badge">Open now</span>' : '');
        var actions;
        if (confirmDelete === f.id) {
          actions = '<span class="confirm-text">Delete for good?</span> ' +
            '<button type="button" class="link-btn danger" data-act="delete-yes" data-id="' + f.id + '">Delete</button> ' +
            '<button type="button" class="link-btn" data-act="cancel" data-id="' + f.id + '">Keep</button>';
        } else if (renaming === f.id) {
          actions = '<button type="button" class="link-btn" data-act="rename-save" data-id="' + f.id + '">Save name</button> ' +
            '<button type="button" class="link-btn" data-act="cancel" data-id="' + f.id + '">Cancel</button>';
        } else {
          actions = '<button type="button" class="link-btn" data-act="open" data-id="' + f.id + '">Open</button> ' +
            '<button type="button" class="link-btn" data-act="rename" data-id="' + f.id + '">Rename</button> ' +
            '<button type="button" class="link-btn" data-act="delete" data-id="' + f.id + '">Delete</button>';
        }
        return '<tr><td>' + nameCell + '</td><td class="num">' + f.shops + '</td>' +
          '<td>' + fmtDay(f.first_date) + ' – ' + fmtDay(f.last_date) + '</td>' +
          '<td>' + fmtDay(f.saved_at) + '</td><td class="actions-col">' + actions + '</td></tr>';
      }).join('') + '</tbody>';
    if (renaming) {
      var input = $('rename-' + renaming);
      if (input) { input.focus(); input.select(); }
    }
  }

  $('files-table').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var act = btn.getAttribute('data-act');
    if (act === 'open') {
      message('files-message', 'Opening…');
      Account.getFile(id).then(function (row) {
        try {
          App.Site.openSaved(row);
          location.href = 'index.html';
        } catch (err) {
          message('files-message', 'This browser couldn’t store the file, so it can’t be opened here. Try freeing browser storage.', true);
        }
      }, function (err) { message('files-message', err.message, true); });
    } else if (act === 'delete') {
      confirmDelete = id; renaming = null; renderFiles();
    } else if (act === 'delete-yes') {
      Account.deleteFile(id).then(function () {
        confirmDelete = null;
        var upload = App.Site.currentUpload();
        if (upload && upload.accountId === id) App.Site.markUploadSaved(null);
        message('files-message', 'File deleted.');
        loadFiles();
        renderSave();
        App.Site.refreshBanner();
      }, function (err) { message('files-message', err.message, true); });
    } else if (act === 'rename') {
      renaming = id; confirmDelete = null; renderFiles();
    } else if (act === 'rename-save') {
      var name = ($('rename-' + id).value || '').trim();
      if (!name) { message('files-message', 'Give the file a name.', true); return; }
      Account.renameFile(id, name).then(function () {
        renaming = null;
        message('files-message', 'Renamed to “' + name + '”.');
        loadFiles();
      }, function (err) { message('files-message', err.message, true); });
    } else if (act === 'cancel') {
      confirmDelete = null; renaming = null; renderFiles();
    }
  });

  $('files-table').addEventListener('keydown', function (e) {
    if (!e.target.classList.contains('rename-input')) return;
    if (e.key === 'Enter') { e.preventDefault(); $('files-table').querySelector('[data-act="rename-save"]').click(); }
    if (e.key === 'Escape') { renaming = null; renderFiles(); }
  });

  // ---------- Which view to show ----------

  var lastUserId = null;

  function render() {
    var status = Account.status();
    if (status === 'off') { showOnly(['acc-off']); return; }
    if (status === 'unavailable') { showOnly(['acc-unavailable']); return; }
    var st = Account.state();
    if (!st.ready) { showOnly(['acc-loading']); return; }
    if (st.recovery) { showOnly(['acc-newpass']); return; }
    if (!st.user) {
      lastUserId = null;
      showOnly([mode === 'reset' ? 'acc-reset' : 'acc-auth']);
      return;
    }
    showOnly(['acc-signed-in', 'acc-save', 'acc-files']);
    $('account-email').textContent = st.user.email || '';
    renderSave();
    if (lastUserId !== st.user.id) { lastUserId = st.user.id; loadFiles(); }
  }

  Account.onChange(function () { render(); });

  App.Site.init(function (s, ctx) {
    current = s ? { parsed: ctx.parsed, source: ctx.source } : null;
    render();
  }, { dataOptional: true });
})(window.App);
