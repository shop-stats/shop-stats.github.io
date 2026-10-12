// Accounts: email/password sign-in and per-person saved files, through Supabase (see js/config.js and
// supabase/setup.sql). Passwords are handled entirely by Supabase; this file never stores them.
// Every page loads this; when sign-in isn't set up or can't load, App.Account.status() says why
// and the rest of the site works as normal.
(function (App) {
  'use strict';

  var TABLE = 'saved_files';
  var client = null;
  var state = { ready: false, user: null, recovery: false };
  var listeners = [];

  function configured() {
    return !!(App.CONFIG && App.CONFIG.supabaseUrl && App.CONFIG.supabaseAnonKey);
  }

  // 'off' (not set up), 'unavailable' (library didn't load, e.g. offline) or 'ready'.
  function status() {
    if (!configured()) return 'off';
    if (!window.supabase || typeof window.supabase.createClient !== 'function') return 'unavailable';
    return 'ready';
  }

  function emit(event) {
    listeners.forEach(function (fn) { try { fn(state, event); } catch (e) { /* a broken listener mustn't stop the others */ } });
  }

  function init() {
    if (client || status() !== 'ready') return client;
    client = window.supabase.createClient(App.CONFIG.supabaseUrl, App.CONFIG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'tesco-auth' }
    });
    client.auth.getSession().then(function (r) {
      state.user = r.data && r.data.session ? r.data.session.user : null;
      state.ready = true;
      emit('INITIAL');
    }, function () {
      state.ready = true;
      emit('INITIAL');
    });
    client.auth.onAuthStateChange(function (event, session) {
      state.user = session ? session.user : null;
      if (event === 'PASSWORD_RECOVERY') state.recovery = true;
      state.ready = true;
      emit(event);
    });
    return client;
  }

  // Calls fn(state, event) now and on every sign-in change.
  function onChange(fn) {
    listeners.push(fn);
    fn(state, 'CURRENT');
  }

  // The address Supabase links back to from emails (confirm address, reset password).
  function returnUrl() {
    if (!/^https?:$/.test(location.protocol)) return undefined; // opened from disk: use the project's Site URL
    return location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '') + 'account.html';
  }

  // Turns Supabase errors into plain sentences.
  function friendly(error) {
    var msg = (error && error.message) || String(error || '');
    if (/invalid login credentials/i.test(msg)) return 'That email and password don’t match an account. Check them and try again.';
    if (/email not confirmed/i.test(msg)) return 'Confirm your email address first, using the link we sent you, then sign in.';
    if (/user already registered|already been registered/i.test(msg)) return 'An account with that email already exists. Sign in instead, or reset your password.';
    if (/password should be at least|weak password/i.test(msg)) return 'Choose a longer password (at least 8 characters).';
    if (/rate limit|too many requests|security purposes/i.test(msg)) return 'Too many attempts. Wait a minute and try again.';
    if (/failed to fetch|network/i.test(msg)) return 'Couldn’t reach the sign-in service. Check your internet connection and try again.';
    if (/json|unexpected token|invalid api key|no api key/i.test(msg)) return 'The sign-in service didn’t answer properly. Check the Supabase URL and anon key in js/config.js.';
    if (/relation .* does not exist|could not find the table/i.test(msg)) return 'The saved-files table hasn’t been created yet. Run supabase/setup.sql in your Supabase project.';
    return msg || 'Something went wrong. Try again.';
  }

  function need() {
    if (!init()) throw new Error(status() === 'off' ? 'Sign-in isn’t set up on this site.' : 'Sign-in couldn’t load. Check your internet connection.');
    return client;
  }

  function wrap(promise) {
    return promise.then(function (r) {
      if (r && r.error) throw new Error(friendly(r.error));
      return r ? r.data : r;
    }, function (e) { throw new Error(friendly(e)); });
  }

  // ---------- Auth ----------

  function signUp(email, password) {
    return wrap(need().auth.signUp({ email: email, password: password, options: { emailRedirectTo: returnUrl() } }))
      .then(function (data) { return { needsConfirmation: !(data && data.session) }; });
  }

  function signIn(email, password) {
    return wrap(need().auth.signInWithPassword({ email: email, password: password }));
  }

  function signOut() {
    return wrap(need().auth.signOut());
  }

  function sendReset(email) {
    return wrap(need().auth.resetPasswordForEmail(email, { redirectTo: returnUrl() }));
  }

  function setNewPassword(password) {
    return wrap(need().auth.updateUser({ password: password })).then(function (d) {
      state.recovery = false;
      emit('PASSWORD_UPDATED');
      return d;
    });
  }

  // ---------- Saved files ----------

  function dateOnly(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function listFiles() {
    return wrap(need().from(TABLE).select('id,name,saved_at,shops,first_date,last_date').order('saved_at', { ascending: false }));
  }

  // Saves a parsed file (as the compact copy) under a name. Returns the new row's id and name.
  function saveFile(name, parsed) {
    var b = parsed.baskets;
    var row = {
      name: String(name || 'Purchase history').slice(0, 200),
      shops: b.length,
      first_date: dateOnly(b[0].date),
      last_date: dateOnly(b[b.length - 1].date),
      data: App.Parser.pack(parsed)
    };
    return wrap(need().from(TABLE).insert(row).select('id,name').single());
  }

  function getFile(id) {
    return wrap(need().from(TABLE).select('id,name,data').eq('id', id).single());
  }

  function renameFile(id, name) {
    return wrap(need().from(TABLE).update({ name: String(name).slice(0, 200) }).eq('id', id));
  }

  function deleteFile(id) {
    return wrap(need().from(TABLE).delete().eq('id', id));
  }

  init();

  App.Account = {
    status: status,
    onChange: onChange,
    state: function () { return state; },
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    sendReset: sendReset,
    setNewPassword: setNewPassword,
    listFiles: listFiles,
    saveFile: saveFile,
    getFile: getFile,
    renameFile: renameFile,
    deleteFile: deleteFile
  };
})(window.App);
