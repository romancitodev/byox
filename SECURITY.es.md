# Política de seguridad

[English](SECURITY.md) | **Español**

## Cómo reportar una vulnerabilidad

**No abras un issue público** con los detalles de una vulnerabilidad.

Usá el reporte privado de GitHub: en la pestaña **Security** del repositorio, **Report a vulnerability**
(https://github.com/romancitodev/byox/security/advisories/new). Solo lo ven quienes mantienen el proyecto.

Contanos, si podés:

- qué componente está afectado (servidor MCP, API, web, CLI, scripts de despliegue, plantillas de `mcp/assets/`);
- los pasos para reproducirlo y el efecto que logra;
- la versión o el commit, y cómo estaba configurada la instancia (`BYOX_SIGNUP`, `BYOX_AUTHORS`, si estaba detrás de un proxy).

byox lo mantiene una sola persona, así que la respuesta es de mejor esfuerzo y no hay plazos garantizados. Vamos a confirmar la
recepción, a decirte si lo consideramos una vulnerabilidad y a avisarte cuando haya una corrección. Si querés, te mencionamos en el
aviso público.

Si encontrás secretos que quedaron publicados por error (un token, una contraseña, un webhook), reportalo por el mismo canal para que se rote.

## Versiones con soporte

byox todavía no publica versiones numeradas: solo se corrigen problemas en la rama `main`. Si autoalojás una instancia, actualizá con
regularidad (`git pull` y `docker compose up -d --build`).

## Modelo de amenazas

byox **ejecuta código**: el de los tests de cada curso, que puede venir de un asistente de IA o de otra persona. Lo que sigue resume
[Seguridad](mcp/web/src/docs/seguridad.md) de la documentación, que es la referencia completa.

### Para qué está pensado

Uso personal, un equipo o un aula en los que confiás en todas las cuentas.

### Lo que sí protege

- Todo exige una cuenta: la API y el MCP responden `401` sin sesión o token válidos.
- Cada persona ve su progreso y sus repositorios. Las contraseñas se validan contra Forgejo; byox guarda sesiones y la huella SHA-256 de los tokens, que se pueden revocar.
- Las sesiones usan cookies `HttpOnly` y `SameSite=Lax`, y las peticiones que modifican datos con cookie deben ser del mismo origen.
- Hay un límite de intentos de inicio de sesión y de registro.
- Los avisos del CI no se pueden falsificar entre repositorios (cada repo de alumno tiene su propio secreto) y el webhook de los cursos fuente viaja firmado.
- Escribir, verificar e importar cursos está restringido a administradores por defecto (`BYOX_AUTHORS=admin`), y el registro está cerrado por defecto (`BYOX_SIGNUP=closed`).

### Límites conocidos: por qué el registro abierto no es seguro todavía

Estos límites están documentados y **no se consideran vulnerabilidades por sí mismos**: son el motivo por el que byox no debe ofrecerse como
servicio abierto a desconocidos. Un reporte útil es uno que muestre una forma de saltarse los controles que sí existen.

1. **El bot `byox` es colaborador de todos los repositorios de alumnos**, y su token está disponible como secreto de Actions en cada uno.
   Como cada alumno controla los workflows de su repositorio, puede leer ese token y, con él, acceder a los repositorios privados de los demás alumnos de la instancia.
2. **El runner usa el socket de Docker del host** (`/var/run/docker.sock`, también montado en el servicio de byox para verificar cursos). Código
   malicioso dentro de un test puede controlar el host.
3. **Importar un curso es ejecutar código de otra persona**, y un curso escrito por un asistente también ejecuta código.
4. **`.env` concentra las credenciales** de la instancia (token de administrador de Forgejo, token del bot): quien lo lea la controla.

Lo que falta para una instancia pública, sin implementar: un entorno de ejecución aislado para los tests (con límites de CPU, memoria, red y
tiempo), credenciales por repositorio en lugar de un bot compartido, cuotas por usuario y revisión de los cursos antes de publicarlos.

### Qué se considera en alcance

- Saltarse la autenticación, la autorización entre usuarios o la restricción de autoría (`BYOX_AUTHORS`).
- Falsificar resultados de CI de otro repositorio o ejecutar acciones con permisos que no corresponden.
- Inyección, XSS, CSRF, SSRF o fuga de secretos en el servidor, la web, el CLI y los scripts de despliegue.
- Secretos expuestos en el repositorio o en el historial.

### Qué queda fuera

- Los cuatro límites conocidos de arriba, mientras se usen como están documentados.
- Problemas de configuración de una instancia que no sigue la [lista de endurecimiento](mcp/web/src/docs/seguridad.md#lista-de-endurecimiento).
- Vulnerabilidades de Forgejo, Docker, Caddy u otras dependencias: reportalas a sus proyectos (si byox las usa de forma insegura, sí nos interesa).
- Ataques que requieren acceso físico o una cuenta de administrador ya comprometida.

## Recomendaciones para quien autoaloja

La lista completa está en [Seguridad](mcp/web/src/docs/seguridad.md). Lo esencial: instalá byox en una máquina dedicada, mantené `BYOX_SIGNUP=closed` o
`invite` y `BYOX_AUTHORS=admin`, publicalo detrás de HTTPS con `BYOX_SECURE_COOKIES=1`, no expongas directamente los puertos 3000, 3333 ni 2222, y hacé copias de seguridad.
