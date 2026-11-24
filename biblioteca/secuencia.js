"use strict";
const sequencePanel = document.getElementById("sequence");
const sequenceMoments = ["Al principio", "Luego", "Después", "Al final"];
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
  const cards = game.order.map((scene, cardIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    const badge = document.createElement("span");
    badge.textContent = String.fromCharCode(65 + cardIndex);
    const image = document.createElement("img");
    image.src = item.pages[pageIndices[scene]];
    image.alt = (item.alts?.[pageIndices[scene]] || "").trim();
    button.setAttribute("aria-label", "Tarjeta " + badge.textContent + (image.alt ? ". " + image.alt : ""));
    button.append(badge,image);
    button.onclick = () => {
      game.selected = game.selected === scene ? null : scene;
      refresh();
      if (game.selected !== null) info.textContent = "Elige un momento para la tarjeta " + badge.textContent + ".";
    };
    return button;
  });
  const spaces = sequenceMoments.map((label, position) => {
    const button = document.createElement("button");
    button.type = "button";
    button.onclick = () => {
      if (game.selected === null) {
        info.textContent = "Elige primero una tarjeta.";
        return;
      }
      const previous = game.matches.indexOf(game.selected);
      if (previous !== -1) game.matches[previous] = null;
      game.matches[position] = game.selected;
      game.selected = null;
      game.checked = false;
      refresh();
    };
    return button;
  });
  scenes.replaceChildren(...cards);
  targets.replaceChildren(...spaces);
  check.onclick = () => { game.checked = true; refresh(); };
  document.getElementById("sequence-reset").onclick = () => {
    const next = newSequence();
    if (next.order.every((v, i) => v === game.order[i])) next.order.push(next.order.shift());
    sequenceGames.set(item.id, next);
    showSequence(item);
  };
  refresh();
  if (focusHeading) heading.focus();

  function refresh() {
    let placed = 0;
    let correct = 0;
    for (const [i, scene] of game.order.entries()) {
      cards[i].setAttribute("aria-pressed", String(game.selected === scene));
      cards[i].classList.toggle("assigned", game.matches.includes(scene));
    }
    for (const [i, moment] of sequenceMoments.entries()) {
      const scene = game.matches[i];
      const cell = spaces[i];
      const ok = scene === i;
      if (scene !== null) placed++;
      if (ok) correct++;
      cell.textContent = moment + (scene === null ? "" : " · " + String.fromCharCode(65 + game.order.indexOf(scene)));
      if (game.checked) {
        cell.dataset.result = ok ? "correct" : "review";
        cell.textContent += ok ? " ✓" : " · Revisar";
      } else {
        delete cell.dataset.result;
      }
    }
    check.disabled = placed !== sequenceMoments.length;
    info.textContent = game.checked
      ? (correct === sequenceMoments.length ? "¡Muy bien! Has ordenado la lectura." : correct + " de 4 correctas. Puedes cambiar las parejas.")
      : placed + " de 4 parejas";
  }
}

function newSequence() {
  const order = shuffled(sequenceMoments.length);
  if (order.every((scene, i) => scene === i)) order.push(order.shift());
  return {order, matches: sequenceMoments.map(() => null), selected:null, checked:false};
}
