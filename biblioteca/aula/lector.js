"use strict";
const get = id => document.getElementById(id);
const shelf = get("shelf"), page = get("page"), stage = get("stage");
let decodificables = [], booksById = new Map(), activeReader = false, routeRun = 0;
let book, index = 0, touchX, touchY;
const SEQUENCE_CARDS = Object.create(null);
function initializeReader(catalog) {
  decodificables = Object.entries(catalog).map(([id, item]) => ({
    ...item,id
  }));
  booksById = new Map(decodificables.map(item => [item.id,item]));
  for (const item of decodificables) if (item.cards.length) {
    SEQUENCE_CARDS[item.id] = [...item.cards].sort((a,b) => a.id-b.id).map(card =>
      [item.pages.indexOf(card.page),card.text,card.ratio,card.crop]);
  }
  activeReader = true;
  route();
}
function clearReader() {
  activeReader = false;
  routeRun++;
  book = undefined;
  get("reader").hidden = true;
  sequencePanel.hidden = true;
  quiz.hidden = true;
  const preview = get("sequence-preview");
  if (preview.open) preview.close();
  sequenceGames.clear();
}
const normalize = value => value.toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "");
const path = (id, i) => "#" + id + "/" + (i + 1);
function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}
const sequenceIndex = item => item.pages.length + Number(Boolean(item.quiz.length));
const lengthOf = item => sequenceIndex(item) + Number(hasSequence(item));
function renderShelf() {
  const query = normalize(get("search").value.trim());
  const matches = decodificables.filter(item =>
    (/^[a-z]$/u.test(query) ? normalize(item.letter) === query : normalize(item.title + " " + item.letter).includes(query)));
  get("count").textContent = matches.length ? matches.length + (matches.length === 1 ? " lectura" : " lecturas") : "No hay lecturas con esa búsqueda.";
  const sections = new Map();
  for (const item of matches) {
    if (!sections.has(item.letter)) sections.set(item.letter, []);
    sections.get(item.letter).push(item);
  }
  const letters = [...sections.keys()].sort((a, b) => a.localeCompare(b, "es"));
  shelf.replaceChildren(...letters.map(letter => {
    const section = element("section", "shelf-letter");
    const heading = element("h3", "", "Letra " + letter);
    heading.id = "letra-" + letter.toLowerCase();
    section.setAttribute("aria-labelledby", heading.id);
    const row = element("div", "shelf-books");
    row.append(...sections.get(letter).map(renderCard));
    section.append(heading, row);
    return section;
  }));
  const latest = decodificables.find(item => item.progress.ultima >= 0 &&
    !item.required.every(key => item.progress.hechas.includes(key)));
  get("resume").hidden = !latest;
  if (latest) get("resume").onclick = () => { location.hash = path(latest.id, latest.progress.ultima); };
}
function renderCard(item) {
  const saved = item.progress;
  const card = element("a", "card");
  card.href = path(item.id, Math.max(0,saved.ultima));
  const cover = element("div", "cover");
  const img = element("img");
  img.src = item.cover || item.pages[0];
  img.alt = "";
  img.loading = "lazy";
  cover.append(img);
  if (item.letter) cover.append(element("b", "", item.letter));
  const info = element("div", "info");
  info.append(element("h4", "", item.title),marks(item,saved));
  card.append(cover, info);
  return card;
}
function showPage() {
  get("page-error").hidden = true;
  page.hidden = false;
  const hasQuiz = Boolean(book.quiz.length);
  const ordering = hasSequence(book) && index === sequenceIndex(book);
  const answering = hasQuiz && index === book.pages.length;
  const playing = ordering || answering;
  stage.hidden = playing;
  get("page-controls").hidden = playing;
  get("zoom").hidden = playing;
  get("progress").hidden = playing;
  get("activity-title").hidden = playing || book.type !== "Comprensión";
  get("activity-title").textContent = "Lee el texto y juega";
  get("jump-activity").hidden = !hasQuiz;
  get("jump-activity").textContent = playing ? "Volver al texto" : "Jugar a las preguntas";
  get("jump-activity").dataset.target = playing ? String(book.pages.length - 1) : String(book.pages.length);
  const sequenceButton = get("jump-sequence");
  sequenceButton.hidden = !hasSequence(book) || ordering;
  get("jump-activity").hidden = !hasQuiz && !ordering;
  const readDone = book.progress.hechas.includes("leer");
  const sections = get("r-sections");
  sections.hidden = false;
  sections.querySelector('[data-section="quiz"]').hidden = !hasQuiz || !readDone;
  sections.querySelector('[data-section="order"]').hidden = !hasSequence(book) || !readDone;
  if (!sections.hidden) {
    get("jump-activity").hidden = true;
    sequenceButton.hidden = true;
    const current = ordering ? "order" : answering ? "quiz" : "read";
    for (const button of sections.querySelectorAll("button")) {
      if (button.dataset.section === current) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    }
  }
  quiz.hidden = !answering;
  sequencePanel.hidden = !ordering;
  const gate = !playing && index === book.gatePage && !book.progress.paso;
  const stop = get("parada");
  stop.hidden = !gate;
  if (gate) {
    const item = book;
    stop.replaceChildren(element("h2","",item.gate.prompt), options(item.gate.options, async choice => {
      const ok = await record(item,"parada",choice);
      if (book === item) showPage();
      note.textContent = ok ? "¡Correcto! Ya puedes seguir." : "Vuelve a mirar la página y prueba otra vez.";
    }));
  }
  if (ordering) showSequence(book);
  else if (answering) showQuiz(book);
  else {
    page.src = book.pages[index];
    page.alt = book.alts?.[index] || book.title + " · Página " + (index + 1);
  }
  get("number").value = String(index);
  get("prev").disabled = index === 0;
  get("next").disabled = gate;
  get("end").hidden = true;
  get("next").textContent = index === book.pages.length - 1 ? "Terminar lectura" : "Siguiente";
  get("progress").max = book.pages.length;
  get("progress").value = Math.min(index + 1,book.pages.length);
  refreshMarks();
  if (book.pages[index + 1]) new Image().src = book.pages[index + 1];
}
function refreshMarks() {
  get("lector-marcas").replaceChildren(marks(book,book.progress));
}
async function route() {
  if (!activeReader) return;
  const run = ++routeRun;
  note.textContent = "";
  const [id, position] = location.hash.slice(1).split("/");
  const nextBook = booksById.get(id);
  const changed = book !== nextBook;
  book = nextBook;
  get("library").hidden = !!book;
  get("reader").hidden = !book;
  if (!book) {
    sequencePanel.hidden = true;
    quiz.hidden = true;
    const preview = get("sequence-preview");
    if (preview.open) preview.close();
    renderShelf();
    if (changed) {
      get("shelf-title").focus({preventScroll: true});
      window.scrollTo(0, 0);
    }
    return;
  }
  index = Math.max(0, Math.min((Number.parseInt(position, 10) || 1) - 1, lengthOf(book) - 1));
  if (index >= book.pages.length && !book.progress.hechas.includes("leer")) {
    location.replace(path(book.id, Math.max(0, book.progress.ultima)));
    return;
  }
  if (index < book.pages.length) {
    const current = book;
    const frontier = Math.min(book.pages.length - 1, book.progress.ultima + 1, book.progress.paso ? Infinity : book.gatePage);
    if (index > frontier) {
      location.replace(path(book.id, frontier));
      return;
    }
    try { await record(current, "pagina", index); }
    catch (error) { if (run === routeRun) note.textContent = error.message; return; }
    if (run !== routeRun) return;
  }
  if (changed || get("reader").dataset.book !== book.id) {
    get("reader").dataset.book = book.id;
    get("book-title").textContent = book.title;
    get("number").replaceChildren(...Array.from({length: lengthOf(book)}, (_, i) => {
      const option = element("option", "", i >= book.pages.length ?
        (i === sequenceIndex(book) ? "Ordenar la lectura" : "Juego de comprensión") : (i + 1) + " de " + book.pages.length);
      option.value = i;
      return option;
    }));
    stage.classList.remove("zoomed");
    get("zoom").textContent = "Ampliar";
    get("zoom").setAttribute("aria-pressed", "false");
    get("book-title").focus();
    window.scrollTo(0, 0);
  }
  showPage();
}
function move(value) {
  if (book && value >= 0 && value < lengthOf(book)) location.hash = path(book.id, value);
}
get("search").addEventListener("input", renderShelf);
get("r-sections").addEventListener("click", event => {
  if (!book || !event.target.matches("button[data-section]")) return;
  const section = event.target.dataset.section;
  if (section === "read" && index < book.pages.length) return;
  move(section === "quiz" ? book.pages.length : section === "order" ? sequenceIndex(book) : 0);
});
get("jump-sequence").onclick = () => move(sequenceIndex(book));
get("jump-activity").onclick = event => move(Number(event.target.dataset.target));
get("prev").onclick = () => move(index - 1);
get("next").onclick = async () => {
  if (index !== book.pages.length - 1) {move(index + 1); return;}
  const item = book;
  try {
    await record(item,"leer");
    if (book === item) { showPage(); note.textContent = "✓ Lectura completada."; }
  } catch (error) { note.textContent = error.message; }
};
get("number").onchange = event => move(Number(event.target.value));
get("zoom").onclick = event => {
  const active = stage.classList.toggle("zoomed");
  event.target.textContent = active ? "Ajustar" : "Ampliar";
  event.target.setAttribute("aria-pressed", String(active));
};
page.onerror = () => { page.hidden = true; get("page-error").hidden = false; };
get("retry").onclick = showPage;
window.addEventListener("hashchange", route);
document.addEventListener("keydown", event => {
  if (!book || index >= book.pages.length || (event.key === "ArrowRight" && index >= book.pages.length - 1) || event.altKey || event.ctrlKey || event.metaKey || event.target.matches("select,input,textarea")) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    move(index + (event.key === "ArrowRight" ? 1 : -1));
  }
});
stage.addEventListener("touchstart", event => { touchX = event.changedTouches[0].clientX; touchY = event.changedTouches[0].clientY; }, {passive:true});
stage.addEventListener("touchend", event => {
  const dx = event.changedTouches[0].clientX - touchX;
  const dy = event.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) move(index + (dx < 0 ? 1 : -1));
}, {passive:true});
get("hero-img").src = "../libros/portada.webp";
load().catch(error => {note.textContent = error.message;});
