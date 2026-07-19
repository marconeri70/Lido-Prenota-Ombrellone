/* =========================================================
   LA MIA PRENOTAZIONE
   ========================================================= */

/*
  Inserisci lo STESSO URL /exec usato in app.js e admin.js.
*/
const MY_BOOKING_CONFIG = {
  API_URL: "INCOLLA_QUI_L_URL_DELLA_WEB_APP",
  REQUEST_TIMEOUT: 20000
};

const myBookingState = {
  prenotazione: null,
  annullabile: false,
  toastTimer: null
};

const myDom = {};

document.addEventListener("DOMContentLoaded", inizializzaPagina);

function inizializzaPagina() {
  recuperaElementi();
  collegaEventi();
  precompilaUltimaPrenotazione();
}

function recuperaElementi() {
  myDom.loadingOverlay = document.getElementById("loadingOverlay");
  myDom.loadingText = document.getElementById("loadingText");

  myDom.lookupForm = document.getElementById("lookupForm");
  myDom.bookingCode = document.getElementById("bookingCode");
  myDom.bookingPhone = document.getElementById("bookingPhone");
  myDom.bookingCodeError = document.getElementById("bookingCodeError");
  myDom.bookingPhoneError = document.getElementById("bookingPhoneError");
  myDom.lookupMessage = document.getElementById("lookupMessage");

  myDom.bookingResult = document.getElementById("bookingResult");
  myDom.resultCustomerName = document.getElementById("resultCustomerName");
  myDom.resultStatusBadge = document.getElementById("resultStatusBadge");
  myDom.statusExplanation = document.getElementById("statusExplanation");

  myDom.resultCode = document.getElementById("resultCode");
  myDom.resultDate = document.getElementById("resultDate");
  myDom.resultUmbrella = document.getElementById("resultUmbrella");
  myDom.resultPeople = document.getElementById("resultPeople");
  myDom.resultNotes = document.getElementById("resultNotes");
  myDom.resultCreatedAt = document.getElementById("resultCreatedAt");

  myDom.cancelArea = document.getElementById("cancelArea");
  myDom.cancelBookingBtn = document.getElementById("cancelBookingBtn");
  myDom.searchAnotherBtn = document.getElementById("searchAnotherBtn");

  myDom.toast = document.getElementById("toast");
  myDom.toastIcon = document.getElementById("toastIcon");
  myDom.toastMessage = document.getElementById("toastMessage");
}

function collegaEventi() {
  myDom.lookupForm.addEventListener("submit", cercaPrenotazione);
  myDom.cancelBookingBtn.addEventListener("click", annullaPrenotazione);
  myDom.searchAnotherBtn.addEventListener("click", resetRicerca);

  myDom.bookingCode.addEventListener("input", () => {
    rimuoviErrore(myDom.bookingCode, myDom.bookingCodeError);
  });

  myDom.bookingPhone.addEventListener("input", () => {
    rimuoviErrore(myDom.bookingPhone, myDom.bookingPhoneError);
  });
}

function precompilaUltimaPrenotazione() {
  try {
    const salvata = localStorage.getItem("ultimaPrenotazioneLido");

    if (!salvata) {
      return;
    }

    const dati = JSON.parse(salvata);

    if (dati && dati.id) {
      myDom.bookingCode.value = String(dati.id);
    }

    if (dati && dati.telefono) {
      myDom.bookingPhone.value = String(dati.telefono);
    }
  } catch (error) {
    console.warn("Dati locali della prenotazione non leggibili:", error);
  }
}

/* =========================================================
   CONSULTAZIONE
   ========================================================= */

async function cercaPrenotazione(event) {
  event.preventDefault();
  pulisciMessaggio(myDom.lookupMessage);

  if (!validaRicerca()) {
    mostraMessaggio(
      myDom.lookupMessage,
      "Controlla i dati inseriti.",
      "error"
    );
    return;
  }

  if (!apiConfigurata()) {
    mostraMessaggio(
      myDom.lookupMessage,
      "Inserisci in mia-prenotazione.js l’URL della Web App.",
      "error"
    );
    return;
  }

  mostraCaricamento("Ricerca prenotazione...");

  try {
    const risposta = await richiestaPost({
      action: "consultaPrenotazione",
      id: myDom.bookingCode.value.trim(),
      telefono: myDom.bookingPhone.value.trim()
    });

    if (!risposta.ok) {
      throw new Error(
        risposta.error ||
        "Prenotazione non trovata. Controlla codice e telefono."
      );
    }

    myBookingState.prenotazione = risposta.prenotazione;
    myBookingState.annullabile = Boolean(risposta.annullabile);

    renderizzaPrenotazione();

    mostraMessaggio(
      myDom.lookupMessage,
      "Prenotazione trovata.",
      "success"
    );
  } catch (error) {
    myDom.bookingResult.classList.add("hidden");
    myBookingState.prenotazione = null;

    mostraMessaggio(
      myDom.lookupMessage,
      error.message ||
      "Prenotazione non trovata. Controlla codice e telefono.",
      "error"
    );
  } finally {
    nascondiCaricamento();
  }
}

function validaRicerca() {
  let valido = true;

  rimuoviErrore(myDom.bookingCode, myDom.bookingCodeError);
  rimuoviErrore(myDom.bookingPhone, myDom.bookingPhoneError);

  const codice = myDom.bookingCode.value.trim();

  if (codice.length < 4) {
    mostraErrore(
      myDom.bookingCode,
      myDom.bookingCodeError,
      "Inserisci il codice della prenotazione."
    );
    valido = false;
  }

  const telefono = myDom.bookingPhone.value.replace(/\D/g, "");

  if (telefono.length < 7 || telefono.length > 15) {
    mostraErrore(
      myDom.bookingPhone,
      myDom.bookingPhoneError,
      "Inserisci un numero di telefono valido."
    );
    valido = false;
  }

  return valido;
}

function renderizzaPrenotazione() {
  const p = myBookingState.prenotazione;

  if (!p) {
    return;
  }

  const stato = normalizzaStato(p.stato);

  myDom.bookingResult.classList.remove(
    "hidden",
    "status-in_attesa",
    "status-confermata",
    "status-annullata"
  );

  myDom.bookingResult.classList.add(`status-${stato}`);

  myDom.resultCustomerName.textContent =
    p.nome ? `Prenotazione di ${p.nome}` : "La tua prenotazione";

  myDom.resultStatusBadge.className =
    `customer-status-badge ${stato}`;

  myDom.resultStatusBadge.textContent = etichettaStato(stato);

  myDom.statusExplanation.textContent =
    spiegazioneStato(stato, myBookingState.annullabile);

  myDom.resultCode.textContent = p.id || "—";
  myDom.resultDate.textContent = formattaDataItaliana(p.data);
  myDom.resultUmbrella.textContent = `N. ${p.ombrellone || "—"}`;
  myDom.resultPeople.textContent = String(p.persone || "—");
  myDom.resultNotes.textContent = p.note || "Nessuna nota";
  myDom.resultCreatedAt.textContent = p.creatoIl || "—";

  if (myBookingState.annullabile) {
    myDom.cancelArea.classList.remove("hidden");
  } else {
    myDom.cancelArea.classList.add("hidden");
  }

  myDom.bookingResult.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/* =========================================================
   ANNULLAMENTO CLIENTE
   ========================================================= */

async function annullaPrenotazione() {
  const p = myBookingState.prenotazione;

  if (!p || !myBookingState.annullabile) {
    return;
  }

  const conferma = window.confirm(
    "Vuoi davvero annullare la prenotazione? " +
    "L’ombrellone tornerà disponibile."
  );

  if (!conferma) {
    return;
  }

  myDom.cancelBookingBtn.disabled = true;
  mostraCaricamento("Annullamento prenotazione...");

  try {
    const risposta = await richiestaPost({
      action: "annullaPrenotazioneCliente",
      id: p.id,
      telefono: myDom.bookingPhone.value.trim()
    });

    if (!risposta.ok) {
      throw new Error(
        risposta.error || "Non è stato possibile annullare la prenotazione."
      );
    }

    myBookingState.prenotazione = risposta.prenotazione;
    myBookingState.annullabile = false;

    renderizzaPrenotazione();
    mostraToast("Prenotazione annullata correttamente.", "success");
  } catch (error) {
    mostraToast(
      error.message || "Annullamento non riuscito.",
      "error"
    );
  } finally {
    myDom.cancelBookingBtn.disabled = false;
    nascondiCaricamento();
  }
}

function resetRicerca() {
  myBookingState.prenotazione = null;
  myBookingState.annullabile = false;

  myDom.bookingResult.classList.add("hidden");
  myDom.lookupForm.reset();
  pulisciMessaggio(myDom.lookupMessage);

  myDom.bookingCode.focus();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================================================
   RETE
   ========================================================= */

function apiConfigurata() {
  return (
    typeof MY_BOOKING_CONFIG.API_URL === "string" &&
    MY_BOOKING_CONFIG.API_URL.startsWith(
      "https://script.google.com/macros/s/"
    ) &&
    MY_BOOKING_CONFIG.API_URL.endsWith("/exec")
  );
}

async function richiestaPost(dati) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, MY_BOOKING_CONFIG.REQUEST_TIMEOUT);

  try {
    const risposta = await fetch(MY_BOOKING_CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(dati),
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });

    const testo = await risposta.text();

    if (!risposta.ok) {
      throw new Error(`Errore del server (${risposta.status}).`);
    }

    try {
      return JSON.parse(testo);
    } catch {
      throw new Error(
        "Il server non ha restituito una risposta valida."
      );
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "Il collegamento al server ha impiegato troppo tempo."
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
   INTERFACCIA
   ========================================================= */

function mostraErrore(campo, elementoErrore, messaggio) {
  campo.classList.add("invalid");
  campo.setAttribute("aria-invalid", "true");
  elementoErrore.textContent = messaggio;
}

function rimuoviErrore(campo, elementoErrore) {
  campo.classList.remove("invalid");
  campo.removeAttribute("aria-invalid");
  elementoErrore.textContent = "";
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

function mostraCaricamento(testo) {
  myDom.loadingText.textContent = testo || "Caricamento...";
  myDom.loadingOverlay.classList.remove("hidden");
}

function nascondiCaricamento() {
  myDom.loadingOverlay.classList.add("hidden");
}

function mostraToast(messaggio, tipo = "info") {
  clearTimeout(myBookingState.toastTimer);

  myDom.toast.classList.remove(
    "hidden",
    "success",
    "error",
    "warning"
  );

  myDom.toast.classList.add(tipo);

  const icone = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️"
  };

  myDom.toastIcon.textContent = icone[tipo] || icone.info;
  myDom.toastMessage.textContent = messaggio;

  myBookingState.toastTimer = setTimeout(() => {
    myDom.toast.classList.add("hidden");
  }, 4500);
}

/* =========================================================
   UTILITÀ
   ========================================================= */

function normalizzaStato(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
}

function etichettaStato(stato) {
  const etichette = {
    in_attesa: "In attesa",
    confermata: "Confermata",
    annullata: "Annullata"
  };

  return etichette[stato] || stato;
}

function spiegazioneStato(stato, annullabile) {
  if (stato === "confermata") {
    return annullabile
      ? "Il lido ha confermato la prenotazione. Puoi ancora annullarla se non puoi più venire."
      : "Il lido ha confermato la prenotazione.";
  }

  if (stato === "annullata") {
    return "La prenotazione è stata annullata e l’ombrellone è tornato disponibile.";
  }

  return annullabile
    ? "La richiesta è stata ricevuta ed è in attesa della conferma del lido."
    : "La richiesta è in attesa della conferma del lido.";
}

function formattaDataItaliana(value) {
  const match = String(value || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return value || "—";
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}
