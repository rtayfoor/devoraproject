// components.js - Global Header and Footer Components

let _supabase = null;
let supabaseInitialized = false;

async function getSupabaseClient() {
    if (_supabase) return _supabase;
    if (supabaseInitialized) return _supabase;
    
    try {
        console.log('📡 Fetching Supabase config from /api/supabase/config...');
        const response = await fetch('/api/supabase/config');
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Server returned error:', response.status, errorText);
            throw new Error(`Server error: ${response.status}`);
        }
        
        const config = await response.json();
        console.log('📡 Config received:', config);
        
        if (!config.supabaseUrl) {
            throw new Error('supabaseUrl is required but got: ' + JSON.stringify(config));
        }
        
        if (!config.supabaseAnonKey) {
            throw new Error('supabaseAnonKey is required but got: ' + JSON.stringify(config));
        }
        
        if (window.supabase) {
            _supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            supabaseInitialized = true;
            console.log('✅ Supabase client initialized successfully');
        } else {
            throw new Error('Supabase SDK not loaded (window.supabase is undefined)');
        }
        
        return _supabase;
    } catch (error) {
        console.error('❌ Failed to get Supabase client:', error.message);
        supabaseInitialized = true;
        return null;
    }
}

// ... rest of your components.js code (header, footer, etc.)