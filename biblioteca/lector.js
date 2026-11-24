"use strict";
const get = id => document.getElementById(id);
const shelf = get("shelf"), page = get("page"), stage = get("stage");
const booksById = new Map(BOOKS.map(book => [book.id, book]));
let book, index = 0, category = "", touchX, touchY;
let progress = {};
try { progress = JSON.parse(localStorage.getItem("zurron-lecturas-v1")) || {}; } catch {}
const normalize = value => value.toLocaleLowerCase("es").normalize("NFD").replace(/\p{M}/gu, "");
const path = (id, i) => "#" + id + "/" + (i + 1);
function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}
const lengthOf = item => item.pages.length + (QUESTIONS[item.id] ? 1 : 0);
function renderShelf() {
  const query = normalize(get("search").value.trim());
  const matches = BOOKS.filter(item => (!category || item.type === category || (category === "Comprensión" && item.activities?.length)) &&
    (/^[a-z]$/u.test(query) ? normalize(item.letter) === query : normalize(item.title + " " + item.letter).includes(query)));
  get("count").textContent = matches.length ? matches.length + (matches.length === 1 ? " lectura" : " lecturas") : "No hay lecturas con esa búsqueda.";
  shelf.replaceChildren(...matches.map(item => {
    const saved = progress[item.id];
    const card = element("a", "card");
    card.href = path(item.id, saved?.finished ? 0 : saved?.index || 0);
    const cover = element("div", "cover");
    const img = element("img");
    img.src = item.cover || item.pages[0];
    img.alt = "";
    img.loading = "lazy";
    cover.append(img);
    if (item.letter) cover.append(element("b", "", item.letter));
    const info = element("div", "info");
    info.append(element("small", "", item.type + (item.activities?.length ? " · Con preguntas" : "")), element("h3", "", item.title),
      element("small", "", saved?.finished ? "Lectura terminada" : saved?.index >= item.pages.length ? "Ir a las preguntas" : saved?.index ? "Continuar · pág. " + (saved.index + 1) : item.pages.length + (item.pages.length === 1 ? " página" : " páginas")));
    card.append(cover, info);
    return card;
  }));
  const latest = BOOKS.filter(item => progress[item.id] && !progress[item.id].finished)
    .sort((a,b) => progress[b.id].time - progress[a.id].time)[0];
  get("resume").hidden = !latest;
  if (latest) get("resume").onclick = () => { location.hash = path(latest.id, progress[latest.id].index); };
}
function showPage() {
  get("page-error").hidden = true;
  page.hidden = false;
  const hasQuiz = Boolean(QUESTIONS[book.id]);
  const playing = hasQuiz && index === book.pages.length;
  stage.hidden = playing;
  get("page-controls").hidden = playing;
  get("zoom").hidden = playing;
  get("progress").hidden = playing;
  get("activity-title").hidden = playing || book.type !== "Comprensión";
  get("activity-title").textContent = "Lee el texto y juega";
  get("jump-activity").hidden = !hasQuiz;
  get("jump-activity").textContent = playing ? "Volver al texto" : "Jugar a las preguntas";
  get("jump-activity").dataset.target = playing ? String(book.pages.length - 1) : String(book.pages.length);
  quiz.hidden = !playing;
  if (playing) showQuiz(book, book.activities?.[0]?.src || (book.type === "Comprensión" ? book.pages[0] : ""), true);
  else {
    page.src = book.pages[index];
    page.alt = book.alts?.[index] || book.title + " · Página " + (index + 1);
  }
  get("number").value = String(index);
  get("prev").disabled = index === 0;
  get("next").disabled = index === lengthOf(book) - 1;
  get("end").hidden = hasQuiz || !get("next").disabled;
  get("next").textContent = index === book.pages.length - 1 && hasQuiz ? "Jugar" : "Siguiente";
  get("progress").max = lengthOf(book);
  get("progress").value = index + 1;
  progress[book.id] = {index, time:Date.now(), finished:!playing && get("next").disabled};
  try { localStorage.setItem("zurron-lecturas-v1", JSON.stringify(progress)); } catch {}
  if (book.pages[index + 1]) new Image().src = book.pages[index + 1];
}
function route() {
  const [id, position] = location.hash.slice(1).split("/");
  const nextBook = booksById.get(id);
  const changed = book !== nextBook;
  book = nextBook;
  get("library").hidden = !!book;
  get("reader").hidden = !book;
  if (!book) { renderShelf(); return; }
  index = Math.max(0, Math.min((Number.parseInt(position, 10) || 1) - 1, lengthOf(book) - 1));
  if (changed) {
    get("book-title").textContent = book.title;
    get("number").replaceChildren(...Array.from({length: lengthOf(book)}, (_, i) => {
      const option = element("option", "", i >= book.pages.length ?
        "Juego de comprensión" : (i + 1) + " de " + book.pages.length);
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
get("filters").addEventListener("click", event => {
  if (!event.target.matches("button")) return;
  category = event.target.dataset.type;
  for (const node of get("filters").querySelectorAll("button")) node.setAttribute("aria-pressed", String(node === event.target));
  renderShelf();
});
get("search").addEventListener("input", renderShelf);
get("jump-activity").onclick = event => move(Number(event.target.dataset.target));
get("prev").onclick = () => move(index - 1);
get("next").onclick = () => move(index + 1);
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
  if (!book || index >= book.pages.length || event.altKey || event.ctrlKey || event.metaKey || event.target.matches("select,input,textarea")) return;
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
get("hero-img").src = "libros/portada.webp";
route();
