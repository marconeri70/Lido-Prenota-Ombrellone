/* =========================================================
   PRENOTA OMBRELLONE
   Logica dell'app cliente
   ========================================================= */

/*
  IMPORTANTE:
  Sostituisci il valore di API_URL con l'indirizzo della Web App
  pubblicata da Google Apps Script.

  Esempio:
  https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec
*/

const CONFIG = {
  API_URL: "INCOLLA_QUI_L_URL_DELLA_WEB_APP",
  REQUEST_TIMEOUT: 20000
};

const state = {
  ombrelloni: [],
  prenotazioni: [],
  dataSelezionata: "",
  ombrelloneSelezionato: null,
  toastTimer: null
};

const dom = {};

document.addEventListener("DOMContentLoaded", inizializzaApp);

/* =========================================================
   INIZIALIZZAZIONE
   ========================================================= */

function inizializzaApp() {
  recuperaElementiDOM();
  configuraDataMinima();
  collegaEventi();
  aggiornaContatoreNote();

  dom.bookingDate.value = oggiFormatoInput();
}

function recuperaElementiDOM() {
  dom.loadingOverlay = document.getElementById("loadingOverlay");
  dom.loadingText = document.getElementById("loadingText");

  dom.bookingDate = document.getElementById("bookingDate");
  dom.loadAvailabilityBtn = document.getElementById("loadAvailabilityBtn");
  dom.dateMessage = document.getElementById("dateMessage");

  dom.umbrellaSection = document.getElementById("umbrellaSection");
  dom.umbrellaMap = document.getElementById("umbrellaMap");
  dom.emptyUmbrellaMessage = document.getElementById("emptyUmbrellaMessage");
  dom.umbrellaMessage = document.getElementById("umbrellaMessage");

  dom.selectionSummary = document.getElementById("selectionSummary");
  dom.selectedUmbrellaText = document.getElementById("selectedUmbrellaText");
  dom.changeUmbrellaBtn = document.getElementById("changeUmbrellaBtn");

  dom.bookingSection = document.getElementById("bookingSection");
  dom.bookingForm = document.getElementById("bookingForm");
  dom.selectedUmbrellaId = document.getElementById("selectedUmbrellaId");
  dom.selectedUmbrellaNumber = document.getElementById("selectedUmbrellaNumber");

  dom.customerName = document.getElementById("customerName");
  dom.customerPhone = document.getElementById("customerPhone");
  dom.numberOfPeople = document.getElementById("numberOfPeople");
  dom.arrivalTime = document.getElementById("arrivalTime");
  dom.bookingNotes = document.getElementById("bookingNotes");
  dom.notesCounter = document.getElementById("notesCounter");
  dom.privacyConsent = document.getElementById("privacyConsent");

  dom.customerNameError = document.getElementById("customerNameError");
  dom.customerPhoneError = document.getElementById("customerPhoneError");
  dom.numberOfPeopleError = document.getElementById("numberOfPeopleError");
  dom.privacyConsentError = document.getElementById("privacyConsentError");

  dom.recapDate = document.getElementById("recapDate");
  dom.recapUmbrella = document.getElementById("recapUmbrella");

  dom.submitBookingBtn = document.getElementById("submitBookingBtn");
  dom.submitButtonText = document.getElementById("submitButtonText");
  dom.bookingFormMessage = document.getElementById("bookingFormMessage");

  dom.successModal = document.getElementById("successModal");
  dom.successBookingId = document.getElementById("successBookingId");
  dom.successBookingDate = document.getElementById("successBookingDate");
  dom.successUmbrella = document.getElementById("successUmbrella");
  dom.successBookingStatus = document.getElementById("successBookingStatus");
  dom.newBookingBtn = document.getElementById("newBookingBtn");

  dom.toast = document.getElementById("toast");
  dom.toastIcon = document.getElementById("toastIcon");
  dom.toastMessage = document.getElementById("toastMessage");
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
    dom.umbrellaSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  dom.bookingNotes.addEventListener("input", aggiornaContatoreNote);

  dom.customerName.addEventListener("input", () => {
    rimuoviErroreCampo(dom.customerName, dom.customerNameError);
  });

  dom.customerPhone.addEventListener("input", () => {
    rimuoviErroreCampo(dom.customerPhone, dom.customerPhoneError);
  });

  dom.numberOfPeople.addEventListener("input", () => {
    rimuoviErroreCampo(dom.numberOfPeople, dom.numberOfPeopleError);
  });

  dom.privacyConsent.addEventListener("change", () => {
    dom.privacyConsentError.textContent = "";
  });

  dom.bookingForm.addEventListener("submit", inviaPrenotazione);
  dom.newBookingBtn.addEventListener("click", nuovaPrenotazione);

  const backdrop = dom.successModal.querySelector(".modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", chiudiModale);
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !dom.successModal.classList.contains("hidden")) {
      chiudiModale();
    }
  });
}

function configuraDataMinima() {
  dom.bookingDate.min = oggiFormatoInput();
}

/* =========================================================
   DISPONIBILITÀ
   ========================================================= */

async function caricaDisponibilita() {
  const data = dom.bookingDate.value;

  pulisciMessaggio(dom.dateMessage);
  pulisciMessaggio(dom.umbrellaMessage);
  pulisciMessaggio(dom.bookingFormMessage);

  if (!data) {
    mostraMessaggio(dom.dateMessage, "Seleziona una data.", "error");
    dom.bookingDate.focus();
    return;
  }

  if (data < oggiFormatoInput()) {
    mostraMessaggio(
      dom.dateMessage,
      "Non puoi prenotare una data già trascorsa.",
      "error"
    );
    return;
  }

  if (!apiConfigurata()) {
    mostraMessaggio(
      dom.dateMessage,
      "Devi prima inserire in app.js l’URL della Web App di Google Apps Script.",
      "error"
    );
    mostraToast(
      "Inserisci l’URL di Google Apps Script nella costante CONFIG.API_URL.",
      "warning"
    );
    return;
  }

  state.dataSelezionata = data;
  azzeraSelezioneOmbrellone();
  mostraCaricamento("Controllo disponibilità...");

  try {
    /*
      L'app pubblica riceve soltanto l'ID dell'ombrellone e lo stato.
      Nomi e numeri di telefono restano protetti nell'Area lido.
    */
    const [rispostaOmbrelloni, rispostaDisponibilita] = await Promise.all([
      richiestaGet({ action: "ombrelloni" }),
      richiestaGet({
        action: "disponibilita",
        data: state.dataSelezionata
      })
    ]);

    if (!rispostaOmbrelloni.ok) {
      throw new Error(
        rispostaOmbrelloni.error || "Impossibile caricare gli ombrelloni."
      );
    }

    if (!rispostaDisponibilita.ok) {
      throw new Error(
        rispostaDisponibilita.error || "Impossibile caricare la disponibilità."
      );
    }

    state.ombrelloni = Array.isArray(rispostaOmbrelloni.ombrelloni)
      ? rispostaOmbrelloni.ombrelloni
      : [];

    state.prenotazioni = Array.isArray(rispostaDisponibilita.disponibilita)
      ? rispostaDisponibilita.disponibilita
      : [];

    renderizzaMappa();
    dom.umbrellaSection.classList.remove("hidden");

    mostraMessaggio(
      dom.dateMessage,
      `Disponibilità aggiornata per ${formattaDataItaliana(data)}.`,
      "success"
    );

    dom.umbrellaSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } catch (error) {
    console.error("Errore caricamento disponibilità:", error);

    nascondiRisultati();

    mostraMessaggio(
      dom.dateMessage,
      error.message || "Errore durante il caricamento della disponibilità.",
      "error"
    );

    mostraToast(
      "Non è stato possibile collegarsi al database del lido.",
      "error"
    );
  } finally {
    nascondiCaricamento();
  }
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
    const zonaA = String(a.zona || "");
    const zonaB = String(b.zona || "");

    if (zonaA !== zonaB) {
      return zonaA.localeCompare(zonaB, "it", {
        numeric: true,
        sensitivity: "base"
      });
    }

    const filaA = valoreOrdinabile(a.fila);
    const filaB = valoreOrdinabile(b.fila);

    if (filaA !== filaB) {
      return filaA.localeCompare(filaB, "it", {
        numeric: true,
        sensitivity: "base"
      });
    }

    return String(a.numero || a.id || "").localeCompare(
      String(b.numero || b.id || ""),
      "it",
      { numeric: true, sensitivity: "base" }
    );
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

      const titoloZona = document.createElement("div");
      titoloZona.className = "zone-title";
      titoloZona.textContent = zona;
      dom.umbrellaMap.appendChild(titoloZona);
    }

    if (fila && fila !== ultimaFila) {
      ultimaFila = fila;

      const titoloFila = document.createElement("div");
      titoloFila.className = "umbrella-row-title";
      titoloFila.textContent = `Fila ${fila}`;
      dom.umbrellaMap.appendChild(titoloFila);
    }

    const stato = determinaStatoOmbrellone(ombrellone);

    if (stato === "available") {
      disponibili += 1;
    }

    dom.umbrellaMap.appendChild(
      creaPulsanteOmbrellone(ombrellone, stato)
    );
  });

  if (disponibili === 0) {
    mostraMessaggio(
      dom.umbrellaMessage,
      "Per questa data non ci sono ombrelloni liberi.",
      "warning"
    );
  } else {
    mostraMessaggio(
      dom.umbrellaMessage,
      `${disponibili} ombrellon${disponibili === 1 ? "e libero" : "i liberi"}.`,
      "success"
    );
  }
}

function creaPulsanteOmbrellone(ombrellone, stato) {
  const pulsante = document.createElement("button");
  const numero = String(ombrellone.numero || ombrellone.id || "—");
  const fila = String(ombrellone.fila || "").trim();

  pulsante.type = "button";
  pulsante.className = `umbrella ${stato}`;
  pulsante.dataset.id = String(ombrellone.id ?? "");
  pulsante.dataset.numero = numero;

  const etichettaStato = descrizioneStato(stato);

  pulsante.setAttribute(
    "aria-label",
    `Ombrellone ${numero}${fila ? `, fila ${fila}` : ""}: ${etichettaStato}`
  );

  const numeroElemento = document.createElement("span");
  numeroElemento.className = "umbrella-number";
  numeroElemento.textContent = `N. ${numero}`;

  const infoElemento = document.createElement("span");
  infoElemento.className = "umbrella-info";
  infoElemento.textContent = etichettaStato;

  pulsante.append(numeroElemento, infoElemento);

  if (stato === "available") {
    pulsante.addEventListener("click", () => {
      selezionaOmbrellone(ombrellone, pulsante);
    });
  } else {
    pulsante.disabled = true;
    pulsante.setAttribute("aria-disabled", "true");
  }

  return pulsante;
}

function determinaStatoOmbrellone(ombrellone) {
  const statoAnagrafica = normalizzaTesto(ombrellone.stato);

  const statiDisponibili = [
    "",
    "attivo",
    "attiva",
    "libero",
    "libera",
    "disponibile"
  ];

  if (!statiDisponibili.includes(statoAnagrafica)) {
    return "blocked";
  }

  const prenotazione = trovaPrenotazioneOmbrellone(ombrellone);

  if (!prenotazione) {
    return "available";
  }

  const statoPrenotazione = normalizzaTesto(prenotazione.stato);

  if (
    statoPrenotazione === "in_attesa" ||
    statoPrenotazione === "in attesa" ||
    statoPrenotazione === "pending"
  ) {
    return "pending";
  }

  if (
    statoPrenotazione === "confermata" ||
    statoPrenotazione === "confermato" ||
    statoPrenotazione === "prenotata" ||
    statoPrenotazione === "prenotato"
  ) {
    return "occupied";
  }

  return "occupied";
}

function trovaPrenotazioneOmbrellone(ombrellone) {
  const id = String(ombrellone.id ?? "").trim();
  const numero = String(ombrellone.numero ?? "").trim();

  return state.prenotazioni.find(prenotazione => {
    const valore = String(prenotazione.ombrellone ?? "").trim();
    return valore === id || valore === numero;
  });
}

/* =========================================================
   SELEZIONE OMBRELLONE
   ========================================================= */

function selezionaOmbrellone(ombrellone, pulsante) {
  document.querySelectorAll(".umbrella.selected").forEach(elemento => {
    elemento.classList.remove("selected");
    elemento.classList.add("available");

    const info = elemento.querySelector(".umbrella-info");
    if (info) {
      info.textContent = "Libero";
    }
  });

  pulsante.classList.remove("available");
  pulsante.classList.add("selected");

  const info = pulsante.querySelector(".umbrella-info");
  if (info) {
    info.textContent = "Selezionato";
  }

  state.ombrelloneSelezionato = ombrellone;

  const numero = String(ombrellone.numero || ombrellone.id || "—");
  const fila = String(ombrellone.fila || "").trim();
  const zona = String(ombrellone.zona || "").trim();

  dom.selectedUmbrellaId.value = String(ombrellone.id ?? numero);
  dom.selectedUmbrellaNumber.value = numero;

  const dettagli = [
    `Ombrellone ${numero}`,
    fila ? `fila ${fila}` : "",
    zona
  ].filter(Boolean);

  dom.selectedUmbrellaText.textContent = dettagli.join(" · ");
  dom.recapDate.textContent = formattaDataItaliana(state.dataSelezionata);
  dom.recapUmbrella.textContent = dettagli.join(" · ");

  dom.selectionSummary.classList.remove("hidden");
  dom.bookingSection.classList.remove("hidden");

  pulisciMessaggio(dom.bookingFormMessage);

  setTimeout(() => {
    dom.bookingSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
}

function azzeraSelezioneOmbrellone() {
  state.ombrelloneSelezionato = null;

  document.querySelectorAll(".umbrella.selected").forEach(elemento => {
    elemento.classList.remove("selected");
    elemento.classList.add("available");

    const info = elemento.querySelector(".umbrella-info");
    if (info) {
      info.textContent = "Libero";
    }
  });

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

/* =========================================================
   INVIO PRENOTAZIONE
   ========================================================= */

async function inviaPrenotazione(event) {
  event.preventDefault();

  pulisciMessaggio(dom.bookingFormMessage);

  if (!state.ombrelloneSelezionato) {
    mostraMessaggio(
      dom.bookingFormMessage,
      "Seleziona prima un ombrellone libero.",
      "error"
    );
    return;
  }

  if (!validaModulo()) {
    mostraMessaggio(
      dom.bookingFormMessage,
      "Controlla i campi evidenziati.",
      "error"
    );
    return;
  }

  const numeroOmbrellone = String(
    state.ombrelloneSelezionato.numero ||
    state.ombrelloneSelezionato.id ||
    ""
  );

  const identificativoOmbrellone = String(
    state.ombrelloneSelezionato.id || numeroOmbrellone
  );

  const noteUtente = dom.bookingNotes.value.trim();
  const orario = dom.arrivalTime.value;

  const partiNota = [];
  if (orario) {
    partiNota.push(`Arrivo previsto: ${orario}`);
  }
  if (noteUtente) {
    partiNota.push(noteUtente);
  }

  const payload = {
    action: "prenota",
    data: state.dataSelezionata,
    ombrellone: identificativoOmbrellone,
    numeroOmbrellone,
    nome: dom.customerName.value.trim(),
    telefono: dom.customerPhone.value.trim(),
    persone: Number(dom.numberOfPeople.value),
    note: partiNota.join(" - ")
  };

  impostaInvioInCorso(true);
  mostraCaricamento("Invio prenotazione...");

  try {
    const risposta = await richiestaPost(payload);

    if (!risposta.ok) {
      throw new Error(
        risposta.error || "Non è stato possibile registrare la prenotazione."
      );
    }

    mostraConferma({
      id: risposta.id || "Registrata",
      data: state.dataSelezionata,
      numeroOmbrellone,
      stato: "In attesa"
    });

    mostraToast("Prenotazione inviata correttamente.", "success");
  } catch (error) {
    console.error("Errore invio prenotazione:", error);

    mostraMessaggio(
      dom.bookingFormMessage,
      error.message || "Errore durante l’invio della prenotazione.",
      "error"
    );

    mostraToast(
      error.message || "Prenotazione non inviata.",
      "error"
    );

    /*
      Ricarica la mappa: l'ombrellone potrebbe essere stato prenotato
      da un altro cliente pochi istanti prima.
    */
    await aggiornaDisponibilitaSenzaScorrimento();
  } finally {
    nascondiCaricamento();
    impostaInvioInCorso(false);
  }
}

function validaModulo() {
  let valido = true;

  rimuoviErroreCampo(dom.customerName, dom.customerNameError);
  rimuoviErroreCampo(dom.customerPhone, dom.customerPhoneError);
  rimuoviErroreCampo(dom.numberOfPeople, dom.numberOfPeopleError);
  dom.privacyConsentError.textContent = "";

  const nome = dom.customerName.value.trim();

  if (nome.length < 2) {
    mostraErroreCampo(
      dom.customerName,
      dom.customerNameError,
      "Inserisci nome e cognome."
    );
    valido = false;
  }

  const telefono = dom.customerPhone.value.trim();
  const soloNumeri = telefono.replace(/\D/g, "");

  if (soloNumeri.length < 7 || soloNumeri.length > 15) {
    mostraErroreCampo(
      dom.customerPhone,
      dom.customerPhoneError,
      "Inserisci un numero di telefono valido."
    );
    valido = false;
  }

  const persone = Number(dom.numberOfPeople.value);

  if (!Number.isInteger(persone) || persone < 1 || persone > 20) {
    mostraErroreCampo(
      dom.numberOfPeople,
      dom.numberOfPeopleError,
      "Inserisci un numero da 1 a 20."
    );
    valido = false;
  }

  if (!dom.privacyConsent.checked) {
    dom.privacyConsentError.textContent =
      "Devi accettare l’utilizzo dei dati per la prenotazione.";
    valido = false;
  }

  if (!valido) {
    const primoCampoNonValido = dom.bookingForm.querySelector(".invalid");
    if (primoCampoNonValido) {
      primoCampoNonValido.focus();
    }
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
  dom.submitButtonText.textContent = inCorso
    ? "Invio in corso..."
    : "Invia prenotazione";
}

/* =========================================================
   MODALE E NUOVA PRENOTAZIONE
   ========================================================= */

function mostraConferma(dati) {
  dom.successBookingId.textContent = String(dati.id);
  dom.successBookingDate.textContent = formattaDataItaliana(dati.data);
  dom.successUmbrella.textContent = `N. ${dati.numeroOmbrellone}`;
  dom.successBookingStatus.textContent = dati.stato;

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

  if (state.dataSelezionata) {
    await aggiornaDisponibilitaSenzaScorrimento();
  }

  dom.umbrellaSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function aggiornaDisponibilitaSenzaScorrimento() {
  if (!state.dataSelezionata || !apiConfigurata()) {
    return;
  }

  try {
    const risposta = await richiestaGet({
      action: "disponibilita",
      data: state.dataSelezionata
    });

    if (!risposta.ok) {
      return;
    }

    state.prenotazioni = Array.isArray(risposta.disponibilita)
      ? risposta.disponibilita
      : [];

    azzeraSelezioneOmbrellone();
    renderizzaMappa();
    dom.umbrellaSection.classList.remove("hidden");
  } catch (error) {
    console.warn("Aggiornamento disponibilità non riuscito:", error);
  }
}

/* =========================================================
   COMUNICAZIONE CON GOOGLE APPS SCRIPT
   ========================================================= */

function apiConfigurata() {
  return (
    typeof CONFIG.API_URL === "string" &&
    CONFIG.API_URL.startsWith("https://script.google.com/macros/s/") &&
    CONFIG.API_URL.endsWith("/exec")
  );
}

async function richiestaGet(parametri) {
  const url = new URL(CONFIG.API_URL);

  Object.entries(parametri).forEach(([chiave, valore]) => {
    url.searchParams.set(chiave, String(valore));
  });

  url.searchParams.set("_", Date.now().toString());

  return eseguiRichiesta(url.toString(), {
    method: "GET",
    cache: "no-store",
    redirect: "follow"
  });
}

async function richiestaPost(dati) {
  /*
    text/plain evita una richiesta preliminare CORS "preflight",
    che può creare problemi con le Web App di Google Apps Script.
  */
  return eseguiRichiesta(CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(dati),
    cache: "no-store",
    redirect: "follow"
  });
}

async function eseguiRichiesta(url, opzioni) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, CONFIG.REQUEST_TIMEOUT);

  try {
    const risposta = await fetch(url, {
      ...opzioni,
      signal: controller.signal
    });

    const testo = await risposta.text();

    if (!risposta.ok) {
      throw new Error(`Errore del server (${risposta.status}).`);
    }

    try {
      return JSON.parse(testo);
    } catch {
      console.error("Risposta non JSON:", testo);

      throw new Error(
        "Il server non ha restituito dati validi. Controlla l’URL e la pubblicazione della Web App."
      );
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Il collegamento al server ha impiegato troppo tempo.");
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
   UTILITÀ INTERFACCIA
   ========================================================= */

function mostraCaricamento(testo = "Caricamento...") {
  dom.loadingText.textContent = testo;
  dom.loadingOverlay.classList.remove("hidden");
}

function nascondiCaricamento() {
  dom.loadingOverlay.classList.add("hidden");
}

function mostraMessaggio(elemento, testo, tipo = "") {
  elemento.textContent = testo;
  elemento.classList.remove("success", "error", "warning");

  if (tipo) {
    elemento.classList.add(tipo);
  }
}

function pulisciMessaggio(elemento) {
  mostraMessaggio(elemento, "");
}

function mostraToast(messaggio, tipo = "info") {
  clearTimeout(state.toastTimer);

  dom.toast.classList.remove("hidden", "success", "error", "warning");
  dom.toast.classList.add(tipo);

  const icone = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️"
  };

  dom.toastIcon.textContent = icone[tipo] || icone.info;
  dom.toastMessage.textContent = messaggio;

  state.toastTimer = setTimeout(() => {
    dom.toast.classList.add("hidden");
  }, 4500);
}

function aggiornaContatoreNote() {
  dom.notesCounter.textContent = String(dom.bookingNotes.value.length);
}

/* =========================================================
   UTILITÀ DATI
   ========================================================= */

function oggiFormatoInput() {
  const oggi = new Date();
  const anno = oggi.getFullYear();
  const mese = String(oggi.getMonth() + 1).padStart(2, "0");
  const giorno = String(oggi.getDate()).padStart(2, "0");

  return `${anno}-${mese}-${giorno}`;
}

function formattaDataItaliana(valore) {
  const dataNormalizzata = normalizzaData(valore);

  if (!dataNormalizzata) {
    return "—";
  }

  const [anno, mese, giorno] = dataNormalizzata.split("-");

  return `${giorno}/${mese}/${anno}`;
}

function normalizzaData(valore) {
  if (!valore) {
    return "";
  }

  if (valore instanceof Date && !Number.isNaN(valore.getTime())) {
    return [
      valore.getFullYear(),
      String(valore.getMonth() + 1).padStart(2, "0"),
      String(valore.getDate()).padStart(2, "0")
    ].join("-");
  }

  const testo = String(valore).trim();

  const formatoIso = testo.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (formatoIso) {
    return `${formatoIso[1]}-${formatoIso[2]}-${formatoIso[3]}`;
  }

  const formatoItaliano = testo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (formatoItaliano) {
    const giorno = formatoItaliano[1].padStart(2, "0");
    const mese = formatoItaliano[2].padStart(2, "0");
    const anno = formatoItaliano[3];

    return `${anno}-${mese}-${giorno}`;
  }

  const data = new Date(testo);

  if (!Number.isNaN(data.getTime())) {
    return [
      data.getFullYear(),
      String(data.getMonth() + 1).padStart(2, "0"),
      String(data.getDate()).padStart(2, "0")
    ].join("-");
  }

  return "";
}

function normalizzaTesto(valore) {
  return String(valore ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

function valoreOrdinabile(valore) {
  return String(valore ?? "");
}

function descrizioneStato(stato) {
  const descrizioni = {
    available: "Libero",
    selected: "Selezionato",
    pending: "In attesa",
    occupied: "Prenotato",
    blocked: "Non disponibile"
  };

  return descrizioni[stato] || "Non disponibile";
}
