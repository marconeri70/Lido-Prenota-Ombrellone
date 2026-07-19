/* =========================================================
   PRENOTA OMBRELLONE - APP CLIENTE V1.2
   ========================================================= */

const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxImGmbQ-AYdFAgEmyPOSbm1p_2H-C3i7JppvgTiyf7pkRk9U4cvlIkFmYPR4dO0QWgYA/exec",
  REQUEST_TIMEOUT: 45000
};

const state = {
  impostazioni: {
    nomeLido: "Prenota Ombrellone",
    sottotitolo: "La tua giornata al mare comincia qui",
    giorniChiusi: [],
    dateChiuse: [],
    maxPersone: 6,
    emailClienteObbligatoria: false,
    confermaAutomatica: false,
    minDate: oggiFormatoInput(),
    maxDate: ""
  },
  ombrelloni: [],
  disponibilita: [],
  dataSelezionata: "",
  ombrelloneSelezionato: null,
  toastTimer: null
};

const dom = {};

document.addEventListener("DOMContentLoaded", inizializzaApp);

async function inizializzaApp() {
  recuperaElementiDOM();
  collegaEventi();
  aggiornaContatoreNote();
  dom.bookingDate.value = oggiFormatoInput();

  if (apiConfigurata()) {
    await caricaConfigurazione();
  } else {
    applicaConfigurazione();
  }
}

function recuperaElementiDOM() {
  const ids = [
    "loadingOverlay", "loadingText", "brandName", "brandSubtitle",
    "heroMessage", "publicInfoBox", "publicInfoText", "dateRulesText",
    "footerBrandName", "bookingDate", "loadAvailabilityBtn", "dateMessage",
    "umbrellaSection", "umbrellaMap", "emptyUmbrellaMessage", "umbrellaMessage",
    "selectionSummary", "selectedUmbrellaText", "changeUmbrellaBtn",
    "bookingSection", "bookingForm", "selectedUmbrellaId", "selectedUmbrellaNumber",
    "customerName", "customerPhone", "customerEmail", "numberOfPeople",
    "arrivalTime", "bookingNotes", "notesCounter", "privacyConsent",
    "customerNameError", "customerPhoneError", "customerEmailError",
    "numberOfPeopleError", "privacyConsentError", "emailRequiredMark",
    "recapDate", "recapUmbrella", "submitBookingBtn", "submitButtonText",
    "bookingInformation", "bookingFormMessage", "successModal",
    "successModalTitle", "successModalMessage", "successBookingId",
    "successBookingDate", "successUmbrella", "successBookingStatus",
    "newBookingBtn", "toast", "toastIcon", "toastMessage"
  ];

  ids.forEach(id => { dom[id] = document.getElementById(id); });
}

function collegaEventi() {
  dom.loadAvailabilityBtn.addEventListener("click", caricaDisponibilita);

  dom.bookingDate.addEventListener("change", () => {
    azzeraSelezioneOmbrellone();
    nascondiRisultati();
    pulisciMessaggio(dom.dateMessage);
  });

  dom.changeUmbrellaBtn.addEventListener("click", () => {
    azzeraSelezioneOmbrellone();
    dom.umbrellaSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  dom.bookingNotes.addEventListener("input", aggiornaContatoreNote);

  [
    [dom.customerName, dom.customerNameError],
    [dom.customerPhone, dom.customerPhoneError],
    [dom.customerEmail, dom.customerEmailError],
    [dom.numberOfPeople, dom.numberOfPeopleError]
  ].forEach(([campo, errore]) => {
    campo.addEventListener("input", () => rimuoviErroreCampo(campo, errore));
  });

  dom.privacyConsent.addEventListener("change", () => {
    dom.privacyConsentError.textContent = "";
  });

  dom.bookingForm.addEventListener("submit", inviaPrenotazione);
  dom.newBookingBtn.addEventListener("click", nuovaPrenotazione);

  const backdrop = dom.successModal.querySelector(".modal-backdrop");
  if (backdrop) backdrop.addEventListener("click", chiudiModale);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !dom.successModal.classList.contains("hidden")) {
      chiudiModale();
    }
  });
}

/* =========================================================
   CONFIGURAZIONE PUBBLICA
   ========================================================= */

async function caricaConfigurazione() {
  try {
    const risposta = await richiestaGet({ action: "configurazionePubblica" });
    if (risposta.ok && risposta.impostazioni) {
      state.impostazioni = Object.assign({}, state.impostazioni, risposta.impostazioni);
    }
  } catch (error) {
    console.warn("Configurazione non caricata:", error);
  } finally {
    applicaConfigurazione();
  }
}

function applicaConfigurazione() {
  const s = state.impostazioni;

  dom.brandName.textContent = s.nomeLido || "Prenota Ombrellone";
  dom.footerBrandName.textContent = s.nomeLido || "Prenota Ombrellone";
  dom.brandSubtitle.textContent = s.sottotitolo || "La tua giornata al mare comincia qui";
  dom.heroMessage.textContent = s.messaggioHome || "Seleziona la data e scegli un ombrellone libero.";
  dom.bookingInformation.textContent = s.messaggioInformativo || "La prenotazione non prevede alcun pagamento online.";
  document.title = `${s.nomeLido || "Prenota Ombrellone"} | Prenotazioni`;

  if (s.messaggioInformativo) {
    dom.publicInfoText.textContent = s.messaggioInformativo;
    dom.publicInfoBox.classList.remove("hidden");
  }

  dom.bookingDate.min = s.minDate || oggiFormatoInput();
  if (s.maxDate) dom.bookingDate.max = s.maxDate;

  const dataCorrente = dom.bookingDate.value;
  if (!dataCorrente || dataCorrente < dom.bookingDate.min) {
    dom.bookingDate.value = dom.bookingDate.min;
  }
  if (dom.bookingDate.max && dom.bookingDate.value > dom.bookingDate.max) {
    dom.bookingDate.value = dom.bookingDate.max;
  }

  const maxPersone = Math.max(1, Number(s.maxPersone || 6));
  dom.numberOfPeople.max = String(maxPersone);
  if (Number(dom.numberOfPeople.value) > maxPersone) dom.numberOfPeople.value = String(maxPersone);

  const emailObbligatoria = Boolean(s.emailClienteObbligatoria);
  dom.customerEmail.required = emailObbligatoria;
  dom.emailRequiredMark.classList.toggle("hidden", !emailObbligatoria);

  dom.dateRulesText.textContent = costruisciTestoRegole();
}

function costruisciTestoRegole() {
  const s = state.impostazioni;
  const parti = [];

  if (s.minDate && s.maxDate) {
    parti.push(`Prenotabile dal ${formattaDataItaliana(s.minDate)} al ${formattaDataItaliana(s.maxDate)}`);
  }

  const chiusi = (s.giorniChiusi || []).map(nomeGiorno).filter(Boolean);
  if (chiusi.length) parti.push(`Chiuso: ${chiusi.join(", ")}`);

  return parti.join(" · ");
}

/* =========================================================
   DISPONIBILITÀ
   ========================================================= */

async function caricaDisponibilita() {
  const data = dom.bookingDate.value;
  pulisciMessaggio(dom.dateMessage);
  pulisciMessaggio(dom.umbrellaMessage);
  pulisciMessaggio(dom.bookingFormMessage);

  const erroreLocale = validaDataLocale(data);
  if (erroreLocale) {
    mostraMessaggio(dom.dateMessage, erroreLocale, "error");
    return;
  }

  if (!apiConfigurata()) {
    mostraMessaggio(dom.dateMessage, "Inserisci in app.js l’URL della Web App di Google Apps Script.", "error");
    return;
  }

  state.dataSelezionata = data;
  azzeraSelezioneOmbrellone();
  mostraCaricamento("Controllo disponibilità...");

  try {
    /*
      Un'unica richiesta riduce i tempi di avvio di Google Apps Script
      ed evita due esecuzioni contemporanee dello stesso backend.
    */
    const risposta = await richiestaGet({
      action: "mappa",
      data
    });

    if (!risposta.ok) {
      throw new Error(
        risposta.error || "Impossibile caricare la disponibilità."
      );
    }

    state.ombrelloni = Array.isArray(risposta.ombrelloni)
      ? risposta.ombrelloni
      : [];

    state.disponibilita = Array.isArray(risposta.disponibilita)
      ? risposta.disponibilita
      : [];

    renderizzaMappa();
    dom.umbrellaSection.classList.remove("hidden");
    mostraMessaggio(dom.dateMessage, `Disponibilità aggiornata per ${formattaDataItaliana(data)}.`, "success");
    dom.umbrellaSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    nascondiRisultati();
    mostraMessaggio(dom.dateMessage, error.message || "Errore durante il caricamento.", "error");
    mostraToast("Non è stato possibile collegarsi al database del lido.", "error");
  } finally {
    nascondiCaricamento();
  }
}

function validaDataLocale(data) {
  if (!data) return "Seleziona una data.";
  const s = state.impostazioni;
  if (s.minDate && data < s.minDate) return "La data selezionata non rispetta l’anticipo minimo.";
  if (s.maxDate && data > s.maxDate) return "La data selezionata supera il limite di prenotazione.";
  if ((s.dateChiuse || []).includes(data)) return "Il lido è chiuso eccezionalmente in questa data.";
  if ((s.giorniChiusi || []).map(String).includes(String(giornoSettimanaIso(data)))) return "Il lido è chiuso in questo giorno della settimana.";
  return "";
}

function renderizzaMappa() {
  dom.umbrellaMap.innerHTML = "";
  dom.emptyUmbrellaMessage.classList.add("hidden");
  dom.umbrellaMap.classList.remove("hidden");

  if (!state.ombrelloni.length) {
    dom.umbrellaMap.classList.add("hidden");
    dom.emptyUmbrellaMessage.classList.remove("hidden");
    return;
  }

  const ordinati = [...state.ombrelloni].sort((a, b) => {
    const zona = String(a.zona || "").localeCompare(String(b.zona || ""), "it", { numeric: true });
    if (zona) return zona;
    const fila = String(a.fila || "").localeCompare(String(b.fila || ""), "it", { numeric: true });
    if (fila) return fila;
    return String(a.numero || a.id || "").localeCompare(String(b.numero || b.id || ""), "it", { numeric: true });
  });

  let ultimaZona = null;
  let ultimaFila = null;
  let disponibili = 0;

  ordinati.forEach(ombrellone => {
    const zona = String(ombrellone.zona || "Zona unica").trim();
    const fila = String(ombrellone.fila || "").trim();

    if (zona !== ultimaZona) {
      ultimaZona = zona;
      ultimaFila = null;
      const titolo = document.createElement("div");
      titolo.className = "zone-title";
      titolo.textContent = zona;
      dom.umbrellaMap.appendChild(titolo);
    }

    if (fila && fila !== ultimaFila) {
      ultimaFila = fila;
      const titolo = document.createElement("div");
      titolo.className = "umbrella-row-title";
      titolo.textContent = `Fila ${fila}`;
      dom.umbrellaMap.appendChild(titolo);
    }

    const stato = determinaStatoOmbrellone(ombrellone);
    if (stato === "available") disponibili++;
    dom.umbrellaMap.appendChild(creaPulsanteOmbrellone(ombrellone, stato));
  });

  if (disponibili === 0) {
    mostraMessaggio(dom.umbrellaMessage, "Per questa data non ci sono ombrelloni liberi.", "warning");
  } else {
    mostraMessaggio(dom.umbrellaMessage, `${disponibili} ombrellon${disponibili === 1 ? "e libero" : "i liberi"}.`, "success");
  }
}

function creaPulsanteOmbrellone(ombrellone, stato) {
  const button = document.createElement("button");
  const numero = String(ombrellone.numero || ombrellone.id || "—");
  const fila = String(ombrellone.fila || "").trim();
  const dettaglio = trovaDisponibilitaOmbrellone(ombrellone);

  button.type = "button";
  button.className = `umbrella ${stato}`;
  button.dataset.id = String(ombrellone.id || "");
  button.setAttribute("aria-label", `Ombrellone ${numero}${fila ? `, fila ${fila}` : ""}: ${descrizioneStato(stato)}`);

  const numeroEl = document.createElement("span");
  numeroEl.className = "umbrella-number";
  numeroEl.textContent = `N. ${numero}`;

  const infoEl = document.createElement("span");
  infoEl.className = "umbrella-info";
  infoEl.textContent = dettaglio && dettaglio.motivo ? dettaglio.motivo : descrizioneStato(stato);

  button.append(numeroEl, infoEl);

  if (stato === "available") {
    button.addEventListener("click", () => selezionaOmbrellone(ombrellone, button));
  } else {
    button.disabled = true;
  }

  return button;
}

function determinaStatoOmbrellone(ombrellone) {
  if (normalizzaTesto(ombrellone.stato) !== "attivo") return "blocked";

  const dettaglio = trovaDisponibilitaOmbrellone(ombrellone);
  if (!dettaglio) return "available";

  const stato = normalizzaTesto(dettaglio.stato);
  if (stato === "in_attesa") return "pending";
  if (stato === "confermata") return "occupied";
  if (stato === "bloccato_data") return "blocked";
  return "occupied";
}

function trovaDisponibilitaOmbrellone(ombrellone) {
  const id = String(ombrellone.id || "").trim();
  const numero = String(ombrellone.numero || "").trim();
  return state.disponibilita.find(item => {
    const valore = String(item.ombrellone || "").trim();
    return valore === id || valore === numero;
  });
}

/* =========================================================
   SELEZIONE E MODULO
   ========================================================= */

function selezionaOmbrellone(ombrellone, button) {
  document.querySelectorAll(".umbrella.selected").forEach(el => {
    el.classList.remove("selected");
    el.classList.add("available");
    const info = el.querySelector(".umbrella-info");
    if (info) info.textContent = "Libero";
  });

  button.classList.remove("available");
  button.classList.add("selected");
  const info = button.querySelector(".umbrella-info");
  if (info) info.textContent = "Selezionato";

  state.ombrelloneSelezionato = ombrellone;
  const numero = String(ombrellone.numero || ombrellone.id || "—");
  const dettagli = [
    `Ombrellone ${numero}`,
    ombrellone.fila ? `fila ${ombrellone.fila}` : "",
    ombrellone.zona || ""
  ].filter(Boolean);

  dom.selectedUmbrellaId.value = String(ombrellone.id || numero);
  dom.selectedUmbrellaNumber.value = numero;
  dom.selectedUmbrellaText.textContent = dettagli.join(" · ");
  dom.recapDate.textContent = formattaDataItaliana(state.dataSelezionata);
  dom.recapUmbrella.textContent = dettagli.join(" · ");
  dom.selectionSummary.classList.remove("hidden");
  dom.bookingSection.classList.remove("hidden");

  setTimeout(() => dom.bookingSection.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}

function azzeraSelezioneOmbrellone() {
  state.ombrelloneSelezionato = null;
  dom.selectedUmbrellaId.value = "";
  dom.selectedUmbrellaNumber.value = "";
  dom.selectedUmbrellaText.textContent = "Nessun ombrellone";
  dom.recapUmbrella.textContent = "—";
  dom.selectionSummary.classList.add("hidden");
  dom.bookingSection.classList.add("hidden");
}

function nascondiRisultati() {
  dom.umbrellaSection.classList.add("hidden");
  dom.selectionSummary.classList.add("hidden");
  dom.bookingSection.classList.add("hidden");
  dom.umbrellaMap.innerHTML = "";
}

async function inviaPrenotazione(event) {
  event.preventDefault();
  pulisciMessaggio(dom.bookingFormMessage);

  if (!state.ombrelloneSelezionato) {
    mostraMessaggio(dom.bookingFormMessage, "Seleziona prima un ombrellone libero.", "error");
    return;
  }

  if (!validaModulo()) {
    mostraMessaggio(dom.bookingFormMessage, "Controlla i campi evidenziati.", "error");
    return;
  }

  const numeroOmbrellone = String(state.ombrelloneSelezionato.numero || state.ombrelloneSelezionato.id || "");
  const identificativo = String(state.ombrelloneSelezionato.id || numeroOmbrellone);
  const note = [];
  if (dom.arrivalTime.value) note.push(`Arrivo previsto: ${dom.arrivalTime.value}`);
  if (dom.bookingNotes.value.trim()) note.push(dom.bookingNotes.value.trim());

  const payload = {
    action: "prenota",
    data: state.dataSelezionata,
    ombrellone: identificativo,
    numeroOmbrellone,
    nome: dom.customerName.value.trim(),
    telefono: dom.customerPhone.value.trim(),
    email: dom.customerEmail.value.trim(),
    persone: Number(dom.numberOfPeople.value),
    note: note.join(" - ")
  };

  impostaInvioInCorso(true);
  mostraCaricamento("Invio prenotazione...");

  try {
    const risposta = await richiestaPost(payload);
    if (!risposta.ok) throw new Error(risposta.error || "Prenotazione non registrata.");

    salvaUltimaPrenotazione({ id: risposta.id, telefono: payload.telefono });

    const stato = normalizzaTesto(risposta.stato || "in_attesa");
    mostraConferma({
      id: risposta.id || "Registrata",
      data: state.dataSelezionata,
      numeroOmbrellone,
      stato
    });

    mostraToast(risposta.message || "Prenotazione inviata correttamente.", "success");
  } catch (error) {
    mostraMessaggio(dom.bookingFormMessage, error.message || "Errore durante l’invio.", "error");
    mostraToast(error.message || "Prenotazione non inviata.", "error");
    await aggiornaDisponibilitaSenzaScorrimento();
  } finally {
    nascondiCaricamento();
    impostaInvioInCorso(false);
  }
}

function validaModulo() {
  let valido = true;
  const campi = [
    [dom.customerName, dom.customerNameError],
    [dom.customerPhone, dom.customerPhoneError],
    [dom.customerEmail, dom.customerEmailError],
    [dom.numberOfPeople, dom.numberOfPeopleError]
  ];
  campi.forEach(([c, e]) => rimuoviErroreCampo(c, e));
  dom.privacyConsentError.textContent = "";

  if (dom.customerName.value.trim().length < 2) {
    mostraErroreCampo(dom.customerName, dom.customerNameError, "Inserisci nome e cognome.");
    valido = false;
  }

  const telefono = dom.customerPhone.value.replace(/\D/g, "");
  if (telefono.length < 7 || telefono.length > 15) {
    mostraErroreCampo(dom.customerPhone, dom.customerPhoneError, "Inserisci un numero di telefono valido.");
    valido = false;
  }

  const email = dom.customerEmail.value.trim();
  if ((state.impostazioni.emailClienteObbligatoria || email) && !emailValida(email)) {
    mostraErroreCampo(dom.customerEmail, dom.customerEmailError, "Inserisci un indirizzo email valido.");
    valido = false;
  }

  const persone = Number(dom.numberOfPeople.value);
  const max = Math.max(1, Number(state.impostazioni.maxPersone || 6));
  if (!Number.isInteger(persone) || persone < 1 || persone > max) {
    mostraErroreCampo(dom.numberOfPeople, dom.numberOfPeopleError, `Inserisci un numero da 1 a ${max}.`);
    valido = false;
  }

  if (!dom.privacyConsent.checked) {
    dom.privacyConsentError.textContent = "Devi accettare l’utilizzo dei dati per la prenotazione.";
    valido = false;
  }

  return valido;
}

function mostraErroreCampo(campo, elementoErrore, messaggio) {
  campo.classList.add("invalid");
  campo.setAttribute("aria-invalid", "true");
  elementoErrore.textContent = messaggio;
}

function rimuoviErroreCampo(campo, elementoErrore) {
  campo.classList.remove("invalid");
  campo.removeAttribute("aria-invalid");
  elementoErrore.textContent = "";
}

function impostaInvioInCorso(inCorso) {
  dom.submitBookingBtn.disabled = inCorso;
  dom.submitButtonText.textContent = inCorso ? "Invio in corso..." : "Invia prenotazione";
}

/* =========================================================
   MODALE E AGGIORNAMENTO
   ========================================================= */

function mostraConferma(dati) {
  const confermata = dati.stato === "confermata";
  dom.successModalTitle.textContent = confermata ? "Prenotazione confermata" : "Prenotazione inviata";
  dom.successModalMessage.textContent = confermata
    ? "La prenotazione è stata confermata automaticamente dal lido."
    : "La richiesta è stata registrata ed è in attesa della conferma del lido.";
  dom.successBookingId.textContent = String(dati.id);
  dom.successBookingDate.textContent = formattaDataItaliana(dati.data);
  dom.successUmbrella.textContent = `N. ${dati.numeroOmbrellone}`;
  dom.successBookingStatus.textContent = confermata ? "Confermata" : "In attesa";
  dom.successModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  dom.newBookingBtn.focus();
}

function chiudiModale() {
  dom.successModal.classList.add("hidden");
  document.body.style.overflow = "";
}

async function nuovaPrenotazione() {
  chiudiModale();
  dom.bookingForm.reset();
  dom.numberOfPeople.value = "2";
  aggiornaContatoreNote();
  azzeraSelezioneOmbrellone();
  if (state.dataSelezionata) await aggiornaDisponibilitaSenzaScorrimento();
  dom.umbrellaSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function aggiornaDisponibilitaSenzaScorrimento() {
  if (!state.dataSelezionata || !apiConfigurata()) return;
  try {
    const risposta = await richiestaGet({ action: "disponibilita", data: state.dataSelezionata });
    if (!risposta.ok) return;
    state.disponibilita = Array.isArray(risposta.disponibilita) ? risposta.disponibilita : [];
    azzeraSelezioneOmbrellone();
    renderizzaMappa();
    dom.umbrellaSection.classList.remove("hidden");
  } catch (error) {
    console.warn(error);
  }
}

/* =========================================================
   RETE
   ========================================================= */

function apiConfigurata() {
  return typeof CONFIG.API_URL === "string" &&
    CONFIG.API_URL.startsWith("https://script.google.com/macros/s/") &&
    CONFIG.API_URL.endsWith("/exec");
}

async function richiestaGet(parametri) {
  const url = new URL(CONFIG.API_URL);
  Object.entries(parametri).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  url.searchParams.set("_", Date.now().toString());
  return eseguiRichiesta(url.toString(), { method: "GET", cache: "no-store", redirect: "follow" });
}

async function richiestaPost(dati) {
  return eseguiRichiesta(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(dati),
    cache: "no-store",
    redirect: "follow"
  });
}

async function eseguiRichiesta(url, opzioni) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
  try {
    const risposta = await fetch(url, { ...opzioni, signal: controller.signal });
    const testo = await risposta.text();
    if (!risposta.ok) throw new Error(`Errore del server (${risposta.status}).`);
    try { return JSON.parse(testo); }
    catch { throw new Error("Il server non ha restituito dati validi."); }
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Il collegamento al server ha impiegato troppo tempo.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
   UTILITÀ INTERFACCIA E DATI
   ========================================================= */

function mostraCaricamento(testo = "Caricamento...") {
  dom.loadingText.textContent = testo;
  dom.loadingOverlay.classList.remove("hidden");
}

function nascondiCaricamento() { dom.loadingOverlay.classList.add("hidden"); }

function mostraMessaggio(elemento, testo, tipo = "") {
  elemento.textContent = testo;
  elemento.classList.remove("success", "error", "warning");
  if (tipo) elemento.classList.add(tipo);
}

function pulisciMessaggio(elemento) { mostraMessaggio(elemento, ""); }

function mostraToast(messaggio, tipo = "info") {
  clearTimeout(state.toastTimer);
  dom.toast.classList.remove("hidden", "success", "error", "warning");
  dom.toast.classList.add(tipo);
  dom.toastIcon.textContent = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" }[tipo] || "ℹ️";
  dom.toastMessage.textContent = messaggio;
  state.toastTimer = setTimeout(() => dom.toast.classList.add("hidden"), 4500);
}

function aggiornaContatoreNote() { dom.notesCounter.textContent = String(dom.bookingNotes.value.length); }

function salvaUltimaPrenotazione(dati) {
  if (!dati || !dati.id || !dati.telefono) return;
  try {
    localStorage.setItem("ultimaPrenotazioneLido", JSON.stringify({ id: String(dati.id), telefono: String(dati.telefono) }));
  } catch (error) { console.warn(error); }
}

function oggiFormatoInput() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function formattaDataItaliana(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (value || "—");
}

function giornoSettimanaIso(value) {
  const p = String(value).split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]).getDay();
}

function nomeGiorno(value) {
  return ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][Number(value)] || "";
}

function normalizzaTesto(value) {
  return String(value || "").trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
}

function descrizioneStato(stato) {
  return { available: "Libero", selected: "Selezionato", pending: "In attesa", occupied: "Prenotato", blocked: "Non disponibile" }[stato] || "Non disponibile";
}

function emailValida(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim()); }
