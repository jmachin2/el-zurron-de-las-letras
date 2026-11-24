"use strict";
const sequencePanel = document.getElementById("sequence");
const sequenceMoments = ["Primero", "Luego", "Después", "Al final"];
const sequenceBoard = document.getElementById("sequence-board");
const sequenceLinks = document.getElementById("sequence-links");
const sequenceColors = ["#176652", "#245a9c", "#80457c", "#9a4f15"];
let redrawSequence = () => {};
new ResizeObserver(() => redrawSequence()).observe(sequenceBoard);
const sequenceGames = new Map();
const sequencePages = {
  "mi-mama-se-llama-mifaya": [2,4,6,10],
  "la-fiesta-de-la-pandorga": [1,3,4,6],
  "la-luna-y-la-lava": [1,2,4,6],
  "timplillo-se-va-de-tenderete": [1,3,5,6]
};

function hasSequence(item) {
  return item.type === "Decodificables" && item.pages.length >= 5;
}

function showSequence(item, focusHeading = true) {
  const pageIndices = sequencePages[item.id] || [1,3,5,item.pages.length - 1];
  if (!sequenceGames.has(item.id)) sequenceGames.set(item.id, newSequence());
  const game = sequenceGames.get(item.id);
  const scenes = document.getElementById("sequence-scenes");
  const targets = document.getElementById("sequence-moments");
  const info = document.getElementById("sequence-feedback");
  const check = document.getElementById("sequence-check");
  const heading = document.getElementById("sequence-title");
  const preview = document.getElementById("sequence-preview");
  const previewImage = document.getElementById("sequence-preview-image");
  const enlarge = document.getElementById("sequence-enlarge");
  enlarge.onclick = () => {
    const zoomed = preview.classList.toggle("enlarged");
    enlarge.textContent = zoomed ? "Ajustar" : "Más grande";
    enlarge.setAttribute("aria-pressed", String(zoomed));
  };

  const cards = game.order.map((scene, cardIndex) => {
    const card = document.createElement("div");
    card.className = "sequence-card";
    const button = document.createElement("button");
    button.type = "button";
    const badge = document.createElement("span");
    badge.textContent = String.fromCharCode(65 + cardIndex);
    const image = document.createElement("img");
    image.src = item.pages[pageIndices[scene]];
    image.alt = (item.alts?.[pageIndices[scene]] || "").trim();
    button.setAttribute("aria-label", "Imagen " + badge.textContent + (image.alt ? ". " + image.alt : ""));
    button.append(badge, image);
    button.style.setProperty("--pair-color", sequenceColors[cardIndex]);
    image.draggable = false;

    const place = () => {
      if (game.selected === null) {
        info.textContent = "Elige primero una palabra de la izquierda.";
        return;
      }
      const previous = game.matches.indexOf(scene);
      if (previous !== -1) game.matches[previous] = null;
      game.matches[game.selected] = scene;
      game.selected = null;
      game.checked = false;
      refresh();
    };
    button.onclick = place;
    button.ondragover = event => {
      if (game.selected === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      button.classList.add("drop-target");
    };
    button.ondragleave = () => button.classList.remove("drop-target");
    button.ondrop = event => {
      event.preventDefault();
      button.classList.remove("drop-target");
      if (event.dataTransfer.getData("text/plain") === "momento:" + game.selected) place();
    };

    const read = document.createElement("button");
    read.type = "button";
    read.className = "sequence-read secondary";
    read.textContent = "Leer";
    read.setAttribute("aria-label", "Leer imagen " + badge.textContent + " en grande");
    read.onclick = () => {
      document.getElementById("sequence-preview-title").textContent = "Imagen " + badge.textContent;
      previewImage.src = image.src;
      previewImage.alt = image.alt || "Imagen " + badge.textContent + " de " + item.title;
      preview.classList.remove("enlarged");
      enlarge.textContent = "Más grande";
      enlarge.setAttribute("aria-pressed", "false");
      preview.showModal();
      previewImage.parentElement.scrollTo(0, 0);
    };
    card.append(button, read);
    return {card, button};
  });
  const spaces = sequenceMoments.map((label, position) => {
    const button = document.createElement("button");
    button.type = "button";
    button.draggable = true;
    const select = () => {
      game.selected = position;
      refresh();
      info.textContent = label + " seleccionado. Elige su imagen.";
    };
    button.onclick = select;
    button.ondragstart = event => {
      event.dataTransfer.setData("text/plain", "momento:" + position);
      event.dataTransfer.effectAllowed = "move";
      select();
    };
    return button;
  });
  scenes.replaceChildren(...cards.map(entry => entry.card));
  targets.replaceChildren(...spaces);
  check.onclick = () => { game.checked = true; refresh(); };
  document.getElementById("sequence-reset").onclick = () => {
    const next = newSequence();
    if (next.order.every((v, i) => v === game.order[i])) next.order.push(next.order.shift());
    sequenceGames.set(item.id, next);
    showSequence(item);
  };
  redrawSequence = drawLinks;
  refresh();
  if (focusHeading) heading.focus();

  function refresh() {
    let placed = 0;
    let correct = 0;
    for (const [i, scene] of game.order.entries()) {
      cards[i].button.classList.toggle("assigned", game.matches.includes(scene));
    }
    for (const [i, moment] of sequenceMoments.entries()) {
      const scene = game.matches[i];
      const cell = spaces[i];
      const ok = scene === i;
      if (scene !== null) placed++;
      if (ok) correct++;
      cell.setAttribute("aria-pressed", String(game.selected === i));
      cell.style.setProperty("--pair-color", scene === null ? "#b7c9c0" : sequenceColors[game.order.indexOf(scene)]);
      cell.textContent = moment + (scene === null ? "" : " · " + String.fromCharCode(65 + game.order.indexOf(scene)));
      if (game.checked) {
        cell.dataset.result = ok ? "correct" : "review";
        cell.textContent += ok ? " ✓" : " · Revisar";
      } else {
        delete cell.dataset.result;
      }
    }
    drawLinks();
    check.disabled = placed !== sequenceMoments.length;
    info.textContent = game.checked
      ? (correct === sequenceMoments.length ? "¡Muy bien! Has ordenado la lectura." : correct + " de 4 correctas. Puedes cambiar las parejas.")
      : placed + " de 4 parejas";
  }
  function drawLinks() {
    if (sequencePanel.hidden) return;
    const board = sequenceBoard.getBoundingClientRect();
    const lines = [];
    for (const [i, scene] of game.matches.entries()) {
      if (scene === null) continue;
      const cardIndex = game.order.indexOf(scene);
      const from = spaces[i].getBoundingClientRect();
      const to = cards[cardIndex].button.getBoundingClientRect();
      const x1 = from.right - board.left, y1 = from.top + from.height / 2 - board.top;
      const x2 = to.left - board.left, y2 = to.top + to.height / 2 - board.top;
      const middle = (x1 + x2) / 2;
      const color = sequenceColors[cardIndex];
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M " + x1 + " " + y1 + " C " + middle + " " + y1 + ", " + middle + " " + y2 + ", " + x2 + " " + y2
        + " m -7 -5 l 7 5 l -7 5");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "3");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("fill", "none");
      lines.push(path);
    }
    sequenceLinks.replaceChildren(...lines);
  }

}

function newSequence() {
  const order = shuffled(sequenceMoments.length);
  if (order.every((scene, i) => scene === i)) order.push(order.shift());
  return {order, matches: sequenceMoments.map(() => null), selected:null, checked:false};
}
