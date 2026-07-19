/* =========================================================
   AREA LIDO - GESTIONE AMMINISTRATORE
   ========================================================= */

/*
  Inserisci qui lo STESSO URL /exec usato nel file app.js.
*/
const ADMIN_CONFIG = {
  API_URL: "INCOLLA_QUI_L_URL_DELLA_WEB_APP",
  REQUEST_TIMEOUT: 20000
};

const adminState = {
  pin: "",
  data: "",
  prenotazioni: [],
  ombrelloni: [],
  toastTimer: null
};

const adminDom = {};

document.addEventListener("DOMContentLoaded", inizializzaAreaLido);

function inizializzaAreaLido() {
  recuperaElementi();
  collegaEventi();

  adminDom.adminDate.value = oggiFormatoInput();
  adminState.data = adminDom.adminDate.value;

  const pinSessione = sessionStorage.getItem("lidoAdminPin");

  if (pinSessione && apiConfigurata()) {
    adminState.pin = pinSessione;
    verificaSessioneEsistente();
  }
}

function recuperaElementi() {
  adminDom.loadingOverlay = document.getElementById("loadingOverlay");
  adminDom.loadingText = document.getElementById("loadingText");

  adminDom.adminLoginSection = document.getElementById("adminLoginSection");
  adminDom.adminLoginForm = document.getElementById("adminLoginForm");
  adminDom.adminPin = document.getElementById("adminPin");
  adminDom.loginMessage = document.getElementById("loginMessage");

  adminDom.adminDashboard = document.getElementById("adminDashboard");
  adminDom.adminDate = document.getElementById("adminDate");
  adminDom.adminSearch = document.getElementById("adminSearch");
  adminDom.refreshAdminBtn = document.getElementById("refreshAdminBtn");
  adminDom.logoutAdminBtn = document.getElementById("logoutAdminBtn");

  adminDom.statTotal = document.getElementById("statTotal");
  adminDom.statPending = document.getElementById("statPending");
  adminDom.statConfirmed = document.getElementById("statConfirmed");
  adminDom.statCancelled = document.getElementById("statCancelled");

  adminDom.bookingListTitle = document.getElementById("bookingListTitle");
  adminDom.lastUpdateText = document.getElementById("lastUpdateText");
  adminDom.bookingList = document.getElementById("bookingList");
  adminDom.bookingEmptyState = document.getElementById("bookingEmptyState");

  adminDom.umbrellaAdminGrid =
    document.getElementById("umbrellaAdminGrid");

  adminDom.toast = document.getElementById("toast");
  adminDom.toastIcon = document.getElementById("toastIcon");
  adminDom.toastMessage = document.getElementById("toastMessage");
}

function collegaEventi() {
  adminDom.adminLoginForm.addEventListener("submit", eseguiLogin);

  adminDom.adminDate.addEventListener("change", () => {
    adminState.data = adminDom.adminDate.value;
    caricaDatiAreaLido();
  });

  adminDom.adminSearch.addEventListener("input", renderizzaPrenotazioni);

  adminDom.refreshAdminBtn.addEventListener("click", caricaDatiAreaLido);
  adminDom.logoutAdminBtn.addEventListener("click", logout);
}

/* =========================================================
   LOGIN
   ========================================================= */

async function eseguiLogin(event) {
  event.preventDefault();
  pulisciMessaggio(adminDom.loginMessage);

  if (!apiConfigurata()) {
    mostraMessaggio(
      adminDom.loginMessage,
      "Inserisci prima l’URL della Web App nel file admin.js.",
      "error"
    );
    return;
  }

  const pin = adminDom.adminPin.value.trim();

  if (!pin) {
    mostraMessaggio(
      adminDom.loginMessage,
      "Inserisci il PIN.",
      "error"
    );
    adminDom.adminPin.focus();
    return;
  }

  mostraCaricamento("Verifica accesso...");

  try {
    const risposta = await richiestaPost({
      action: "adminLogin",
      pin
    });

    if (!risposta.ok) {
      throw new Error(risposta.error || "Accesso non autorizzato.");
    }

    adminState.pin = pin;
    sessionStorage.setItem("lidoAdminPin", pin);

    mostraDashboard();
    await caricaDatiAreaLido();
  } catch (error) {
    mostraMessaggio(
      adminDom.loginMessage,
      error.message || "PIN non corretto.",
      "error"
    );
  } finally {
    nascondiCaricamento();
  }
}

async function verificaSessioneEsistente() {
  mostraCaricamento("Ripristino sessione...");

  try {
    const risposta = await richiestaPost({
      action: "adminLogin",
      pin: adminState.pin
    });

    if (!risposta.ok) {
      throw new Error("Sessione non valida.");
    }

    mostraDashboard();
    await caricaDatiAreaLido();
  } catch (error) {
    logout(false);
  } finally {
    nascondiCaricamento();
  }
}

function mostraDashboard() {
  adminDom.adminLoginSection.classList.add("hidden");
  adminDom.adminDashboard.classList.remove("hidden");
}

function logout(mostraAvviso = true) {
  adminState.pin = "";
  adminState.prenotazioni = [];
  adminState.ombrelloni = [];

  sessionStorage.removeItem("lidoAdminPin");

  adminDom.adminDashboard.classList.add("hidden");
  adminDom.adminLoginSection.classList.remove("hidden");
  adminDom.adminPin.value = "";
  adminDom.adminSearch.value = "";

  if (mostraAvviso) {
    mostraToast("Sessione Area lido terminata.", "info");
  }
}

/* =========================================================
   CARICAMENTO DATI
   ========================================================= */

async function caricaDatiAreaLido() {
  if (!adminState.pin) {
    return;
  }

  const data = adminDom.adminDate.value;

  if (!data) {
    mostraToast("Seleziona una data.", "warning");
    return;
  }

  adminState.data = data;
  mostraCaricamento("Caricamento prenotazioni...");

  try {
    const risposta = await richiestaPost({
      action: "adminDati",
      pin: adminState.pin,
      data
    });

    if (!risposta.ok) {
      if (risposta.code === "UNAUTHORIZED") {
        logout(false);
      }

      throw new Error(
        risposta.error || "Impossibile caricare i dati."
      );
    }

    adminState.prenotazioni = Array.isArray(risposta.prenotazioni)
      ? risposta.prenotazioni
      : [];

    adminState.ombrelloni = Array.isArray(risposta.ombrelloni)
      ? risposta.ombrelloni
      : [];

    renderizzaTutto();
  } catch (error) {
    mostraToast(
      error.message || "Errore durante il caricamento.",
      "error"
    );
  } finally {
    nascondiCaricamento();
  }
}

function renderizzaTutto() {
  renderizzaStatistiche();
  renderizzaPrenotazioni();
  renderizzaOmbrelloni();

  adminDom.bookingListTitle.textContent =
    `Prenotazioni del ${formattaDataItaliana(adminState.data)}`;

  adminDom.lastUpdateText.textContent =
    `Aggiornato alle ${new Date().toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;
}

/* =========================================================
   STATISTICHE
   ========================================================= */

function renderizzaStatistiche() {
  const totale = adminState.prenotazioni.length;

  const inAttesa = adminState.prenotazioni.filter(
    item => normalizzaStato(item.stato) === "in_attesa"
  ).length;

  const confermate = adminState.prenotazioni.filter(
    item => normalizzaStato(item.stato) === "confermata"
  ).length;

  const annullate = adminState.prenotazioni.filter(
    item => normalizzaStato(item.stato) === "annullata"
  ).length;

  adminDom.statTotal.textContent = String(totale);
  adminDom.statPending.textContent = String(inAttesa);
  adminDom.statConfirmed.textContent = String(confermate);
  adminDom.statCancelled.textContent = String(annullate);
}

/* =========================================================
   PRENOTAZIONI
   ========================================================= */

function renderizzaPrenotazioni() {
  const ricerca = adminDom.adminSearch.value
    .trim()
    .toLowerCase();

  const filtrate = adminState.prenotazioni.filter(item => {
    if (!ricerca) {
      return true;
    }

    const testo = [
      item.id,
      item.ombrellone,
      item.nome,
      item.telefono,
      item.note,
      item.stato
    ]
      .join(" ")
      .toLowerCase();

    return testo.includes(ricerca);
  });

  adminDom.bookingList.innerHTML = "";

  if (!filtrate.length) {
    adminDom.bookingEmptyState.classList.remove("hidden");
    return;
  }

  adminDom.bookingEmptyState.classList.add("hidden");

  filtrate.forEach(prenotazione => {
    adminDom.bookingList.appendChild(
      creaSchedaPrenotazione(prenotazione)
    );
  });
}

function creaSchedaPrenotazione(prenotazione) {
  const stato = normalizzaStato(prenotazione.stato);

  const card = document.createElement("article");
  card.className = `booking-admin-card status-${stato}`;

  const numeroBox = document.createElement("div");
  numeroBox.className = "booking-umbrella-number";

  const numeroLabel = document.createElement("span");
  numeroLabel.textContent = "Ombrellone";

  const numero = document.createElement("strong");
  numero.textContent = String(prenotazione.ombrellone || "—");

  numeroBox.append(numeroLabel, numero);

  const cliente = document.createElement("div");
  cliente.className = "booking-customer";

  const nome = document.createElement("h3");
  nome.textContent = prenotazione.nome || "Cliente senza nome";

  const telefono = document.createElement("p");
  const linkTelefono = document.createElement("a");
  linkTelefono.href = `tel:${String(prenotazione.telefono || "")
    .replace(/[^\d+]/g, "")}`;
  linkTelefono.textContent =
    prenotazione.telefono || "Telefono non disponibile";
  telefono.appendChild(linkTelefono);

  cliente.append(nome, telefono);

  if (prenotazione.note) {
    const note = document.createElement("p");
    note.className = "booking-note";
    note.textContent = prenotazione.note;
    cliente.appendChild(note);
  }

  const dettagli = document.createElement("div");
  dettagli.className = "booking-details";

  const badge = document.createElement("span");
  badge.className = `booking-status-badge ${stato}`;
  badge.textContent = etichettaStato(stato);

  const persone = document.createElement("p");
  persone.textContent =
    `Persone: ${Number(prenotazione.persone || 0)}`;

  const creato = document.createElement("p");
  creato.textContent =
    `Inserita: ${prenotazione.creatoIl || "—"}`;

  const codice = document.createElement("p");
  codice.textContent =
    `Codice: ${prenotazione.id || "—"}`;

  dettagli.append(badge, persone, creato, codice);

  const azioni = document.createElement("div");
  azioni.className = "booking-actions";

  azioni.append(
    creaPulsanteStato(
      "Conferma",
      "confirm",
      "confermata",
      prenotazione,
      stato === "confermata"
    ),
    creaPulsanteStato(
      "In attesa",
      "waiting",
      "in_attesa",
      prenotazione,
      stato === "in_attesa"
    ),
    creaPulsanteStato(
      "Annulla",
      "cancel",
      "annullata",
      prenotazione,
      stato === "annullata"
    )
  );

  card.append(numeroBox, cliente, dettagli, azioni);
  return card;
}

function creaPulsanteStato(
  testo,
  classe,
  nuovoStato,
  prenotazione,
  disabilitato
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `admin-action-button ${classe}`;
  button.textContent = testo;
  button.disabled = disabilitato;

  button.addEventListener("click", () => {
    cambiaStatoPrenotazione(prenotazione, nuovoStato);
  });

  return button;
}

async function cambiaStatoPrenotazione(prenotazione, nuovoStato) {
  const confermaNecessaria = nuovoStato === "annullata";

  if (
    confermaNecessaria &&
    !window.confirm(
      `Annullare la prenotazione di ${prenotazione.nome}?`
    )
  ) {
    return;
  }

  mostraCaricamento("Aggiornamento prenotazione...");

  try {
    const risposta = await richiestaPost({
      action: "aggiornaStato",
      pin: adminState.pin,
      id: prenotazione.id,
      stato: nuovoStato
    });

    if (!risposta.ok) {
      throw new Error(
        risposta.error || "Aggiornamento non riuscito."
      );
    }

    mostraToast(risposta.message, "success");
    await caricaDatiAreaLido();
  } catch (error) {
    mostraToast(error.message, "error");
  } finally {
    nascondiCaricamento();
  }
}

/* =========================================================
   OMBRELLONI
   ========================================================= */

function renderizzaOmbrelloni() {
  adminDom.umbrellaAdminGrid.innerHTML = "";

  const ordinati = [...adminState.ombrelloni].sort((a, b) => {
    return String(a.numero || a.id || "").localeCompare(
      String(b.numero || b.id || ""),
      "it",
      { numeric: true }
    );
  });

  ordinati.forEach(ombrellone => {
    adminDom.umbrellaAdminGrid.appendChild(
      creaSchedaOmbrellone(ombrellone)
    );
  });
}

function creaSchedaOmbrellone(ombrellone) {
  const attivo = normalizzaStatoOmbrellone(ombrellone.stato) === "attivo";

  const card = document.createElement("article");
  card.className = `umbrella-admin-card${attivo ? "" : " blocked"}`;

  const info = document.createElement("div");
  info.className = "umbrella-admin-info";

  const icon = document.createElement("div");
  icon.className = "umbrella-admin-icon";
  icon.textContent = "☂";

  const testi = document.createElement("div");

  const titolo = document.createElement("strong");
  titolo.textContent =
    `Ombrellone ${ombrellone.numero || ombrellone.id}`;

  const dettaglio = document.createElement("span");
  dettaglio.textContent = [
    ombrellone.zona,
    ombrellone.fila ? `Fila ${ombrellone.fila}` : "",
    attivo ? "Disponibile" : "Bloccato"
  ]
    .filter(Boolean)
    .join(" · ");

  testi.append(titolo, dettaglio);
  info.append(icon, testi);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "umbrella-toggle-button";
  button.textContent = attivo ? "Blocca" : "Riattiva";

  button.addEventListener("click", () => {
    cambiaStatoOmbrellone(
      ombrellone,
      attivo ? "bloccato" : "attivo"
    );
  });

  card.append(info, button);
  return card;
}

async function cambiaStatoOmbrellone(ombrellone, nuovoStato) {
  const numero = ombrellone.numero || ombrellone.id;

  if (
    nuovoStato === "bloccato" &&
    !window.confirm(
      `Bloccare l’ombrellone ${numero} per tutte le date?`
    )
  ) {
    return;
  }

  mostraCaricamento("Aggiornamento ombrellone...");

  try {
    const risposta = await richiestaPost({
      action: "aggiornaOmbrellone",
      pin: adminState.pin,
      id: ombrellone.id,
      stato: nuovoStato
    });

    if (!risposta.ok) {
      throw new Error(
        risposta.error || "Aggiornamento non riuscito."
      );
    }

    mostraToast(risposta.message, "success");
    await caricaDatiAreaLido();
  } catch (error) {
    mostraToast(error.message, "error");
  } finally {
    nascondiCaricamento();
  }
}

/* =========================================================
   RETE
   ========================================================= */

function apiConfigurata() {
  return (
    typeof ADMIN_CONFIG.API_URL === "string" &&
    ADMIN_CONFIG.API_URL.startsWith(
      "https://script.google.com/macros/s/"
    ) &&
    ADMIN_CONFIG.API_URL.endsWith("/exec")
  );
}

async function richiestaPost(dati) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, ADMIN_CONFIG.REQUEST_TIMEOUT);

  try {
    const risposta = await fetch(ADMIN_CONFIG.API_URL, {
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
   INTERFACCIA E UTILITÀ
   ========================================================= */

function mostraCaricamento(testo) {
  adminDom.loadingText.textContent = testo || "Caricamento...";
  adminDom.loadingOverlay.classList.remove("hidden");
}

function nascondiCaricamento() {
  adminDom.loadingOverlay.classList.add("hidden");
}

function mostraMessaggio(elemento, testo, tipo) {
  elemento.textContent = testo;
  elemento.classList.remove("success", "error", "warning");

  if (tipo) {
    elemento.classList.add(tipo);
  }
}

function pulisciMessaggio(elemento) {
  mostraMessaggio(elemento, "", "");
}

function mostraToast(messaggio, tipo = "info") {
  clearTimeout(adminState.toastTimer);

  adminDom.toast.classList.remove(
    "hidden",
    "success",
    "error",
    "warning"
  );

  adminDom.toast.classList.add(tipo);

  const icone = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️"
  };

  adminDom.toastIcon.textContent = icone[tipo] || icone.info;
  adminDom.toastMessage.textContent = messaggio;

  adminState.toastTimer = setTimeout(() => {
    adminDom.toast.classList.add("hidden");
  }, 4500);
}

function oggiFormatoInput() {
  const oggi = new Date();

  return [
    oggi.getFullYear(),
    String(oggi.getMonth() + 1).padStart(2, "0"),
    String(oggi.getDate()).padStart(2, "0")
  ].join("-");
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

function normalizzaStato(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
}

function normalizzaStatoOmbrellone(value) {
  const stato = normalizzaStato(value);

  if (
    ["", "attivo", "attiva", "libero", "disponibile"]
      .includes(stato)
  ) {
    return "attivo";
  }

  return "bloccato";
}

function etichettaStato(stato) {
  const etichette = {
    in_attesa: "In attesa",
    confermata: "Confermata",
    annullata: "Annullata"
  };

  return etichette[stato] || stato;
}
