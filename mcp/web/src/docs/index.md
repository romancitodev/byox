---
title: "Documentación"
description: "byox convierte proyectos «construye tu propio X» en repositorios de Forgejo con tests. Guías para instalarlo, administrarlo y usarlo."
---

<div class="doc-hero">

<p class="doc-eyebrow">Documentación de byox</p>

# Construye tu propio X, test por test

<p class="lead">byox convierte proyectos como «un servidor Redis» o «un intérprete de Lisp» en repositorios de Forgejo. Cada etapa es un issue con un test; cada <code>git push</code> corre los tests, cierra lo que pasa y desbloquea lo que sigue.</p>

<div class="dbtns">
<a class="dbtn primary" href="/docs/inicio-rapido">Inicio rápido</a>
<a class="dbtn" href="/docs/como-funciona">Cómo funciona</a>
</div>

</div>

## Qué es byox

Un curso de byox es un proyecto real que se construye por etapas. El alumno recibe un repositorio con un esqueleto que compila y un conjunto de tests que fallan. Resolver una etapa es hacer que su test pase. Las etapas forman un grafo: algunas dependen de otras y quedan bloqueadas hasta que se cierran sus dependencias.

Todo corre en tu propia máquina o servidor: un Forgejo para los repositorios, un runner que ejecuta los tests en Docker y una aplicación web con una API y un servidor MCP. No hay servicios externos ni cuentas de terceros.

Hay tres papeles, y cada uno usa una parte distinta:

| Quién | Qué hace | Dónde |
|---|---|---|
| Alumno | Sigue un curso: lee la etapa, escribe código, hace push | App web, CLI, su editor |
| Asistente | Escribe, verifica y publica cursos; acompaña al alumno cuando se atasca | Servidor MCP |
| Administrador | Instala la instancia, crea cuentas, decide quién puede crear cursos | `docker compose`, esta documentación |

## Por dónde empezar

<div class="cards">

<a class="card" href="/docs/inicio-rapido"><span class="ci"><svg viewBox="0 0 24 24"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg></span><b>Inicio rápido</b><span>De cero a tu primera etapa resuelta, en unos diez minutos.</span></a>

<a class="card" href="/docs/instalacion"><span class="ci"><svg viewBox="0 0 24 24"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01M6 18h.01"/></svg></span><b>Self-hosting</b><span>Instalación, configuración, cuentas, producción y seguridad.</span></a>

<a class="card" href="/docs/asistente"><span class="ci"><svg viewBox="0 0 24 24"><path d="M12 3 9.8 9.8 3 12l6.8 2.2L12 21l2.2-6.8L21 12l-6.8-2.2z"/></svg></span><b>Asistente (MCP)</b><span>Conecta Claude Code u otro cliente y qué herramientas expone.</span></a>

<a class="card" href="/docs/cursos"><span class="ci"><svg viewBox="0 0 24 24"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg></span><b>Crear cursos</b><span>El formato, la verificación y cómo compartirlos.</span></a>

<a class="card" href="/docs/cli"><span class="ci"><svg viewBox="0 0 24 24"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg></span><b>CLI</b><span>Tests, pistas y progreso desde la terminal.</span></a>

<a class="card" href="/docs/api"><span class="ci"><svg viewBox="0 0 24 24"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg></span><b>API HTTP</b><span>Autenticación y endpoints, con ejemplos de curl.</span></a>

</div>

<div class="callout note" data-t="Esta web y la app">

La documentación y la landing son sitios estáticos que se pueden publicar por separado, por ejemplo en Vercel. La aplicación de byox no vive ahí: cada instancia tiene la suya, con sus propias cuentas y sus propios datos.

</div>
