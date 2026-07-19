/* =========================================================
   LA MIA PRENOTAZIONE V1.2
   ========================================================= */

const MY_BOOKING_CONFIG = {
  API_URL: "INCOLLA_QUI_L_URL_DELLA_WEB_APP",
  REQUEST_TIMEOUT: 45000
};

const myBookingState = {
  prenotazione: null,
  annullabile: false,
  impostazioni: {},
  toastTimer: null
};

const myDom = {};

document.addEventListener("DOMContentLoaded", inizializzaPagina);

async function inizializzaPagina() {
  document.querySelectorAll("[id]").forEach(el => { myDom[el.id] = el; });
  collegaEventi();
  precompilaUltimaPrenotazione();
  if (apiConfigurata()) await caricaConfigurazione();
}

function collegaEventi() {
  myDom.lookupForm.addEventListener("submit", cercaPrenotazione);
  myDom.cancelBookingBtn.addEventListener("click", annullaPrenotazione);
  myDom.searchAnotherBtn.addEventListener("click", resetRicerca);
  myDom.bookingCode.addEventListener("input", () => rimuoviErrore(myDom.bookingCode, myDom.bookingCodeError));
  myDom.bookingPhone.addEventListener("input", () => rimuoviErrore(myDom.bookingPhone, myDom.bookingPhoneError));
}

async function caricaConfigurazione() {
  try {
    const r = await richiestaGet({ action: "configurazionePubblica" });
    if (r.ok && r.impostazioni) {
      myBookingState.impostazioni = r.impostazioni;
      applicaBranding();
    }
  } catch (error) { console.warn(error); }
}

function applicaBranding() {
  const s = myBookingState.impostazioni;
  myDom.myBrandName.textContent = s.nomeLido ? `${s.nomeLido} · La mia prenotazione` : "La mia prenotazione";
  myDom.myBrandSubtitle.textContent = s.sottotitolo || "Controlla lo stato o annulla la richiesta";
  document.title = `La mia prenotazione | ${s.nomeLido || "Prenota Ombrellone"}`;
}

function precompilaUltimaPrenotazione() {
  try {
    const salvata = localStorage.getItem("ultimaPrenotazioneLido");
    if (!salvata) return;
    const dati = JSON.parse(salvata);
    if (dati.id) myDom.bookingCode.value = String(dati.id);
    if (dati.telefono) myDom.bookingPhone.value = String(dati.telefono);
  } catch (error) { console.warn(error); }
}

async function cercaPrenotazione(event) {
  event.preventDefault();
  pulisciMessaggio(myDom.lookupMessage);
  if (!validaRicerca()) return mostraMessaggio(myDom.lookupMessage, "Controlla i dati inseriti.", "error");
  if (!apiConfigurata()) return mostraMessaggio(myDom.lookupMessage, "Inserisci l’URL della Web App nel file mia-prenotazione.js.", "error");

  mostraCaricamento("Ricerca prenotazione...");
  try {
    const r = await richiestaPost({
      action: "consultaPrenotazione",
      id: myDom.bookingCode.value.trim(),
      telefono: myDom.bookingPhone.value.trim()
    });
    if (!r.ok) throw new Error(r.error || "Prenotazione non trovata.");
    myBookingState.prenotazione = r.prenotazione;
    myBookingState.annullabile = Boolean(r.annullabile);
    if (r.impostazioni) {
      myBookingState.impostazioni = r.impostazioni;
      applicaBranding();
    }
    renderizzaPrenotazione();
    mostraMessaggio(myDom.lookupMessage, "Prenotazione trovata.", "success");
  } catch (error) {
    myDom.bookingResult.classList.add("hidden");
    myBookingState.prenotazione = null;
    mostraMessaggio(myDom.lookupMessage, error.message || "Prenotazione non trovata.", "error");
  } finally { nascondiCaricamento(); }
}

function validaRicerca() {
  let valido = true;
  rimuoviErrore(myDom.bookingCode, myDom.bookingCodeError);
  rimuoviErrore(myDom.bookingPhone, myDom.bookingPhoneError);
  if (myDom.bookingCode.value.trim().length < 4) {
    mostraErrore(myDom.bookingCode, myDom.bookingCodeError, "Inserisci il codice della prenotazione.");
    valido = false;
  }
  const telefono = myDom.bookingPhone.value.replace(/\D/g, "");
  if (telefono.length < 7 || telefono.length > 15) {
    mostraErrore(myDom.bookingPhone, myDom.bookingPhoneError, "Inserisci un numero di telefono valido.");
    valido = false;
  }
  return valido;
}

function renderizzaPrenotazione() {
  const p = myBookingState.prenotazione;
  if (!p) return;
  const stato = normalizzaStato(p.stato);

  myDom.bookingResult.classList.remove("hidden", "status-in_attesa", "status-confermata", "status-annullata");
  myDom.bookingResult.classList.add(`status-${stato}`);
  myDom.resultCustomerName.textContent = p.nome ? `Prenotazione di ${p.nome}` : "La tua prenotazione";
  myDom.resultStatusBadge.className = `customer-status-badge ${stato}`;
  myDom.resultStatusBadge.textContent = etichettaStato(stato);
  myDom.statusExplanation.textContent = spiegazioneStato(stato, myBookingState.annullabile);
  myDom.resultCode.textContent = p.id || "—";
  myDom.resultDate.textContent = formattaDataItaliana(p.data);
  myDom.resultUmbrella.textContent = `N. ${p.ombrellone || "—"}`;
  myDom.resultPeople.textContent = String(p.persone || "—");
  myDom.resultNotes.textContent = p.note || "Nessuna nota";
  myDom.resultCreatedAt.textContent = p.creatoIl || "—";
  myDom.cancelArea.classList.toggle("hidden", !myBookingState.annullabile);
  aggiornaContattoWhatsApp(p);
  myDom.bookingResult.scrollIntoView({ behavior: "smooth", block: "start" });
}

function aggiornaContattoWhatsApp(p) {
  const numero = numeroWhatsApp(myBookingState.impostazioni.whatsappLido);
  if (!numero) {
    myDom.contactArea.classList.add("hidden");
    return;
  }
  const testo = `Buongiorno, chiedo informazioni sulla prenotazione ${p.id}, data ${formattaDataItaliana(p.data)}, ombrellone ${p.ombrellone}.`;
  myDom.contactWhatsappBtn.href = `https://wa.me/${numero}?text=${encodeURIComponent(testo)}`;
  myDom.contactArea.classList.remove("hidden");
}

async function annullaPrenotazione() {
  const p = myBookingState.prenotazione;
  if (!p || !myBookingState.annullabile) return;
  if (!confirm("Vuoi davvero annullare la prenotazione? L’ombrellone tornerà disponibile.")) return;

  myDom.cancelBookingBtn.disabled = true;
  mostraCaricamento("Annullamento prenotazione...");
  try {
    const r = await richiestaPost({
      action: "annullaPrenotazioneCliente",
      id: p.id,
      telefono: myDom.bookingPhone.value.trim()
    });
    if (!r.ok) throw new Error(r.error || "Annullamento non riuscito.");
    myBookingState.prenotazione = r.prenotazione;
    myBookingState.annullabile = false;
    renderizzaPrenotazione();
    mostraToast("Prenotazione annullata correttamente.", "success");
  } catch (error) { mostraToast(error.message || "Annullamento non riuscito.", "error"); }
  finally { myDom.cancelBookingBtn.disabled = false; nascondiCaricamento(); }
}

function resetRicerca() {
  myBookingState.prenotazione = null;
  myBookingState.annullabile = false;
  myDom.bookingResult.classList.add("hidden");
  myDom.lookupForm.reset();
  pulisciMessaggio(myDom.lookupMessage);
  myDom.bookingCode.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function apiConfigurata() {
  return typeof MY_BOOKING_CONFIG.API_URL === "string" &&
    MY_BOOKING_CONFIG.API_URL.startsWith("https://script.google.com/macros/s/") &&
    MY_BOOKING_CONFIG.API_URL.endsWith("/exec");
}

async function richiestaGet(parametri) {
  const url = new URL(MY_BOOKING_CONFIG.API_URL);
  Object.entries(parametri).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  url.searchParams.set("_", Date.now().toString());
  return eseguiRichiesta(url.toString(), { method: "GET", cache: "no-store", redirect: "follow" });
}

async function richiestaPost(dati) {
  return eseguiRichiesta(MY_BOOKING_CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(dati),
    cache: "no-store",
    redirect: "follow"
  });
}

async function eseguiRichiesta(url, opzioni) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MY_BOOKING_CONFIG.REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { ...opzioni, signal: controller.signal });
    const testo = await response.text();
    if (!response.ok) throw new Error(`Errore del server (${response.status}).`);
    try { return JSON.parse(testo); } catch { throw new Error("Il server non ha restituito una risposta valida."); }
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Il collegamento al server ha impiegato troppo tempo.");
    throw error;
  } finally { clearTimeout(timer); }
}

function mostraErrore(campo, errore, messaggio) { campo.classList.add("invalid"); campo.setAttribute("aria-invalid", "true"); errore.textContent = messaggio; }
function rimuoviErrore(campo, errore) { campo.classList.remove("invalid"); campo.removeAttribute("aria-invalid"); errore.textContent = ""; }
function mostraMessaggio(el, testo, tipo = "") { el.textContent = testo; el.classList.remove("success", "error", "warning"); if (tipo) el.classList.add(tipo); }
function pulisciMessaggio(el) { mostraMessaggio(el, ""); }
function mostraCaricamento(testo) { myDom.loadingText.textContent = testo; myDom.loadingOverlay.classList.remove("hidden"); }
function nascondiCaricamento() { myDom.loadingOverlay.classList.add("hidden"); }
function mostraToast(messaggio, tipo = "info") {
  clearTimeout(myBookingState.toastTimer);
  myDom.toast.classList.remove("hidden", "success", "error", "warning");
  myDom.toast.classList.add(tipo);
  myDom.toastIcon.textContent = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" }[tipo] || "ℹ️";
  myDom.toastMessage.textContent = messaggio;
  myBookingState.toastTimer = setTimeout(() => myDom.toast.classList.add("hidden"), 4500);
}

function normalizzaStato(v) { return String(v || "").trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_"); }
function etichettaStato(v) { return { in_attesa: "In attesa", confermata: "Confermata", annullata: "Annullata" }[normalizzaStato(v)] || v; }
function spiegazioneStato(stato, annullabile) {
  if (stato === "confermata") return annullabile ? "Il lido ha confermato la prenotazione. Puoi ancora annullarla online." : "Il lido ha confermato la prenotazione.";
  if (stato === "annullata") return "La prenotazione è stata annullata e l’ombrellone è tornato disponibile.";
  return annullabile ? "La richiesta è stata ricevuta ed è in attesa della conferma del lido." : "La richiesta è in attesa della conferma del lido.";
}
function formattaDataItaliana(v) { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || "—"); }
function numeroWhatsApp(v) { let n = String(v || "").replace(/\D/g, ""); if (n.startsWith("00")) n = n.slice(2); if (n.length === 10 && n.startsWith("3")) n = "39" + n; return n; }
