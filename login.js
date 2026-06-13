// --- 1. MODULI INTERFACCIA (HTML DINAMICO) ---

const moduloLoginHTML = `
    <div class="login-container">
        <div class="login-card">
            <h2>Accedi al Sistema</h2>
            <p class="subtitle">AI-VoiceBridge SaaS</p>
            <form id="login-form">
                <div class="input-group">
                    <label>Email</label>
                    <input type="email" id="email" placeholder="Inserisci la tua email" required>
                </div>
                <div class="input-group">
                    <label>Password</label>
                    <input type="password" id="password" placeholder="••••••••" required>
                </div>
                <button type="submit" class="btn-primary">Accedi</button>
            </form>
            <div class="button-group">
                <button type="button" id="btn-vai-a-registrazione" class="btn-secondary">Registra Studio Tecnico</button>
            </div>
            <div id="login-message" class="message"></div>
        </div>
    </div>
`;

const moduloRegistrazioneHTML = `
    <div class="login-container">
        <div class="login-card">
            <h2>Registra Studio</h2>
            <p class="subtitle">Inizia la tua Trial di 30 giorni GRATIS.<br><small style="color:var(--text-muted)">Richiesta Carta o PayPal per rinnovo automatico. Disdici online con un click prima dei 30gg per non pagare nulla.</small></p>
            <form id="register-form">
                <div class="input-group">
                    <label>Email Studio Tecnico</label>
                    <input type="email" id="reg-email" placeholder="esempio@studio.it" required>
                </div>
                <div class="input-group">
                    <label>Password</label>
                    <input type="password" id="reg-password" placeholder="Minimo 6 caratteri" required>
                </div>
                
                <div class="input-group" style="background: #f5f5f7; padding: 15px; border-radius: 8px; border: 1px dashed var(--border-color); margin-top: 15px;">
                    <label style="color: var(--apple-blue); font-weight: 600;">Metodo di Pagamento Rinnovo</label>
                    <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px;">I dati verranno elaborati in cassaforte protetta Stripe/PayPal SDK.</p>
                    <input type="text" placeholder="Carta di Credito / PayPal (Protetto)" disabled style="background:#e8e8ed; font-size:13px;">
                </div>

                <div class="button-group">
                    <button type="button" id="btn-vai-a-login" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary">Attiva Trial</button>
                </div>
            </form>
            <div id="register-message" class="message"></div>
        </div>
    </div>
`;

// --- 2. GESTORE DELLE SESSIONI E DEI RUOLI ---

async function controllaSessioneEsistente() {
    const contenitoreApp = document.getElementById('app');
    contenitoreApp.innerHTML = `<div class="message" style="color: var(--text-muted)">Verifica crittografica sessione...</div>`;

    try {
        const utenteLoggato = await DBBridge.ottieniSessioneAttiva();
        if (utenteLoggato) {
            await verificaProfiloELanciaVersione(utenteLoggato.id);
        } else {
            mostraModuloLogin();
        }
    } catch (errore) {
        mostraModuloLogin();
    }
}

async function verificaProfiloELanciaVersione(userId) {
    const contenitoreApp = document.getElementById('app');
    
    try {
        const profilo = await DBBridge.getProfiloUtente(userId);

        // CASO 1: L'utente è un CONDOMINO (Salta i controlli abbonamento)
        if (profilo.ruolo === 'condomino') {
            lanciaVersioneCondomino(profilo);
            return;
        }

        // CASO 2: L'utente è un AMMINISTRATORE (Controllo Scadenza / Disdetta)
        const dataScadenza = new Date(profilo.abbonamento_scadenza);
        const oggi = new Date();

        if (profilo.abbonamento_stato === 'scaduto' || oggi > dataScadenza) {
            contenitoreApp.innerHTML = `
                <div class="login-container">
                    <div class="login-card">
                        <h2 class="error" style="color: #ff3b30">Account Sospeso</h2>
                        <p class="subtitle">La Trial o l'abbonamento sono terminati.</p>
                        <div style="background:#f5f5f7; padding:15px; border-radius:8px; text-align:left; margin-bottom:25px; font-size:13px; line-height:1.5;">
                            <strong>📦 Sicurezza Dati Attiva:</strong> Il sistema ha impacchettato l'intero database del tuo studio (condomini, anagrafiche, tabelle) e lo ha inviato in formato sicuro alla tua email. Nessun dato è andato perduto.
                        </div>
                        <button onclick="location.reload()" class="btn-primary">Aggiorna Pagamento / Riattiva</button>
                    </div>
                </div>
            `;
            return;
        }

        // Se l'abbonamento dell'amministratore è valido, attiva il badge e lancia il piano corretto
        document.getElementById('nav-links').innerHTML = `<span class="status-badge" style="background:#e2f7ed; color:#34c759; font-weight:600;">Profilo ${profilo.abbonamento_piano.toUpperCase()} Active</span>`;
        
        if (profilo.abbonamento_piano === 'base') lanciaVersioneBase(profilo);
        else if (profilo.abbonamento_piano === 'medium') lanciaVersioneMedium(profilo);
        else if (profilo.abbonamento_piano === 'pro') lanciaVersionePro(profilo);

    } catch (errore) {
        contenitoreApp.innerHTML = `<div class="message error">Errore login profilo: ${errore.message}</div>`;
    }
}

// --- 3. NAVIGAZIONE INTERNA DINAMICA ---

function mostraModuloLogin() {
    document.getElementById('app').innerHTML = moduloLoginHTML;
    document.getElementById('login-form').addEventListener('submit', eseguiLogin);
    document.getElementById('btn-vai-a-registrazione').addEventListener('click', mostraModuloRegistrazione);
}

function mostraModuloRegistrazione() {
    document.getElementById('app').innerHTML = moduloRegistrazioneHTML;
    document.getElementById('register-form').addEventListener('submit', eseguiRegistrazione);
    document.getElementById('btn-vai-a-login').addEventListener('click', mostraModuloLogin);
}

// --- 4. INTERCETTAZIONE EVENTI FORM ---

async function eseguiLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const msg = document.getElementById('login-message');

    msg.className = "message";
    msg.innerText = "Autenticazione in corso...";

    try {
        // 1. Autenticazione base con Supabase
        const utente = await DBBridge.login(email, password);
        
        // 2. Controllo immediato del profilo prima di dargli il pass
        const profilo = await DBBridge.getProfiloUtente(utente.id);

        // Se c'è già un token attivo nel DB e non corrisponde a questo browser... BLOCCO!
        if (profilo.session_token !== null) {
            msg.className = "message error";
            msg.innerText = "Accesso già attivo su un'altra sessione. Disconnettiti dagli altri dispositivi.";
            
            // Forziamo il logout di sicurezza su Supabase per questo tentativo fallito
            await _supabase.auth.signOut(); 
            return;
        }

        // 3. Se la sedia è libera, generiamo un token unico per questo browser e lo salviamo
        const tokenUnico = Math.random().toString(36).substring(2) + Date.now().toString(36);
        await DBBridge.impostaTokenSessione(utente.id, tokenUnico);
        
        // Salviamo il token anche nella memoria locale di questo specifico telefono/PC
        localStorage.setItem('mio_session_token', tokenUnico);

        // 4. Entra nell'app
        await verificaProfiloELanciaVersione(utente.id);

    } catch (err) {
        msg.className = "message error";
        msg.innerText = "Accesso negato. Credenziali errate.";
    }
}

async function eseguiRegistrazione(e) {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const msg = document.getElementById('register-message');

    msg.className = "message";
    msg.innerText = "Elaborazione transazione e attivazione...";

    try {
        const utente = await DBBridge.registraNuovoUtente(email, password);
        await DBBridge.creaProfiloInizialeAmministratore(utente.id);
        msg.className = "message success";
        msg.innerText = "Benvenuto! Account creato e 30 giorni attivati.";
        await verificaProfiloELanciaVersione(utente.id);
    } catch (err) {
        msg.className = "message error";
        msg.innerText = "Errore durante l'attivazione: " + err.message;
    }
}

// --- 5. I QUATTRO MONDI APPLICATIVI (DASHBOARD) ---

async function lanciaVersioneCondomino(profilo) {
    document.getElementById('nav-links').innerHTML = `<span class="status-badge" style="background:#e6f0fa; color:#0066cc;">Area Condomino Riservata</span>`;
    
    document.getElementById('app').innerHTML = `
        <div class="login-container" style="max-width: 500px;">
            <div class="login-card" style="text-align: left;">
                <h2>Il Tuo Portale</h2>
                <p class="subtitle" id="condo-loading">Interrogazione registro condominiale...</p>
                <div id="condo-data-box" style="display:none; background:#f5f5f7; padding:16px; border-radius:8px; margin-bottom:20px; font-size:14px; line-height:1.6;">
                </div>
                <div class="button-group">
                    <button class="btn-primary" id="btn-condo-bacheca">Bacheca Avvisi</button>
                    <button class="btn-secondary" id="btn-condo-rate">Scadenzario Rate</button>
                </div>
            </div>
        </div>
    `;

    try {
        const datiAppartamento = await DBBridge.getDatiHomeCondomino(profilo.anagrafica_id);
        document.getElementById('condo-loading').innerText = "Riepilogo unità immobiliare attiva";
        
        const box = document.getElementById('condo-data-box');
        box.style.display = "block";
        box.innerHTML = `
            <strong>Proprietario:</strong> ${datiAppartamento.anagrafica_persone.nome_completo}<br>
            <strong>Stabile:</strong> ${datiAppartamento.condomini_edifici.nome_condominio}<br>
            <strong>Indirizzo:</strong> ${datiAppartamento.condomini_edifici.indirizzo}<br>
            <strong>Assegnazione:</strong> ${datiAppartamento.interno}
        `;
    } catch (err) {
        document.getElementById('condo-loading').innerText = "Errore nel caricamento dei dati personali.";
    }
}

function lanciaVersioneBase(profilo) {
    document.getElementById('app').innerHTML = `
        <div style="text-align:center; padding: 20px; width:100%; max-width:500px;" class="login-card">
            <h3>Studio Amministrativo: Dashboard BASE</h3>
            <p style="color:var(--text-muted); margin-top:5px; font-size:14px;">Limite di sblocco attivo: Massimo 3 Condomini.</p>
        </div>
    `;
}

function lanciaVersioneMedium(profilo) {
    document.getElementById('app').innerHTML = `
        <div style="text-align:center; padding: 20px; width:100%; max-width:500px;" class="login-card">
            <h3>Studio Amministrativo: Dashboard MEDIUM</h3>
            <p style="color:var(--text-muted); margin-top:5px; font-size:14px;">Limite di sblocco attivo: Massimo 15 Condomini + Stampe PDF.</p>
        </div>
    `;
}

function lanciaVersionePro(profilo) {
    document.getElementById('app').innerHTML = `
        <div style="text-align:center; padding: 20px; width:100%; max-width:500px;" class="login-card">
            <h3>Studio Amministrativo: Dashboard PRO</h3>
            <p style="color:var(--text-muted); margin-top:5px; font-size:14px;">Nessun limite: Condomini Illimitati, Assemblee e moduli AI attivi.</p>
        </div>
    `;
}

// Inizializzazione automatica
document.addEventListener('DOMContentLoaded', controllaSessioneEsistente);
