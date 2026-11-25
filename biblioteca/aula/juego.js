"use strict";
const quiz = document.querySelector("#quiz");
function showQuiz(item) {
  const find = id => document.getElementById("quiz-" + id);
  const count = item.quiz.length;
  const n = item.quiz.findIndex((_, i) => !item.progress.aciertos.includes(i));
  const title = find("title"), feedback = find("feedback"), next = find("next");
  find("reference").hidden = true;
  find("progress").max = count;
  find("progress").value = item.progress.aciertos.length;
  find("position").textContent = n < 0 ? "Partida terminada" : "Pregunta " + (n + 1) + " de " + count;
  title.textContent = n < 0 ? "¡Comprensión completada!" : item.quiz[n].prompt;
  feedback.hidden = true;
  next.hidden = true;
  const answers = find("answers");
  answers.replaceChildren();
  if (n >= 0) {
    for (const [i, choice] of item.quiz[n].options.entries()) {
      const answer = button(choice, async () => {
        const controls = [...answers.querySelectorAll("button")];
        controls.forEach(control => {control.disabled = true;});
        let keepLocked = false;
        try {
          const correct = await record(item,"comprension",choice,n);
          feedback.hidden = false;
          feedback.dataset.result = correct ? "ok" : "retry";
          feedback.textContent = correct ? "¡Correcto!" : "Vuelve al texto o inténtalo otra vez.";
          answer.dataset.result = correct ? "ok" : "retry";
          if (!correct) return;
          keepLocked = true;
          next.hidden = false;
          next.textContent = item.progress.hechas.includes("comprension") ? "Ver resultado" : "Siguiente pregunta";
          next.onclick = () => showQuiz(item);
          next.focus();
        } finally {
          if (!keepLocked) controls.forEach(control => {control.disabled = false;});
        }
      });
      answer.dataset.color = i;
      answers.append(answer);
    }
  }
  title.focus();
}
function shuffled(count) {
  const order = Array.from({length:count}, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const pick = Math.floor(Math.random() * (i + 1));
    [order[i], order[pick]] = [order[pick], order[i]];
  }
  return order;
}
