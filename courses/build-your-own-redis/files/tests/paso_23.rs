mod common;
use common::*;

#[test]
fn comando_desconocido() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["FOO"]), Reply::err("ERR unknown command 'FOO'"));
  // Con argumentos, Redis los muestra entre comillas, cada uno seguido de un espacio.
  assert_eq!(c.cmd(&["FOO", "a", "b"]), Reply::err("ERR unknown command 'FOO', with args beginning with: 'a' 'b' "));
  assert_eq!(c.cmd(&["fOo", "con espacio"]), Reply::err("ERR unknown command 'fOo', with args beginning with: 'con espacio' "));
}

#[test]
fn la_conexion_sigue_viva() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["NOEXISTE"]);
  assert_eq!(c.cmd(&["PING"]), Reply::simple("PONG"));
}
