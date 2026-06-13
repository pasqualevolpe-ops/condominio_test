// CONFIGURAZIONE DEL DATABASE REAL-TIME
const DB_URL = "https://zwexcvpvrgvjsxhubyzi.supabase.co"; 
const DB_KEY = "sb_publishable_eJCKxuY4IMYaMcm1RZS0mA_MeFE9dYw";

// Inizializzazione del client Supabase
const _supabase = supabase.createClient(DB_URL, DB_KEY);


// PONTE UNICO: FUNZIONI ASTRATTE CHE GLI ALTRI JS CHIAMERANNO
const DBBridge = {
    // Aggiorna il token di sessione nel DB quando l'utente entra
    async impostaTokenSessione(userId, token) {
        const { error } = await _supabase
            .from('profili_utenti')
            .update({ session_token: token })
            .eq('user_id', userId);
        if (error) throw error;
    },

    // Cancella il token (Libera la sessione al logout o dopo un timeout)
    async svuotaTokenSessione(userId) {
        const { error } = await _supabase
            .from('profili_utenti')
            .update({ session_token: null })
            .eq('user_id', userId);
        if (error) throw error;
        await _supabase.auth.signOut(); // Scollega anche l'autenticazione di Supabase
    },
	
    // Controlla se il browser ricorda l'utente (Sessione attiva)
    async ottieniSessioneAttiva() {
        const { data: { session }, error } = await _supabase.auth.getSession();
        if (error) throw error;
        return session ? session.user : null;
    },

    // Funzione per fare il Login
    async login(email, password) {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data.user;
    },

    // Funzione per la registrazione autonoma di un Amministratore (Auth)
    async registraNuovoUtente(email, password) {
        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) throw error;
        return data.user;
    },

    // Crea in automatico la riga profilo dell'amministratore appena registrato in Trial
    async creaProfiloInizialeAmministratore(userId) {
        const { data: nuovoAdmin, error: errAdmin } = await _supabase
            .from('amministratori')
            .insert([{ nome: 'Nuovo Studio Amministrativo', email: 'in attesa...' }])
            .select()
            .single();

        if (errAdmin) throw errAdmin;

        const { data, error } = await _supabase
            .from('profili_utenti')
            .insert([
                { 
                    user_id: userId, 
                    ruolo: 'amministratore', 
                    amministratore_id: nuovoAdmin.id,
                    abbonamento_piano: 'base',
                    abbonamento_stato: 'trial'
                }
            ]);

        if (error) throw error;
        return data;
    },

    // Recupera il profilo completo di chiunque faccia il login (Ruolo, Piano, Scadenza)
    async getProfiloUtente(userId) {
        const { data, error } = await _supabase
            .from('profili_utenti')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error) throw error;
        return data;
    },

    // ISOLAMENTO CONDOMINO: Recupera i dati specifici dell'appartamento del condomino loggato
    async getDatiHomeCondomino(anagraficaId) {
        const { data, error } = await _supabase
            .from('unita_immobiliari')
            .select(`
                interno,
                condomini_edifici ( nome_condominio, indirizzo ),
                anagrafica_persone ( nome_completo )
            `)
            .eq('anagrafica_id', anagraficaId)
            .single();

        if (error) throw error;
        return data;
    },

    // AMMINISTRATORE: Recupera l'elenco dei condomini gestiti
    async getCondominiAmministratore(amministratoreId) {
        const { data, error } = await _supabase
            .from('condomini_edifici')
            .select('*')
            .eq('amministratore_id', amministratoreId);
        if (error) throw error;
        return data;
    }
};
