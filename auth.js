async _doLogin() {
    const sb = await getSupabase();
    if (!sb) return Auth._showError('login', 'Service unavailable. Please try again.');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        return Auth._showError('login', 'Please enter your email and password.');
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin-auth"></i> Signing in…';

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Sign In';

    if (error) {
        return Auth._showError('login', _friendlyError(error.message));
    }

    // NEW: Store the token for API requests
    if (data && data.session && data.session.access_token) {
        localStorage.setItem('supabase_token', data.session.access_token);
    }

    _currentUser = data.user;
    Auth._updateNav(data.user);
    Auth.closeModal();
}