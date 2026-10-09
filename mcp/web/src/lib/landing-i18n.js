// Todo el texto de la landing, por idioma. El español (es) es el principal y su texto es el original;
// el inglés (en) está escrito para leerse como inglés, no traducido palabra por palabra.
//
// - Los campos que terminan en `Html` (y los que se pintan con set:html) llevan marcas <b>, <code>, <span>.
// - Los textos que escriben los scripts en el navegador viven en landing-strings.js (se cargan por <html lang>).
// - «build your own X» no se traduce.

const es = {
  lang: "es",
  htmlLang: "es",
  switcherLabel: "Idioma",
  meta: {
    title: "byox · construye tu propio X, test por test",
    description: "Proyectos reales para entender cómo funcionan por dentro las herramientas que usas. Programa en tu editor, haz push y un test te dice si funciona.",
  },
  brandLabel: "byox, inicio",
  home: "/",
  and: "y",
  nav: {
    how: "Cómo funciona",
    features: "Funciones",
    assistant: "Asistente",
    create: "Crear y compartir",
    plans: "Planes",
    faq: "Preguntas",
    docs: "Documentación",
    docsNote: "",
    app: "App",
  },

  hero: {
    tag: "Gratis",
    pill: "Cursos de programación con tests reales",
    h1: "Construye tu propio",
    subHtml: `Entiende cómo funcionan por dentro las herramientas que usas todos los días. Programa cada pieza en tu editor, haz push y <b>un test real te dice en segundos si funciona.</b>`,
    seeHow: "Ver cómo funciona",
  },
  // Palabras genéricas de la X: el hero nunca habla de un solo curso.
  words: ["shell", "base de datos", "compilador", "servidor web", "editor de texto", "intérprete", "emulador", "motor de búsqueda"],
  chips: [["code", "Cualquier lenguaje"], ["circle-check", "Tests en cada push"], ["lightbulb", "Pistas sin spoilers"], ["sparkles", "Asistente con IA"], ["server", "En tu propia máquina"]],

  belt: { label: "Lenguajes y herramientas", title: "Cualquier lenguaje con imagen de Docker. Sobre las herramientas que ya usas." },

  why: {
    kicker: "Por qué byox",
    h2Html: `Lo que construyes, <span class="grad">lo entiendes.</span>`,
    p: "Los tutoriales se miran. Los proyectos con tests se resuelven, y eso es lo que se queda.",
    outcomes: [
      { i: "cpu", t: "Entiendes lo que usas todos los días", d: "Reconstruir un shell, un intérprete o una base de datos te enseña qué hay detrás de las herramientas que das por hechas." },
      { i: "circle-check", t: "Feedback real, no una opción múltiple", d: "Cada etapa tiene un test. Pasa o falla, y si falla ves el archivo y la línea exactos, sin abrir un log." },
      { i: "rocket", t: "Terminas con un proyecto que funciona", d: "No es un ejercicio suelto: es un programa completo, en tu propio repositorio, escrito por ti." },
    ],
  },

  how: {
    kicker: "Cómo funciona",
    h2Html: `Tres pasos. <span class="dim">Ninguno es nuevo para ti.</span>`,
    p: "Tu editor, tu terminal y git. byox corre los tests y lleva tu progreso.",
    steps: [
      { icon: "layers", t: "Elige qué construir", d: "Se crea tu repositorio privado con un esqueleto que compila y las etapas como issues." },
      { icon: "terminal", t: "Resuelve la etapa", d: "Lee la consigna y programa donde prefieras. Prueba en la misma imagen de Docker que usa el CI." },
      { icon: "upload", t: "Haz push", d: "Si pasa, la etapa se completa y se desbloquean las que dependían de ella. Si falla, ves dónde." },
    ],
    term: {
      repo: "repositorio privado creado",
      stages: "etapas",
      milestones: "tramos",
      planLog: "plan · issues abiertos",
      testLog: "test · imagen del curso",
      done: (n) => `#${n} completa · se abre #9`,
    },
    questLead: { tag: "Pruébalo", text: "Haz push. Mira qué se abre." },
    midcta: "Tu primer push está a un comando.",
  },

  features: {
    kicker: "Funciones",
    h2Html: `Todo lo que necesitas <span class="dim">para llegar al final.</span>`,
    p: "Del primer push a la última etapa, sin salir de tu editor.",
    ci: { missing: (n, m) => `#${n} · falta #${m}`, tHtml: `<b>Cada push, probado.</b> Forgejo corre los tests, cierra lo que pasa y abre lo siguiente.` },
    live: {
      running: (n) => `Corriendo etapa #${n}`,
      done: (n) => `Etapa #${n} completa · +2 disponibles`,
      upToDate: "Tests al día · hace 12 s",
      next: (n) => `Ir a la #${n} →`,
      tHtml: `<b>Tu push, en vivo.</b> Ves el CI correr y, al pasar, qué se abrió y un botón a la siguiente.`,
    },
    err: {
      msg: "esperaba [echo, hola mundo]",
      tHtml: `<b>El error, con archivo y línea.</b> El mensaje del test y el lugar exacto. <code>byox log</code> te da la salida completa.`,
    },
    hint: {
      h1: "Recorre la línea carácter por carácter y lleva un estado.",
      h2: "Dentro de comillas dobles, los espacios no separan argumentos.",
      ask: "Pedir la pista",
      of: "de 3",
      src: ["web", "byox hint", "/pista"],
      tHtml: `<b>Una pista, no la respuesta.</b> De lo general a lo concreto: web, byox hint o /pista. Nunca en tu repo.`,
    },
    docs: {
      web: "Web",
      term: "Terminal",
      requires: "Requiere",
      test: "Prueba:",
      tHtml: `<b>Instrucciones donde estés.</b> La portada, el README y el mapa en la web, o byox show en la terminal.`,
    },
    streak: {
      days: "días de racha",
      progress: "7 de 10 etapas",
      tHtml: `<b>Tu racha, a la vista.</b> Cada día con un commit suma. Tu perfil de Forgejo muestra 16 semanas.`,
    },
    cli: {
      modes: "Cómo probar",
      cmds: "Comandos del CLI:",
      tHtml: `<b>Un CLI que conoce tu curso.</b> Detecta el curso del repo: prueba, pide pistas, mira el CI y comparte.`,
    },
  },

  assistant: {
    kicker: "Asistente con IA",
    h2: "Un tutor que conoce tu código.",
    p: "Conecta Claude Code, o cualquier cliente MCP, y tu asistente sabe en qué etapa estás, lee el log del CI y tu repositorio en el commit que falló, y te explica la causa sin resolverla por ti.",
    list: [
      ["/atascado", "diagnostica el test que falla"],
      ["/que_sigue", "te dice cuál es tu próxima etapa"],
      ["/revisar_etapa", "revisa tu solución"],
      ["/crear_curso", "escribe un curso nuevo contigo"],
    ],
    small: "Herramientas para acompañarte mientras aprendes y para crear cursos. La web muestra qué asistente está conectado.",
  },

  make: {
    kicker: "Crear y compartir",
    h2Html: `El curso que no existe, <span class="grad">lo creas.</span>`,
    p: "Pídeselo a tu asistente, escríbelo a mano con tu editor o recibe el de otra persona. Todo vive en tu propia instancia.",
    slug: "mi-curso",
    cards: [
      { icon: "sparkles", t: "Pídelo a tu asistente", dHtml: "Describe qué quieres construir. Escribe las etapas, los tests, el esqueleto y una solución de referencia.", from: "desde Claude Code" },
      { icon: "pen-line", t: "Escríbelo a mano", dHtml: "Una plantilla que ya anda en Python, Rust, Go o Node. Se marca como hecho a mano y <code>byox check</code> te muestra el estado de cada etapa." },
      { icon: "share", t: "Compártelo con un código", dHtml: "Un código <code>byox1-…</code> o un archivo <code>.byox</code>. No pasa por ningún servidor, y quien lo recibe ve una vista previa antes de importarlo." },
    ],
  },

  audience: {
    kicker: "Para quién",
    h2Html: `Un mismo formato, <span class="dim">distintos usos.</span>`,
    cards: [
      { icon: "code", t: "Desarrolladores", d: "Aprende un lenguaje o un concepto construyendo algo que funciona. Cada etapa se valida con un test, no con una opción múltiple." },
      { icon: "grad", t: "Docentes", d: "Convierte un temario en etapas con tests y comparte el curso con tu clase con un código o un archivo." },
      { icon: "users", t: "Equipos", d: "Onboarding con proyectos guiados sobre tu propia infraestructura. El código de cada persona queda en tu Forgejo." },
    ],
  },

  plans: {
    kicker: "Planes",
    h2Html: `Empieza gratis. <span class="dim">Crece cuando lo necesites.</span>`,
    p: "byox seguirá siendo gratis para uso personal. Estamos preparando la nube y las funciones para equipos.",
    // cta: [texto, destino]. "#espera" se cambia por "#preguntas" si no hay lista de espera configurada.
    items: [
      { n: "Self-hosted", i: "server", tag: "Disponible", on: true, d: "Todo byox en tu máquina, para uso personal. Forgejo, CI, CLI y asistente.", li: ["Cursos ilimitados", "Tu código en tu Forgejo", "Gratis"], cta: ["Instalar con un comando", "#cierre"] },
      { n: "Cloud", i: "cloud", tag: "Próximamente", d: "El mismo byox sin instalar nada. Empiezas un curso desde el navegador.", li: ["Sin Docker ni configuración", "Tu progreso y racha en cualquier equipo", "Plan gratis para probar"], cta: ["Avísame", "#espera"] },
      { n: "Equipos", i: "users", tag: "Próximamente", d: "Onboarding y formación con proyectos guiados, con visibilidad para quien lidera.", li: ["Panel de progreso del equipo", "Cursos privados", "SSO"], cta: ["Avísame", "#espera"] },
      { n: "Enterprise", i: "building", tag: "A medida", d: "Licencia para correr byox en tu infraestructura, con soporte.", li: ["Soporte y SLA", "Auditoría", "Integración con tus sistemas"], cta: ["Hablemos", "#espera"] },
    ],
    moreInfo: "Más información",
  },

  waitlist: {
    title: "Entérate cuando salga la nube",
    p: "Un correo cuando esté lista. Sin spam, y puedes pedir que lo borremos cuando quieras.",
    emailLabel: "Correo",
    emailPlaceholder: "tu@correo.com",
    profileLabel: "Cómo lo usarías",
    profilePlaceholder: "¿Cómo lo usarías?",
    // value = lo que recibe el endpoint (no se traduce); label = lo que se ve.
    profiles: [["individuo", "Para mí"], ["docente", "Para mi clase"], ["equipo", "Para mi equipo"]],
    submit: "Avisarme",
  },

  faq: {
    kicker: "Preguntas",
    h2: "Preguntas frecuentes",
    items: [
      ["¿Qué necesito instalar?", "Docker y Git (en Windows, Git Bash). <code>bash setup.sh</code> crea tu usuario, levanta Forgejo, el runner de CI y byox, y deja todo andando. El CLI es opcional."],
      ["¿En qué lenguaje programo?", "En el que defina el curso: cada uno trae una imagen de Docker donde se ejecutan sus tests, así que en tu máquina solo necesitas Docker. Para escribir tus propios cursos hay plantillas en Python, Rust, Go y Node."],
      ["¿Necesito Docker para probar mi código?", "No siempre. <code>byox test</code> usa la misma imagen que el CI, pero con <code>--local</code> corre los tests con tus propias herramientas."],
      ["¿Quién escribe los cursos?", "Tu asistente, a través del MCP de byox, o tú a mano con tu editor y git. También puedes importar los de otras personas con un código o un archivo <code>.byox</code>."],
      ["¿Dónde queda mi código?", "En un repositorio privado de tu Forgejo. Nada sale de tu máquina a menos que lo publiques en otro lugar."],
      ["¿Qué pasa si me atasco?", "Tienes pistas que se piden de una en una, el error con archivo y línea, y un asistente que lee el log y tu código en ese commit para explicarte la causa sin darte la solución."],
      ["¿Habrá versión en la nube?", "Estamos preparándola. Si te interesa para ti, tu clase o tu equipo, déjanos tu correo en la sección de planes. El self-hosted seguirá siendo gratis para uso personal."],
      ["¿Puedo usarlo con otros asistentes?", "El MCP de byox es un servidor HTTP estándar: cualquier cliente compatible con MCP puede usar sus herramientas. La web indica cuál está conectado."],
      ["¿Es seguro importar un curso?", "Los tests de un curso importado corren en tu Docker. Importa solo códigos de personas en las que confíes; antes de confirmar ves una vista previa."],
    ],
  },

  final: {
    h2Html: `¿Qué vas a <span class="grad">construir</span>?`,
    p: "Levanta byox en tu máquina con un comando y completa tu primera etapa hoy.",
    copyAria: "Copiar bash setup.sh",
    copy: "Copiar",
    viewCode: "Ver el código",
  },

  footer: { tagline: "byox · build your own x, en tu propio Forgejo" },

  // ---- componentes ----
  demo: {
    aria: (n, title) => `Demo: cerrar la etapa #${n} de ${title}`,
    courses: "Cursos",
    upToDate: "Tests al día",
    of: "de",
    stages: "etapas",
    available: "Disponible",
    requires: "requiere",
    terminal: "Terminal",
    stageDone: "Etapa completa",
    unlockedOne: "Desbloqueada:",
    unlockedMany: "Desbloqueadas:",
  },
  quest: {
    mapAria: "Mapa de etapas de un curso de ejemplo",
    of: "de",
    stages: "etapas",
    tapHint: "Toca una etapa disponible",
    complete: "Curso completo",
    play: "Reproducir",
    reset: "Reiniciar",
    requires: "Requiere",
    unlocks: "Desbloquea",
    hintBtn: "Ver pista 1 de 3",
    simulate: "Simular git push",
    restart: "Volver a empezar",
    activity: "Actividad",
    fail: {
      msg: 'esperaba [echo, hola mundo], obtuve [echo, "hola, mundo"]',
      where: "parser.go:31:5",
      hint: "Recorre la línea carácter por carácter y lleva un estado: fuera de comillas, dentro de simples o dentro de dobles.",
    },
  },
  assist: {
    prompt: (n) => `Crea un curso de byox para construir un shell en Go, en ${n} etapas.`,
    steps: (n, slug) => [
      { tool: "write_course_files", detail: `course.yaml, ${n} etapas, esqueleto y solución` },
      { tool: "validate_course", detail: "formato y grafo de dependencias correctos" },
      { tool: "verify_course", detail: `esqueleto: ${n} de ${n} fallan · solución: ${n} de ${n} pasan` },
      { tool: "start_course", detail: `repositorio publicado: ${slug}` },
    ],
    answer: (title, n, m) => `Listo. <b>${title}</b> tiene ${n} etapas en ${m} tramos y ya está en tus cursos. Empieza por la #1.`,
  },
  graph: {
    aria: (n, title) => `Grafo de las ${n} etapas de ${title}`,
    caption: "Pasa el cursor sobre una etapa para ver qué requiere.",
  },
};

const en = {
  lang: "en",
  htmlLang: "en",
  switcherLabel: "Language",
  meta: {
    title: "byox · build your own X, test by test",
    description: "Real projects to understand how the tools you use work under the hood. Code in your editor, push, and a test tells you whether it works.",
  },
  brandLabel: "byox, home",
  home: "/en",
  and: "and",
  nav: {
    how: "How it works",
    features: "Features",
    assistant: "Assistant",
    create: "Create & share",
    plans: "Plans",
    faq: "FAQ",
    docs: "Documentation",
    docsNote: "(Spanish)",
    app: "App",
  },

  hero: {
    tag: "Free",
    pill: "Programming courses with real tests",
    h1: "Build your own",
    subHtml: `See how the tools you use every day work under the hood. Build each piece in your editor, push, and <b>a real test tells you within seconds whether it works.</b>`,
    seeHow: "See how it works",
  },
  words: ["shell", "database", "compiler", "web server", "text editor", "interpreter", "emulator", "search engine"],
  chips: [["code", "Any language"], ["circle-check", "Tests on every push"], ["lightbulb", "Hints without spoilers"], ["sparkles", "AI assistant"], ["server", "On your own machine"]],

  belt: { label: "Languages and tools", title: "Any language with a Docker image. On top of the tools you already use." },

  why: {
    kicker: "Why byox",
    h2Html: `What you build, <span class="grad">you understand.</span>`,
    p: "Tutorials get watched. Projects with tests get solved, and that's what sticks.",
    outcomes: [
      { i: "cpu", t: "Understand what you use every day", d: "Rebuilding a shell, an interpreter or a database shows you what sits behind the tools you take for granted." },
      { i: "circle-check", t: "Real feedback, not multiple choice", d: "Every stage has a test. It passes or it fails, and when it fails you see the exact file and line, without opening a log." },
      { i: "rocket", t: "End up with a working project", d: "Not a loose exercise: a complete program, in your own repository, written by you." },
    ],
  },

  how: {
    kicker: "How it works",
    h2Html: `Three steps. <span class="dim">None of them is new to you.</span>`,
    p: "Your editor, your terminal and git. byox runs the tests and keeps track of your progress.",
    steps: [
      { icon: "layers", t: "Pick what to build", d: "Your private repository is created with a skeleton that compiles and the stages as issues." },
      { icon: "terminal", t: "Solve the stage", d: "Read the brief and code wherever you like. Test in the same Docker image the CI uses." },
      { icon: "upload", t: "Push", d: "If it passes, the stage is completed and the ones that depended on it unlock. If it fails, you see where." },
    ],
    term: {
      repo: "private repository created",
      stages: "stages",
      milestones: "milestones",
      planLog: "plan · open issues",
      testLog: "test · course image",
      done: (n) => `#${n} complete · #9 opens`,
    },
    questLead: { tag: "Try it", text: "Push. See what opens." },
    midcta: "Your first push is one command away.",
  },

  features: {
    kicker: "Features",
    h2Html: `Everything you need <span class="dim">to reach the end.</span>`,
    p: "From the first push to the last stage, without leaving your editor.",
    ci: { missing: (n, m) => `#${n} · needs #${m}`, tHtml: `<b>Every push, tested.</b> Forgejo runs the tests, closes what passes and opens what comes next.` },
    live: {
      running: (n) => `Running stage #${n}`,
      done: (n) => `Stage #${n} complete · +2 available`,
      upToDate: "Tests up to date · 12 s ago",
      next: (n) => `Go to #${n} →`,
      tHtml: `<b>Your push, live.</b> Watch the CI run and, once it passes, see what opened and get a button to the next stage.`,
    },
    err: {
      msg: "expected [echo, hello world]",
      tHtml: `<b>The error, with file and line.</b> The test message and the exact spot. <code>byox log</code> gives you the full output.`,
    },
    hint: {
      h1: "Walk the line one character at a time and keep a state.",
      h2: "Inside double quotes, spaces don't separate arguments.",
      ask: "Get hint",
      of: "of 3",
      src: ["web", "byox hint", "/pista"],
      tHtml: `<b>A hint, not the answer.</b> From general to specific: web, byox hint or /pista. Never in your repo.`,
    },
    docs: {
      web: "Web",
      term: "Terminal",
      requires: "Requires",
      test: "Test:",
      tHtml: `<b>Instructions wherever you are.</b> The cover, the README and the map on the web, or byox show in the terminal.`,
    },
    streak: {
      days: "day streak",
      progress: "7 of 10 stages",
      tHtml: `<b>Your streak, at a glance.</b> Every day with a commit counts. Your Forgejo profile shows 16 weeks.`,
    },
    cli: {
      modes: "How to test",
      cmds: "CLI commands:",
      tHtml: `<b>A CLI that knows your course.</b> It detects the repo's course: test, ask for hints, watch the CI and share.`,
    },
  },

  assistant: {
    kicker: "AI assistant",
    h2: "A tutor that knows your code.",
    p: "Connect Claude Code, or any MCP client, and your assistant knows which stage you're on, reads the CI log and your repository at the commit that failed, and explains the cause without solving it for you.",
    // Los nombres de los comandos son los del MCP de byox; no se traducen.
    list: [
      ["/atascado", "diagnoses the failing test"],
      ["/que_sigue", "tells you which stage is next"],
      ["/revisar_etapa", "reviews your solution"],
      ["/crear_curso", "writes a new course with you"],
    ],
    small: "Tools to support you while you learn and to create courses. The web shows which assistant is connected.",
  },

  make: {
    kicker: "Create & share",
    h2Html: `No course for it yet? <span class="grad">Create it.</span>`,
    p: "Ask your assistant, write it by hand in your editor, or receive someone else's. Everything lives in your own instance.",
    slug: "my-course",
    cards: [
      { icon: "sparkles", t: "Ask your assistant", dHtml: "Describe what you want to build. It writes the stages, the tests, the skeleton and a reference solution.", from: "from Claude Code" },
      { icon: "pen-line", t: "Write it by hand", dHtml: "A template that already runs in Python, Rust, Go or Node. It's marked as hand-made and <code>byox check</code> shows you the status of each stage." },
      { icon: "share", t: "Share it with a code", dHtml: "A <code>byox1-…</code> code or a <code>.byox</code> file. It doesn't go through any server, and whoever receives it sees a preview before importing it." },
    ],
  },

  audience: {
    kicker: "Who it's for",
    h2Html: `One format, <span class="dim">different uses.</span>`,
    cards: [
      { icon: "code", t: "Developers", d: "Learn a language or a concept by building something that works. Every stage is validated by a test, not a multiple-choice question." },
      { icon: "grad", t: "Teachers", d: "Turn a syllabus into stages with tests and share the course with your class using a code or a file." },
      { icon: "users", t: "Teams", d: "Onboarding with guided projects on your own infrastructure. Everyone's code stays in your Forgejo." },
    ],
  },

  plans: {
    kicker: "Plans",
    h2Html: `Start free. <span class="dim">Grow when you need to.</span>`,
    p: "byox will stay free for personal use. We're working on the cloud and on features for teams.",
    items: [
      { n: "Self-hosted", i: "server", tag: "Available", on: true, d: "All of byox on your machine, for personal use. Forgejo, CI, CLI and assistant.", li: ["Unlimited courses", "Your code in your Forgejo", "Free"], cta: ["Install with one command", "#cierre"] },
      { n: "Cloud", i: "cloud", tag: "Coming soon", d: "The same byox with nothing to install. You start a course from the browser.", li: ["No Docker or setup", "Your progress and streak on any device", "Free plan to try it out"], cta: ["Notify me", "#espera"] },
      { n: "Teams", i: "users", tag: "Coming soon", d: "Onboarding and training with guided projects, with visibility for whoever leads.", li: ["Team progress dashboard", "Private courses", "SSO"], cta: ["Notify me", "#espera"] },
      { n: "Enterprise", i: "building", tag: "Custom", d: "A license to run byox on your own infrastructure, with support.", li: ["Support and SLA", "Auditing", "Integration with your systems"], cta: ["Let's talk", "#espera"] },
    ],
    moreInfo: "More information",
  },

  waitlist: {
    title: "Get notified when the cloud launches",
    p: "One email when it's ready. No spam, and you can ask us to delete it whenever you want.",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    profileLabel: "How you would use it",
    profilePlaceholder: "How would you use it?",
    profiles: [["individuo", "For myself"], ["docente", "For my class"], ["equipo", "For my team"]],
    submit: "Notify me",
  },

  faq: {
    kicker: "FAQ",
    h2: "Frequently asked questions",
    items: [
      ["What do I need to install?", "Docker and Git (on Windows, Git Bash). <code>bash setup.sh</code> creates your user, starts Forgejo, the CI runner and byox, and leaves everything running. The CLI is optional."],
      ["Which language do I code in?", "Whichever the course defines: each one ships a Docker image where its tests run, so on your machine you only need Docker. To write your own courses there are templates in Python, Rust, Go and Node."],
      ["Do I need Docker to test my code?", "Not always. <code>byox test</code> uses the same image as the CI, but with <code>--local</code> it runs the tests with your own tools."],
      ["Who writes the courses?", "Your assistant, through the byox MCP, or you by hand with your editor and git. You can also import other people's courses with a code or a <code>.byox</code> file."],
      ["Where does my code live?", "In a private repository on your Forgejo. Nothing leaves your machine unless you publish it somewhere else."],
      ["What if I get stuck?", "You get hints you ask for one at a time, the error with file and line, and an assistant that reads the log and your code at that commit to explain the cause without handing you the solution."],
      ["Will there be a cloud version?", "We're working on it. If you're interested for yourself, your class or your team, leave your email in the plans section. Self-hosted will stay free for personal use."],
      ["Can I use it with other assistants?", "The byox MCP is a standard HTTP server: any MCP-compatible client can use its tools. The web shows which one is connected."],
      ["Is it safe to import a course?", "The tests of an imported course run in your Docker. Only import codes from people you trust; you see a preview before confirming."],
    ],
  },

  final: {
    h2Html: `What will you <span class="grad">build</span>?`,
    p: "Spin up byox on your machine with one command and complete your first stage today.",
    copyAria: "Copy bash setup.sh",
    copy: "Copy",
    viewCode: "View the code",
  },

  footer: { tagline: "byox · build your own x, on your own Forgejo" },

  demo: {
    aria: (n, title) => `Demo: completing stage #${n} of ${title}`,
    courses: "Courses",
    upToDate: "Tests up to date",
    of: "of",
    stages: "stages",
    available: "Available",
    requires: "requires",
    terminal: "Terminal",
    stageDone: "Stage complete",
    unlockedOne: "Unlocked:",
    unlockedMany: "Unlocked:",
  },
  quest: {
    mapAria: "Stage map of a sample course",
    of: "of",
    stages: "stages",
    tapHint: "Tap an available stage",
    complete: "Course complete",
    play: "Play",
    reset: "Reset",
    requires: "Requires",
    unlocks: "Unlocks",
    hintBtn: "Show hint 1 of 3",
    simulate: "Simulate git push",
    restart: "Start over",
    activity: "Activity",
    fail: {
      msg: 'expected [echo, hello world], got [echo, "hello, world"]',
      where: "parser.go:31:5",
      hint: "Walk the line one character at a time and keep a state: outside quotes, inside single quotes or inside double quotes.",
    },
  },
  assist: {
    prompt: (n) => `Create a byox course to build a shell in Go, in ${n} stages.`,
    steps: (n, slug) => [
      { tool: "write_course_files", detail: `course.yaml, ${n} stages, skeleton and solution` },
      { tool: "validate_course", detail: "format and dependency graph are valid" },
      { tool: "verify_course", detail: `skeleton: ${n} of ${n} fail · solution: ${n} of ${n} pass` },
      { tool: "start_course", detail: `repository published: ${slug}` },
    ],
    answer: (title, n, m) => `Done. <b>${title}</b> has ${n} stages in ${m} milestones and is already in your courses. Start with #1.`,
  },
  graph: {
    aria: (n, title) => `Graph of the ${n} stages of ${title}`,
    caption: "Hover over a stage to see what it requires.",
  },
};

export const copy = { es, en };

/** El diccionario de un idioma; cualquier valor desconocido cae en español. */
export const tr = (lang) => (lang === "en" ? en : es);

/** Idiomas de la landing y su ruta: el español vive en "/" y el inglés en "/en". */
export const locales = [
  { lang: "es", label: "ES", name: "Español", href: "/" },
  { lang: "en", label: "EN", name: "English", href: "/en" },
];
