"use strict";
let fb, profile;

async function connectAula() {
  if (!AULA_CONFIG) throw new Error("El aula está preparada. Falta activar el proyecto Firebase.");
  if (fb) return fb;
  const version = "11.10.0";
  const [appModule, authModule, dbModule] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/"+version+"/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/"+version+"/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/"+version+"/firebase-firestore.js")
  ]);
  const instance = appModule.initializeApp(AULA_CONFIG);
  const auth = authModule.getAuth(instance), db = dbModule.getFirestore(instance);
  await auth.authStateReady();
  fb = {...authModule,...dbModule,auth,db};
  return fb;
}
const accountEmail = (group, flower) => group.toLowerCase()+"."+flower+"@aula-zurron.example";
const learnerPassword = (pin, icon) => "zurron-"+pin+"-"+icon;
const emptyProgress = () => ({ultima:-1,paso:false,leer:false,aciertos:[],ordenar:false,prueba:""});
function visibleProgress(raw, book) {
  const state = raw || emptyProgress();
  return {...state,hechas:[
    ...(state.leer ? ["leer"] : []),
    ...(book.quiz.length && state.aciertos.length === book.quiz.length ? ["comprension"] : []),
    ...(book.cards.length && state.ordenar ? ["ordenar"] : [])
  ]};
}
async function aulaApi(action, data) {
  const f = await connectAula(), {auth,db,doc,getDoc,collection,getDocs,query,where} = f;
  if (action === "entrar") {
    const email = data.clase === "docente" ? data.email.trim() : accountEmail(data.clase,data.flor);
    const password = data.clase === "docente" ? data.codigo : learnerPassword(data.codigo,data.dibujo);
    try { await f.signInWithEmailAndPassword(auth,email,password); }
    catch (error) { throw new Error(error.code === "auth/too-many-requests" ? "Demasiados intentos. Espera un poco." : "Revisa tu usuario, clave y dibujo."); }
    return {};
  }
  if (action === "salir") { await f.signOut(auth);profile = null;return {}; }
  if (!auth.currentUser) {
    if (action === "estado") return {cuenta:null};
    throw new Error("Debes iniciar sesión.");
  }
  const uid = auth.currentUser.uid;
  if (!profile || profile.uid !== uid) {
    const snap = await getDoc(doc(db,"perfiles",uid));
    if (!snap.exists()) { await f.signOut(auth); throw new Error("La cuenta no está registrada en El Zurrón."); }
    profile = {...snap.data(),uid};
  }
  if (action === "estado") {
    if (profile.rol === "docente") {
      const profiles = await getDocs(query(collection(db,"perfiles"),where("rol","==","alumno")));
      return {cuenta:"docente",alumnos:profiles.docs.map(p=>({uid:p.id,...p.data()})),libros:AULA_BOOKS};
    }
    const progress = await getDocs(collection(db,"perfiles",uid,"progreso"));
    const map = new Map(progress.docs.map(p=>[p.id,p.data()]));
    return {cuenta:profile.clase,flor:profile.nombre,libros:Object.fromEntries(
      Object.entries(AULA_BOOKS).map(([id,book])=>[id,{...book,progress:visibleProgress(map.get(id),book)}])
    )};
  }
  if (action === "alumno") {
    if (profile.rol !== "docente") throw new Error("Acceso docente requerido.");
    const progress = await getDocs(collection(db,"perfiles",data.uid,"progreso"));
    return Object.fromEntries(progress.docs.filter(p=>AULA_BOOKS[p.id]).map(p=>[p.id,visibleProgress(p.data(),AULA_BOOKS[p.id])]));
  }
  if (action !== "actividad" || profile.rol !== "alumno") throw new Error("Acción no disponible.");
  const book = AULA_BOOKS[data.libro];
  if (!book) throw new Error("Libro desconocido.");
  const ref = doc(db,"perfiles",uid,"progreso",data.libro);
  let previous;
  try {
    return await f.runTransaction(db,async tx=>{
      const snap = await tx.get(ref);
      const state = snap.exists() ? snap.data() : emptyProgress();
      previous = state;
      const next = {...state,aciertos:[...state.aciertos]};
      const {tipo,valor,pregunta} = data;
      if (tipo === "pagina") {
        if (valor <= state.ultima) return {progress:visibleProgress(state,book),correct:null};
        if (!Number.isInteger(valor) || valor !== state.ultima+1 || valor>=book.pages.length || (valor>book.gatePage && !state.paso)) throw new Error("Avanza página a página y responde a la parada.");
        next.ultima=valor;
      } else if (tipo === "parada") {
        if (state.paso) return {progress:visibleProgress(state,book),correct:true};
        if (state.ultima<book.gatePage) throw new Error("Primero lee la página.");
        next.paso=true;next.prueba=valor;
      } else if (tipo === "leer") {
        if (state.leer) return {progress:visibleProgress(state,book),correct:null};
        if (!state.paso || state.ultima!==book.pages.length-1) throw new Error("Termina primero la lectura.");
        next.leer=true;
      } else if (tipo === "comprension") {
        if (!state.leer || !book.quiz.length) throw new Error("Termina primero la lectura.");
        if (state.aciertos.includes(pregunta)) return {progress:visibleProgress(state,book),correct:true};
        if (pregunta!==state.aciertos.length) throw new Error("Responde las preguntas en orden.");
        next.aciertos.push(pregunta);next.prueba=valor;
      } else if (tipo === "ordenar") {
        if (!state.leer || !book.cards.length) throw new Error("Termina primero la lectura.");
        if (state.ordenar) return {progress:visibleProgress(state,book),correct:Array.isArray(valor) && valor.every((v,i)=>v===i) && valor.length===4};
        next.ordenar=true;next.prueba=valor;
      } else throw new Error("Actividad desconocida.");
      tx.set(ref,next);
      return {progress:visibleProgress(next,book),correct:true};
    });
  } catch (error) {
    if (error.code === "permission-denied" && previous && ["parada","comprension","ordenar"].includes(data.tipo)) {
      return {progress:visibleProgress(previous,book),correct:false};
    }
    throw error;
  }
}
