/* =========================================================
   AREA LIDO V1.2
   ========================================================= */

const ADMIN_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxImGmbQ-AYdFAgEmyPOSbm1p_2H-C3i7JppvgTiyf7pkRk9U4cvlIkFmYPR4dO0QWgYA/exec",
  REQUEST_TIMEOUT: 45000
};

const adminState = {
  pin: "",
  data: "",
  prenotazioni: [],
  ombrelloni: [],
  blocchiData: [],
  impostazioni: {},
  prossimePrenotazioni: [],
  riepilogoProssime: {},
  whatsappCloud: {},
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
  document.querySelectorAll("[id]").forEach(el => { adminDom[el.id] = el; });
}

function collegaEventi() {
  adminDom.adminLoginForm.addEventListener("submit", eseguiLogin);
  adminDom.adminDate.addEventListener("change", () => {
    adminState.data = adminDom.adminDate.value;
    caricaDatiAreaLido();
  });
  adminDom.adminSearch.addEventListener("input", renderizzaPrenotazioni);
  adminDom.refreshAdminBtn.addEventListener("click", caricaDatiAreaLido);
  adminDom.overviewRefreshBtn.addEventListener("click", caricaDatiAreaLido);
  adminDom.logoutAdminBtn.addEventListener("click", logout);
  adminDom.addUmbrellaBtn.addEventListener("click", () => apriModaleOmbrellone());
  adminDom.umbrellaForm.addEventListener("submit", salvaOmbrellone);
  adminDom.moveForm.addEventListener("submit", spostaPrenotazione);
  adminDom.blockForm.addEventListener("submit", bloccaDataOmbrellone);
  adminDom.settingsForm.addEventListener("submit", salvaImpostazioni);
  adminDom.testEmailBtn.addEventListener("click", inviaEmailTest);
  adminDom.testWhatsappBtn.addEventListener("click", inviaWhatsAppTest);

  document.querySelectorAll(".admin-tab").forEach(button => {
    button.addEventListener("click", () => cambiaTab(button.dataset.tab));
  });

  document.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", () => chiudiModale(button.dataset.closeModal));
  });
}

/* =========================================================
   LOGIN E TABS
   ========================================================= */

async function eseguiLogin(event) {
  event.preventDefault();
  pulisciMessaggio(adminDom.loginMessage);

  if (!apiConfigurata()) {
    mostraMessaggio(adminDom.loginMessage, "Inserisci l’URL della Web App nel file admin.js.", "error");
    return;
  }

  const pin = adminDom.adminPin.value.trim();
  if (!pin) return mostraMessaggio(adminDom.loginMessage, "Inserisci il PIN.", "error");

  mostraCaricamento("Verifica accesso...");
  try {
    const risposta = await richiestaPost({ action: "adminLogin", pin });
    if (!risposta.ok) throw new Error(risposta.error || "Accesso non autorizzato.");
    adminState.pin = pin;
    sessionStorage.setItem("lidoAdminPin", pin);
    mostraDashboard();
    await caricaDatiAreaLido();
  } catch (error) {
    mostraMessaggio(adminDom.loginMessage, error.message || "PIN non corretto.", "error");
  } finally {
    nascondiCaricamento();
  }
}

async function verificaSessioneEsistente() {
  mostraCaricamento("Ripristino sessione...");
  try {
    const risposta = await richiestaPost({ action: "adminLogin", pin: adminState.pin });
    if (!risposta.ok) throw new Error("Sessione non valida.");
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
  sessionStorage.removeItem("lidoAdminPin");
  adminDom.adminDashboard.classList.add("hidden");
  adminDom.adminLoginSection.classList.remove("hidden");
  adminDom.adminPin.value = "";
  if (mostraAvviso) mostraToast("Sessione terminata.", "info");
}

function cambiaTab(nome) {
  document.querySelectorAll(".admin-tab").forEach(el => el.classList.toggle("active", el.dataset.tab === nome));
  document.querySelectorAll(".tab-panel").forEach(el => el.classList.toggle("active", el.id === `tab-${nome}`));
}

/* =========================================================
   CARICAMENTO E RENDER
   ========================================================= */

async function caricaDatiAreaLido() {
  if (!adminState.pin) return;
  const data = adminDom.adminDate.value || oggiFormatoInput();
  adminState.data = data;
  mostraCaricamento("Caricamento dati...");

  try {
    const risposta = await richiestaPost({ action: "adminDati", pin: adminState.pin, data });
    if (!risposta.ok) {
      if (risposta.code === "UNAUTHORIZED") logout(false);
      throw new Error(risposta.error || "Impossibile caricare i dati.");
    }

    adminState.prenotazioni = Array.isArray(risposta.prenotazioni) ? risposta.prenotazioni : [];
    adminState.ombrelloni = Array.isArray(risposta.ombrelloni) ? risposta.ombrelloni : [];
    adminState.blocchiData = Array.isArray(risposta.blocchiData) ? risposta.blocchiData : [];
    adminState.impostazioni = risposta.impostazioni || {};
    adminState.prossimePrenotazioni = Array.isArray(risposta.prossimePrenotazioni)
      ? risposta.prossimePrenotazioni
      : [];
    adminState.riepilogoProssime = risposta.riepilogoProssime || {};
    adminState.whatsappCloud = risposta.whatsappCloud || {};
    renderizzaTutto();
  } catch (error) {
    mostraToast(error.message || "Errore durante il caricamento.", "error");
  } finally {
    nascondiCaricamento();
  }
}

function renderizzaTutto() {
  adminDom.adminBrandName.textContent = adminState.impostazioni.nomeLido || "Area lido";
  renderizzaPanoramica();
  renderizzaStatistiche();
  renderizzaPrenotazioni();
  renderizzaOmbrelloni();
  popolaImpostazioni();
  renderizzaStatoWhatsApp();
  adminDom.bookingListTitle.textContent = `Prenotazioni del ${formattaDataItaliana(adminState.data)}`;
  adminDom.lastUpdateText.textContent = `Aggiornato alle ${new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
}

function renderizzaStatistiche() {
  const stati = adminState.prenotazioni.map(p => normalizzaStato(p.stato));
  const pending = stati.filter(s => s === "in_attesa").length;
  adminDom.statTotal.textContent = adminState.prenotazioni.length;
  adminDom.statPending.textContent = pending;
  adminDom.statConfirmed.textContent = stati.filter(s => s === "confermata").length;
  adminDom.statCancelled.textContent = stati.filter(s => s === "annullata").length;
  const pendingFuturi = Number(
    adminState.riepilogoProssime.inAttesa || 0
  );

  adminDom.pendingBadge.textContent = pendingFuturi;
  adminDom.pendingBadge.classList.toggle(
    "hidden",
    pendingFuturi === 0
  );
}

/* =========================================================
   PANORAMICA PRENOTAZIONI FUTURE
   ========================================================= */

function renderizzaPanoramica() {
  const riepilogo = adminState.riepilogoProssime || {};
  const prenotazioni = adminState.prossimePrenotazioni || [];

  adminDom.overviewTotal.textContent = String(riepilogo.totale || 0);
  adminDom.overviewPending.textContent = String(riepilogo.inAttesa || 0);
  adminDom.overviewConfirmed.textContent = String(riepilogo.confermate || 0);
  adminDom.overviewDays.textContent = String(riepilogo.giornate || 0);

  const giorni = Number(riepilogo.giorni || 60);
  const dataFine = riepilogo.dataFine
    ? formattaDataItaliana(riepilogo.dataFine)
    : "";

  adminDom.overviewPeriodText.textContent =
    `Prenotazioni da oggi ai prossimi ${giorni} giorni` +
    (dataFine ? ` · fino al ${dataFine}` : "");

  adminDom.overviewList.innerHTML = "";
  adminDom.overviewEmptyState.classList.toggle(
    "hidden",
    prenotazioni.length > 0
  );

  if (!prenotazioni.length) {
    return;
  }

  const gruppi = {};

  prenotazioni.forEach(p => {
    const data = String(p.data || "");

    if (!gruppi[data]) {
      gruppi[data] = [];
    }

    gruppi[data].push(p);
  });

  Object.keys(gruppi)
    .sort()
    .forEach(data => {
      adminDom.overviewList.appendChild(
        creaGruppoPanoramica(data, gruppi[data])
      );
    });
}

function creaGruppoPanoramica(data, prenotazioni) {
  const section = document.createElement("section");
  section.className = "overview-day-group";

  const pending = prenotazioni.filter(
    p => normalizzaStato(p.stato) === "in_attesa"
  ).length;

  const header = document.createElement("div");
  header.className = "overview-day-header";

  const title = document.createElement("div");
  title.innerHTML =
    `<span>${escapeHtml(nomeGiornoItaliano(data))}</span>` +
    `<h3>${escapeHtml(formattaDataItaliana(data))}</h3>` +
    `<p>${prenotazioni.length} prenotazion${prenotazioni.length === 1 ? "e" : "i"}` +
    `${pending ? ` · ${pending} da confermare` : ""}</p>`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary-button overview-open-day";
  button.textContent = "Apri giornata";
  button.addEventListener("click", () => apriGiornataPanoramica(data));

  header.append(title, button);

  const list = document.createElement("div");
  list.className = "overview-day-bookings";

  prenotazioni.forEach(p => {
    list.appendChild(creaRigaPanoramica(p));
  });

  section.append(header, list);
  return section;
}

function creaRigaPanoramica(p) {
  const stato = normalizzaStato(p.stato);
  const row = document.createElement("article");
  row.className = `overview-booking-row status-${stato}`;

  const umbrella = document.createElement("div");
  umbrella.className = "overview-umbrella";
  umbrella.innerHTML =
    `<span>Ombrellone</span><strong>${escapeHtml(p.ombrellone || "—")}</strong>`;

  const customer = document.createElement("div");
  customer.className = "overview-customer";
  customer.innerHTML =
    `<strong>${escapeHtml(p.nome || "Cliente")}</strong>` +
    `<span>${escapeHtml(p.telefono || "")}</span>`;

  const details = document.createElement("div");
  details.className = "overview-details";
  details.innerHTML =
    `<span>${Number(p.persone || 0)} persone</span>` +
    `<span class="booking-status-badge ${stato}">${etichettaStato(stato)}</span>`;

  row.append(umbrella, customer, details);
  return row;
}

async function apriGiornataPanoramica(data) {
  adminDom.adminDate.value = data;
  adminState.data = data;
  cambiaTab("prenotazioni");
  await caricaDatiAreaLido();
}

function nomeGiornoItaliano(dataIso) {
  const parti = String(dataIso || "").split("-");

  if (parti.length !== 3) {
    return "";
  }

  const data = new Date(
    Number(parti[0]),
    Number(parti[1]) - 1,
    Number(parti[2])
  );

  return data.toLocaleDateString("it-IT", {
    weekday: "long"
  });
}

/* =========================================================
   PRENOTAZIONI, WHATSAPP E SPOSTAMENTO
   ========================================================= */

function renderizzaPrenotazioni() {
  const ricerca = adminDom.adminSearch.value.trim().toLowerCase();
  const filtrate = adminState.prenotazioni.filter(p => {
    if (!ricerca) return true;
    return [p.id, p.ombrellone, p.nome, p.telefono, p.email, p.note, p.stato].join(" ").toLowerCase().includes(ricerca);
  });

  adminDom.bookingList.innerHTML = "";
  adminDom.bookingEmptyState.classList.toggle("hidden", filtrate.length > 0);
  filtrate.forEach(p => adminDom.bookingList.appendChild(creaSchedaPrenotazione(p)));
}

function creaSchedaPrenotazione(p) {
  const stato = normalizzaStato(p.stato);
  const card = document.createElement("article");
  card.className = `booking-admin-card status-${stato}`;

  const numeroBox = document.createElement("div");
  numeroBox.className = "booking-umbrella-number";
  numeroBox.innerHTML = `<span>Ombrellone</span><strong>${escapeHtml(p.ombrellone || "—")}</strong>`;

  const cliente = document.createElement("div");
  cliente.className = "booking-customer";
  const emailHtml = p.email ? `<p class="customer-email">${escapeHtml(p.email)}</p>` : "";
  const noteHtml = p.note ? `<p class="booking-note">${escapeHtml(p.note)}</p>` : "";
  cliente.innerHTML = `<h3>${escapeHtml(p.nome || "Cliente")}</h3><p><a href="tel:${telefonoPerLink(p.telefono)}">${escapeHtml(p.telefono || "Telefono non disponibile")}</a></p>${emailHtml}${noteHtml}`;

  const dettagli = document.createElement("div");
  dettagli.className = "booking-details";
  dettagli.innerHTML = `<span class="booking-status-badge ${stato}">${etichettaStato(stato)}</span><p>Persone: ${Number(p.persone || 0)}</p><p>Inserita: ${escapeHtml(p.creatoIl || "—")}</p><p>Codice: ${escapeHtml(p.id || "—")}</p>`;

  const azioni = document.createElement("div");
  azioni.className = "booking-actions";
  azioni.append(
    creaPulsanteAzione("Conferma", "confirm", stato === "confermata", () => cambiaStatoPrenotazione(p, "confermata")),
    creaPulsanteAzione("In attesa", "waiting", stato === "in_attesa", () => cambiaStatoPrenotazione(p, "in_attesa")),
    creaPulsanteAzione("Annulla", "cancel", stato === "annullata", () => cambiaStatoPrenotazione(p, "annullata"))
  );

  const secondarie = document.createElement("div");
  secondarie.className = "booking-actions-secondary";
  secondarie.append(
    creaPulsanteAzione("Sposta", "move", stato === "annullata", () => apriModaleSpostamento(p)),
    creaPulsanteAzione("WhatsApp", "whatsapp", !p.telefono, () => apriWhatsApp(p))
  );
  azioni.appendChild(secondarie);

  card.append(numeroBox, cliente, dettagli, azioni);
  return card;
}

function creaPulsanteAzione(testo, classe, disabled, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `admin-action-button ${classe}`;
  button.textContent = testo;
  button.disabled = disabled;
  button.addEventListener("click", callback);
  return button;
}

async function cambiaStatoPrenotazione(p, stato) {
  if (stato === "annullata" && !confirm(`Annullare la prenotazione di ${p.nome}?`)) return;
  mostraCaricamento("Aggiornamento prenotazione...");
  try {
    const r = await richiestaPost({ action: "aggiornaStato", pin: adminState.pin, id: p.id, stato });
    if (!r.ok) throw new Error(r.error || "Aggiornamento non riuscito.");
    mostraToast(r.message, "success");
    await caricaDatiAreaLido();
  } catch (error) { mostraToast(error.message, "error"); }
  finally { nascondiCaricamento(); }
}

function apriWhatsApp(p) {
  const telefono = numeroWhatsApp(p.telefono);
  if (!telefono) return mostraToast("Numero di telefono non valido.", "warning");
  const lido = adminState.impostazioni.nomeLido || "il lido";
  const stato = etichettaStato(p.stato).toLowerCase();
  const testo = `Ciao ${p.nome}, la tua prenotazione presso ${lido} per il ${formattaDataItaliana(p.data)}, ombrellone ${p.ombrellone}, risulta ${stato}. Codice: ${p.id}.`;
  window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(testo)}`, "_blank", "noopener");
}

function apriModaleSpostamento(p) {
  adminDom.moveBookingId.value = p.id;
  adminDom.moveBookingText.textContent = `${p.nome} · ${formattaDataItaliana(p.data)} · ombrellone attuale ${p.ombrellone}`;
  adminDom.moveUmbrellaSelect.innerHTML = "";

  const disponibili = adminState.ombrelloni.filter(o => {
    const attivo = normalizzaStatoOmbrellone(o.stato) === "attivo";
    const bloccato = adminState.blocchiData.some(b => String(b.ombrellone) === String(o.id));
    const occupato = adminState.prenotazioni.some(x =>
      x.id !== p.id &&
      normalizzaStato(x.stato) !== "annullata" &&
      riferimentoOmbrelloneUguale(x.ombrellone, o)
    );
    const corrente = riferimentoOmbrelloneUguale(p.ombrellone, o);
    return attivo && !bloccato && !occupato && !corrente;
  });

  disponibili.forEach(o => {
    const option = document.createElement("option");
    option.value = o.id;
    option.textContent = `Ombrellone ${o.numero || o.id} · ${o.zona || ""} ${o.fila ? `· fila ${o.fila}` : ""}`;
    adminDom.moveUmbrellaSelect.appendChild(option);
  });

  if (!disponibili.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nessun ombrellone disponibile";
    adminDom.moveUmbrellaSelect.appendChild(option);
  }

  apriModale("moveModal");
}

async function spostaPrenotazione(event) {
  event.preventDefault();
  if (!adminDom.moveUmbrellaSelect.value) return mostraToast("Nessun ombrellone disponibile.", "warning");
  mostraCaricamento("Spostamento prenotazione...");
  try {
    const r = await richiestaPost({ action: "spostaPrenotazione", pin: adminState.pin, id: adminDom.moveBookingId.value, ombrellone: adminDom.moveUmbrellaSelect.value });
    if (!r.ok) throw new Error(r.error || "Spostamento non riuscito.");
    chiudiModale("moveModal");
    mostraToast(r.message, "success");
    await caricaDatiAreaLido();
  } catch (error) { mostraToast(error.message, "error"); }
  finally { nascondiCaricamento(); }
}

/* =========================================================
   OMBRELLONI AVANZATI
   ========================================================= */

function renderizzaOmbrelloni() {
  adminDom.umbrellaAdminGrid.innerHTML = "";
  [...adminState.ombrelloni]
    .sort((a, b) => String(a.numero || a.id).localeCompare(String(b.numero || b.id), "it", { numeric: true }))
    .forEach(o => adminDom.umbrellaAdminGrid.appendChild(creaSchedaOmbrellone(o)));
}

function creaSchedaOmbrellone(o) {
  const attivo = normalizzaStatoOmbrellone(o.stato) === "attivo";
  const bloccoData = adminState.blocchiData.find(b => riferimentoOmbrelloneUguale(b.ombrellone, o));
  const prenotazioneData = adminState.prenotazioni.find(p =>
    normalizzaStato(p.stato) !== "annullata" && riferimentoOmbrelloneUguale(p.ombrellone, o)
  );
  const card = document.createElement("article");
  card.className = `umbrella-admin-card${attivo ? "" : " blocked"}`;

  const top = document.createElement("div");
  top.className = "umbrella-admin-top";
  top.innerHTML = `<div class="umbrella-admin-info"><div class="umbrella-admin-icon">☂</div><div><strong>Ombrellone ${escapeHtml(o.numero || o.id)}</strong><span>${escapeHtml(o.zona || "")} ${o.fila ? `· Fila ${escapeHtml(o.fila)}` : ""}<br>${attivo ? "Attivo" : "Bloccato globalmente"}</span></div></div>`;

  const dateStatus = document.createElement("div");
  dateStatus.className = `umbrella-date-status${bloccoData ? " blocked" : ""}`;
  if (bloccoData) {
    dateStatus.textContent = `Bloccato il ${formattaDataItaliana(adminState.data)}: ${bloccoData.motivo || "Non disponibile"}`;
  } else if (prenotazioneData) {
    dateStatus.classList.add("blocked");
    dateStatus.textContent = `Occupato il ${formattaDataItaliana(adminState.data)} da ${prenotazioneData.nome}`;
  } else {
    dateStatus.textContent = `Disponibile il ${formattaDataItaliana(adminState.data)}`;
  }

  const actions = document.createElement("div");
  actions.className = "umbrella-admin-actions";
  actions.append(
    creaUmbrellaButton("Modifica", "edit", () => apriModaleOmbrellone(o)),
    creaUmbrellaButton(attivo ? "Blocca sempre" : "Riattiva sempre", attivo ? "global-block" : "unblock", () => cambiaStatoOmbrellone(o, attivo ? "bloccato" : "attivo")),
    creaUmbrellaButton(bloccoData ? "Sblocca data" : "Blocca data", bloccoData ? "unblock" : "date-block", () => bloccoData ? sbloccaDataOmbrellone(o) : apriModaleBlocco(o)),
    creaUmbrellaButton("Elimina", "delete", () => eliminaOmbrellone(o))
  );

  card.append(top, dateStatus, actions);
  return card;
}

function creaUmbrellaButton(testo, classe, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `umbrella-card-button ${classe}`;
  button.textContent = testo;
  button.addEventListener("click", callback);
  return button;
}

function apriModaleOmbrellone(o = null) {
  adminDom.umbrellaModalTitle.textContent = o ? "Modifica ombrellone" : "Aggiungi ombrellone";
  adminDom.umbrellaEditId.value = o ? o.id : "";
  adminDom.umbrellaNumber.value = o ? o.numero : "";
  adminDom.umbrellaRow.value = o ? o.fila : "";
  adminDom.umbrellaZone.value = o ? o.zona : "Settore centrale";
  adminDom.umbrellaStatus.value = o ? normalizzaStatoOmbrellone(o.stato) : "attivo";
  apriModale("umbrellaModal");
}

async function salvaOmbrellone(event) {
  event.preventDefault();
  mostraCaricamento("Salvataggio ombrellone...");
  try {
    const r = await richiestaPost({
      action: "salvaOmbrellone",
      pin: adminState.pin,
      ombrellone: {
        id: adminDom.umbrellaEditId.value,
        numero: adminDom.umbrellaNumber.value.trim(),
        fila: adminDom.umbrellaRow.value.trim(),
        zona: adminDom.umbrellaZone.value.trim(),
        stato: adminDom.umbrellaStatus.value
      }
    });
    if (!r.ok) throw new Error(r.error || "Salvataggio non riuscito.");
    chiudiModale("umbrellaModal");
    mostraToast(r.message, "success");
    await caricaDatiAreaLido();
  } catch (error) { mostraToast(error.message, "error"); }
  finally { nascondiCaricamento(); }
}

async function cambiaStatoOmbrellone(o, stato) {
  if (stato === "bloccato" && !confirm(`Bloccare l'ombrellone ${o.numero || o.id} per tutte le date?`)) return;
  await eseguiAzioneOmbrellone({ action: "aggiornaOmbrellone", id: o.id, stato });
}

function apriModaleBlocco(o) {
  adminDom.blockUmbrellaId.value = o.id;
  adminDom.blockUmbrellaText.textContent = `Ombrellone ${o.numero || o.id} · ${formattaDataItaliana(adminState.data)}`;
  adminDom.blockReason.value = "Non disponibile";
  apriModale("blockModal");
}

async function bloccaDataOmbrellone(event) {
  event.preventDefault();
  await eseguiAzioneOmbrellone({ action: "bloccaOmbrelloneData", ombrellone: adminDom.blockUmbrellaId.value, data: adminState.data, motivo: adminDom.blockReason.value.trim() }, "blockModal");
}

async function sbloccaDataOmbrellone(o) {
  await eseguiAzioneOmbrellone({ action: "sbloccaOmbrelloneData", ombrellone: o.id, data: adminState.data });
}

async function eliminaOmbrellone(o) {
  if (!confirm(`Eliminare definitivamente l'ombrellone ${o.numero || o.id}?`)) return;
  await eseguiAzioneOmbrellone({ action: "eliminaOmbrellone", id: o.id });
}

async function eseguiAzioneOmbrellone(payload, modalDaChiudere = "") {
  mostraCaricamento("Aggiornamento ombrellone...");
  try {
    const r = await richiestaPost({ ...payload, pin: adminState.pin });
    if (!r.ok) throw new Error(r.error || "Operazione non riuscita.");
    if (modalDaChiudere) chiudiModale(modalDaChiudere);
    mostraToast(r.message, "success");
    await caricaDatiAreaLido();
  } catch (error) { mostraToast(error.message, "error"); }
  finally { nascondiCaricamento(); }
}

/* =========================================================
   IMPOSTAZIONI E EMAIL
   ========================================================= */

function popolaImpostazioni() {
  const s = adminState.impostazioni;
  const map = {
    settingNomeLido: "nomeLido", settingSottotitolo: "sottotitolo",
    settingTelefonoLido: "telefonoLido", settingWhatsappLido: "whatsappLido",
    settingEmailLido: "emailLido", settingDataApertura: "dataApertura",
    settingDataChiusura: "dataChiusura", settingAnticipoMinimo: "anticipoMinimo",
    settingAnticipoMassimo: "anticipoMassimo", settingMaxPersone: "maxPersone",
    settingGiorniPanoramica: "giorniPanoramica",
    settingDateChiuse: "dateChiuse", settingMessaggioHome: "messaggioHome",
    settingMessaggioInformativo: "messaggioInformativo"
  };
  Object.entries(map).forEach(([id, key]) => {
    const value = s[key];
    adminDom[id].value = Array.isArray(value) ? value.join(", ") : (value || "");
  });

  [
    ["settingConfermaAutomatica", "confermaAutomatica"],
    ["settingAnnullamentoCliente", "annullamentoCliente"],
    ["settingEmailAdminNuova", "emailAdminNuova"],
    ["settingEmailClienteStato", "emailClienteStato"],
    ["settingEmailClienteObbligatoria", "emailClienteObbligatoria"],
    ["settingWhatsappAdminNuova", "whatsappAdminNuova"],
    ["settingWhatsappAdminAnnullamento", "whatsappAdminAnnullamento"]
  ].forEach(([id, key]) => { adminDom[id].checked = valoreBooleano(s[key]); });

  const giorni = String(s.giorniChiusi || "").split(",").map(x => x.trim()).filter(Boolean);
  document.querySelectorAll('input[name="closedDay"]').forEach(input => { input.checked = giorni.includes(input.value); });
}

async function salvaImpostazioni(event) {
  event.preventDefault();
  const giorniChiusi = [...document.querySelectorAll('input[name="closedDay"]:checked')].map(i => i.value).join(",");
  const impostazioni = {
    nomeLido: adminDom.settingNomeLido.value.trim(),
    sottotitolo: adminDom.settingSottotitolo.value.trim(),
    telefonoLido: adminDom.settingTelefonoLido.value.trim(),
    whatsappLido: adminDom.settingWhatsappLido.value.trim(),
    emailLido: adminDom.settingEmailLido.value.trim(),
    dataApertura: adminDom.settingDataApertura.value,
    dataChiusura: adminDom.settingDataChiusura.value,
    giorniChiusi,
    dateChiuse: adminDom.settingDateChiuse.value.trim(),
    anticipoMinimo: adminDom.settingAnticipoMinimo.value,
    anticipoMassimo: adminDom.settingAnticipoMassimo.value,
    maxPersone: adminDom.settingMaxPersone.value,
    giorniPanoramica: adminDom.settingGiorniPanoramica.value,
    confermaAutomatica: adminDom.settingConfermaAutomatica.checked,
    annullamentoCliente: adminDom.settingAnnullamentoCliente.checked,
    emailAdminNuova: adminDom.settingEmailAdminNuova.checked,
    emailClienteStato: adminDom.settingEmailClienteStato.checked,
    emailClienteObbligatoria: adminDom.settingEmailClienteObbligatoria.checked,
    whatsappAdminNuova: adminDom.settingWhatsappAdminNuova.checked,
    whatsappAdminAnnullamento: adminDom.settingWhatsappAdminAnnullamento.checked,
    messaggioHome: adminDom.settingMessaggioHome.value.trim(),
    messaggioInformativo: adminDom.settingMessaggioInformativo.value.trim()
  };

  mostraCaricamento("Salvataggio impostazioni...");
  try {
    const r = await richiestaPost({ action: "salvaImpostazioni", pin: adminState.pin, impostazioni });
    if (!r.ok) throw new Error(r.error || "Salvataggio non riuscito.");
    adminState.impostazioni = r.impostazioni || impostazioni;
    mostraToast(r.message, "success");
    renderizzaTutto();
  } catch (error) { mostraToast(error.message, "error"); }
  finally { nascondiCaricamento(); }
}

function renderizzaStatoWhatsApp() {
  const stato = adminState.whatsappCloud || {};
  const configurato = Boolean(stato.configurato);

  adminDom.whatsappCloudStatus.classList.toggle(
    "configured",
    configurato
  );

  adminDom.whatsappCloudTitle.textContent = configurato
    ? "WhatsApp automatico configurato"
    : "WhatsApp automatico non configurato";

  if (configurato) {
    adminDom.whatsappCloudDescription.textContent =
      `Destinatario ${stato.destinatario || ""}` +
      ` · template ${stato.template || ""}` +
      ` · lingua ${stato.lingua || "it"}`;

    adminDom.testWhatsappBtn.disabled = false;
  } else {
    const mancanti = Array.isArray(stato.mancanti)
      ? stato.mancanti.join(", ")
      : "credenziali Cloud API";

    adminDom.whatsappCloudDescription.textContent =
      `Mancano: ${mancanti}. Configurali nelle Proprietà script di Apps Script.`;

    adminDom.testWhatsappBtn.disabled = true;
  }
}

async function inviaEmailTest() {
  mostraCaricamento("Invio email di prova...");
  try {
    const r = await richiestaPost({ action: "inviaEmailTest", pin: adminState.pin });
    if (!r.ok) throw new Error(r.error || "Invio non riuscito.");
    mostraToast(r.message, "success");
  } catch (error) { mostraToast(error.message, "error"); }
  finally { nascondiCaricamento(); }
}

async function inviaWhatsAppTest() {
  mostraCaricamento("Invio WhatsApp di prova...");

  try {
    const r = await richiestaPost({
      action: "inviaWhatsAppTest",
      pin: adminState.pin
    });

    if (!r.ok) {
      throw new Error(r.error || "Invio WhatsApp non riuscito.");
    }

    mostraToast(r.message, "success");
  } catch (error) {
    mostraToast(error.message, "error");
  } finally {
    nascondiCaricamento();
  }
}

/* =========================================================
   MODALI, RETE E UTILITÀ
   ========================================================= */

function apriModale(id) { adminDom[id].classList.remove("hidden"); document.body.style.overflow = "hidden"; }
function chiudiModale(id) { adminDom[id].classList.add("hidden"); document.body.style.overflow = ""; }

function apiConfigurata() {
  return typeof ADMIN_CONFIG.API_URL === "string" && ADMIN_CONFIG.API_URL.startsWith("https://script.google.com/macros/s/") && ADMIN_CONFIG.API_URL.endsWith("/exec");
}

async function richiestaPost(dati) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADMIN_CONFIG.REQUEST_TIMEOUT);
  try {
    const response = await fetch(ADMIN_CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(dati),
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });
    const testo = await response.text();
    if (!response.ok) throw new Error(`Errore del server (${response.status}).`);
    try { return JSON.parse(testo); } catch { throw new Error("Il server non ha restituito una risposta valida."); }
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Il collegamento al server ha impiegato troppo tempo.");
    throw error;
  } finally { clearTimeout(timer); }
}

function mostraCaricamento(testo) { adminDom.loadingText.textContent = testo || "Caricamento..."; adminDom.loadingOverlay.classList.remove("hidden"); }
function nascondiCaricamento() { adminDom.loadingOverlay.classList.add("hidden"); }
function mostraMessaggio(el, testo, tipo = "") { el.textContent = testo; el.classList.remove("success", "error", "warning"); if (tipo) el.classList.add(tipo); }
function pulisciMessaggio(el) { mostraMessaggio(el, ""); }
function mostraToast(messaggio, tipo = "info") {
  clearTimeout(adminState.toastTimer);
  adminDom.toast.classList.remove("hidden", "success", "error", "warning");
  adminDom.toast.classList.add(tipo);
  adminDom.toastIcon.textContent = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" }[tipo] || "ℹ️";
  adminDom.toastMessage.textContent = messaggio;
  adminState.toastTimer = setTimeout(() => adminDom.toast.classList.add("hidden"), 4500);
}

function oggiFormatoInput() { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); }
function formattaDataItaliana(v) { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || "—"); }
function normalizzaStato(v) { return String(v || "").trim().toLowerCase().replace(/-/g,"_").replace(/\s+/g,"_"); }
function normalizzaStatoOmbrellone(v) { return ["", "attivo", "attiva", "libero", "disponibile"].includes(normalizzaStato(v)) ? "attivo" : "bloccato"; }
function etichettaStato(v) { return { in_attesa: "In attesa", confermata: "Confermata", annullata: "Annullata" }[normalizzaStato(v)] || v; }
function valoreBooleano(v) { return v === true || String(v).toLowerCase() === "true" || String(v) === "1"; }
function telefonoPerLink(v) { return String(v || "").replace(/[^\d+]/g, ""); }
function numeroWhatsApp(v) { let n = String(v || "").replace(/\D/g, ""); if (n.startsWith("00")) n = n.slice(2); if (n.length === 10 && n.startsWith("3")) n = "39" + n; return n; }
function riferimentoOmbrelloneUguale(riferimento, ombrellone) {
  return String(riferimento == null ? "" : riferimento).trim() === String(ombrellone.id == null ? "" : ombrellone.id).trim() ||
    String(riferimento == null ? "" : riferimento).trim() === String(ombrellone.numero == null ? "" : ombrellone.numero).trim();
}
function escapeHtml(v) { return String(v == null ? "" : v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
