"use strict";
const quiz = document.getElementById("quiz");
const quizNode = id => document.getElementById(id);
const attempts = new Map();
function showQuiz(item, reference, moveFocus) {
  const questions = QUESTIONS[item.id];
  quiz.hidden = !questions;
  if (!questions) return;
  if (!attempts.has(item.id)) attempts.set(item.id, newAttempt());
  const state = attempts.get(item.id);
  const title = quizNode("quiz-title"), answers = quizNode("quiz-answers");
  const feedback = quizNode("quiz-feedback"), next = quizNode("quiz-next");
  const meter = quizNode("quiz-progress");
  const finish = state.step === questions.length;
  quizNode("quiz-position").textContent = finish ? "Partida terminada" : "Pregunta " + (state.step + 1) + " de " + questions.length;
  meter.max = questions.length;
  meter.value = state.step;
  quizNode("quiz-reference").hidden = !reference || finish;
  if (reference && quizNode("quiz-sheet").getAttribute("src") !== reference) {
    quizNode("quiz-reference").open = false;
    quizNode("quiz-sheet").src = reference;
  }
  answers.replaceChildren();
  feedback.textContent = "";
  feedback.hidden = true;
  next.hidden = true;
  delete feedback.dataset.result;
  if (finish) {
    title.textContent = "¡Reto terminado!";
    feedback.textContent = state.total ? "Aciertos al primer intento: " + state.score + " de " + state.total + "." : "Has completado todas las preguntas.";
    feedback.hidden = false;
    next.hidden = false;
    next.textContent = "Volver a jugar";
    next.onclick = () => { attempts.set(item.id, newAttempt()); showQuiz(item, reference, true); };
  } else {
    const [prompt, ...options] = questions[state.step];
    title.textContent = prompt;
    const answer = state.answers[state.step];
    if (!options.length) {
      feedback.hidden = false;
      feedback.textContent = "Responde en voz alta o en tu cuaderno.";
      stepButton("Continuar");
    } else {
      if (!state.orders[state.step]) state.orders[state.step] = shuffled(options.length);
      const buttons = state.orders[state.step].map((option, i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.color = i;
        button.textContent = options[option];
        button.setAttribute("aria-disabled", String(answer !== undefined));
        if (answer !== undefined && (option === 0 || option === answer)) {
          button.dataset.result = option === 0 ? "ok" : "retry";
          button.textContent += option === 0 ? " ✓" : " ✕";
        }
        button.onclick = () => {
          if (state.answers[state.step] !== undefined) return;
          state.answers[state.step] = option;
          state.total++;
          if (option === 0) state.score++;
          showQuiz(item, reference, false);
          next.focus();
        };
        return button;
      });
      answers.append(...buttons);
      if (answer !== undefined) {
        feedback.hidden = false;
        feedback.dataset.result = answer === 0 ? "ok" : "retry";
        feedback.textContent = answer === 0 ? "¡Correcto!" : "La respuesta es: " + options[0] + ".";
        stepButton(state.step + 1 === questions.length ? "Ver resultado" : "Siguiente pregunta");
      }
    }
  }
  if (moveFocus) title.focus();

  function stepButton(label) {
    next.hidden = false;
    next.textContent = label;
    next.onclick = () => { state.step++; showQuiz(item, reference, true); };
  }
}
function newAttempt() {
  return {step:0, score:0, total:0, answers:[], orders:[]};
}
function shuffled(count) {
  const order = Array.from({length:count}, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const pick = Math.floor(Math.random() * (i + 1));
    [order[i],order[pick]] = [order[pick],order[i]];
  }
  return order;
}
