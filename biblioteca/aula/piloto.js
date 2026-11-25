"use strict";
const app = document.querySelector("#app"), note = document.querySelector("#aviso");
const labels = {leer:"Lectura",comprension:"Comprensión",ordenar:"Ordenar"};
const moments = ["Primero","Luego","Después","Al final"];
let session, group = "A";
function make(tag, text, cls) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function button(text, handler, cls) {
  const el = make("button",text,cls);
  el.type = "button";
  el.onclick = async () => {
    el.disabled = true;
    note.textContent = "";
    try { await handler(); } catch (error) { note.textContent = error.message; }
    finally { el.disabled = false; }
  };
  return el;
}
async function api(path, data) {
  if (typeof LOCAL_DEMO !== "undefined" && LOCAL_DEMO) {
    const response = await fetch("/api/" + path, data === undefined ? {} : {
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  }
  return aulaApi(path,data);
}
async function load() {
  if (typeof LOCAL_DEMO === "undefined" && !AULA_CONFIG) {
    clearReader();
    app.hidden = false;
    const link = make("a","Abrir la biblioteca pública","button");
    link.href="../";
    app.replaceChildren(make("h1","Aula individualizada"),make("p","El aula está preparada para conectar el proyecto Firebase."),link);
    return;
  }
  session = await api("estado");
  document.querySelector("#salir").hidden = !session.cuenta;
  document.querySelector("#identidad").textContent = session.cuenta === "docente" ? "Consola docente" :
    session.cuenta ? "Primero " + session.cuenta + " · " + session.flor : "";
  const learner = Boolean(session.cuenta && session.cuenta !== "docente");
  app.hidden = learner;
  document.getElementById("library").hidden = !learner;
  if (learner) initializeReader(session.libros);
  else {
    clearReader();
    if (session.cuenta === "docente") await teacher();
    else login();
  }
}
document.querySelector("#salir").onclick = async () => { await api("salir",{}); history.replaceState(null,"",location.pathname); await load(); };
function login(isTeacher = false) {
  app.replaceChildren();
  const panel = make("section","","box login"), form = make("form");
  panel.append(make("h1", isTeacher ? "Acceso docente" : "Entra con tu flor"));
  const groupSelect = make("select");
  for (const value of ["A","B","C"]) {
    const option = make("option", "Primero " + value);
    option.value = value;
    groupSelect.append(option);
  }
  const groupLabel = make("label","Clase");
  groupLabel.append(groupSelect);
  const flowerSelect = make("select");
  for (const [id,symbol,name] of FLOWERS) {
    const item = make("option",symbol+" "+name);
    item.value = id;
    flowerSelect.append(item);
  }
  const flowerLabel=make("label","Tu flor");
  flowerLabel.append(flowerSelect);
  const email = make("input");
  email.type = "email";
  email.required = true;
  if (!isTeacher) form.append(groupLabel,flowerLabel);
  else {
    const emailLabel=make("label","Correo docente");
    emailLabel.append(email);
    form.append(emailLabel);
  }
  const field = make("input");
  field.type = "password";
  field.required = true;
  if (!isTeacher) { field.inputMode = "numeric"; field.maxLength = 3; field.pattern = "[0-9]{3}"; }
  const label = make("label", isTeacher ? "Contraseña docente" : "Código de tres cifras");
  label.append(field);
  form.append(label);
  let icon = "";
  if (!isTeacher) {
    const choices = make("div","","drawings");
    for (const [key,name] of Object.entries(DRAWINGS)) {
      const choice = button(name, () => {
        icon = key;
        for (const el of choices.querySelectorAll("button")) el.setAttribute("aria-pressed",String(el === choice));
      });
      choice.setAttribute("aria-pressed","false");
      choices.append(choice);
    }
    form.append(make("strong","Elige tu dibujo"),choices);
  }
  const submit = make("button","Entrar");
  submit.type = "submit";
  form.append(submit);
  form.onsubmit = async event => {
    event.preventDefault();
    if (!isTeacher && !icon) { note.textContent = "Elige tu dibujo."; return; }
    submit.disabled = true;
    try {
      await api("entrar",{clase:isTeacher ? "docente" : groupSelect.value,flor:flowerSelect.value,email:email.value,codigo:field.value,dibujo:icon});
      note.textContent = "";
      await load();
    } catch (error) { note.textContent = error.message; }
    finally { submit.disabled = false; }
  };
  panel.append(form,button(isTeacher ? "Acceso de las flores" : "Acceso docente",() => {
    note.textContent = "";
    login(!isTeacher);
  },"secondary"));
  app.append(panel);
}
function marks(book, progress) {
  const row = make("div","","marks");
  for (const key of book.required) {
    const done = progress.hechas.includes(key);
    row.append(make("span",(done ? "✓ " : "✗ ") + labels[key],done ? "done" : "pending"));
  }
  if (book.required.every(key => progress.hechas.includes(key))) row.append(make("strong","Completado","done"));
  return row;
}
let selectedStudent = null;
async function teacher() {
  const controls = make("div","","toolbar");
  const table = make("table"), wrap = make("div","","table-wrap"), header = make("tr");
  const list = session.alumnos.filter(item => item.clase === group)
    .sort((a,b)=>Number(a.prueba)-Number(b.prueba)||a.nombre.localeCompare(b.nombre,"es"));
  if (!list.some(item=>item.uid===selectedStudent)) selectedStudent = list[0]?.uid || null;
  const picker = make("select");
  picker.setAttribute("aria-label","Flor del alumnado");
  for (const student of list) {
    const option = make("option",student.nombre+(student.prueba?" · Prueba":""));
    option.value=student.uid;
    picker.append(option);
  }
  picker.value=selectedStudent || "";
  picker.onchange=()=>{selectedStudent=picker.value;teacher().catch(error=>{note.textContent=error.message;});};
  for (const letter of ["A","B","C"]) {
    const tab = button("Primero "+letter,async()=>{group=letter;await teacher();},"secondary");
    tab.setAttribute("aria-pressed",String(group===letter));
    controls.append(tab);
  }
  controls.append(picker,button("Actualizar",teacher,"secondary"));
  app.replaceChildren(make("h1","Consola docente"),controls);
  const student=list.find(item=>item.uid===selectedStudent);
  if (!student) {app.append(make("p","Todavía no hay cuentas de esta clase."));return;}
  const studentId=student.uid, selectedGroup=group;
  const progress = await api("alumno",{uid:studentId});
  if (selectedStudent!==studentId || group!==selectedGroup || session.cuenta!=="docente") return;
  const completed=Object.entries(session.libros).filter(([id,book])=>book.required.every(key=>progress[id]?.hechas.includes(key))).length;
  const started=Object.keys(progress).length;
  app.append(make("h2",student.nombre+" · Primero "+group),make("p",completed+" libros completados · "+started+" empezados de "+Object.keys(session.libros).length));
  for (const title of ["Libro","Actividades y resultado"]) header.append(make("th",title));
  const head=make("thead");head.append(header);table.append(head);
  const body=make("tbody");
  for (const [id,book] of Object.entries(session.libros)) {
    const row=make("tr"), cell=make("td");
    cell.append(marks(book,progress[id]||{hechas:[]}));
    row.append(make("td",book.title),cell);body.append(row);
  }
  table.append(body);wrap.append(table);app.append(wrap);
}
async function record(item, tipo, valor, pregunta) {
  const result = await api("actividad",{libro:item.id,tipo,valor,pregunta});
  item.progress = result.progress;
  if (book === item) refreshMarks();
  return result.correct;
}
function options(values, handler) {
  const list = make("div","","answers");
  for (const value of values) list.append(button(value,() => handler(value)));
  return list;
}

