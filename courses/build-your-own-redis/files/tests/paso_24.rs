mod common;
use common::*;

#[test]
fn argumentos_de_mas_o_de_menos() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["ECHO"]), Reply::err("ERR wrong number of arguments for 'echo' command"));
  assert_eq!(c.cmd(&["ECHO", "a", "b"]), Reply::err("ERR wrong number of arguments for 'echo' command"));
  assert_eq!(c.cmd(&["PING", "a", "b"]), Reply::err("ERR wrong number of arguments for 'ping' command"));
}

#[test]
fn el_nombre_va_en_minusculas() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["EcHo"]), Reply::err("ERR wrong number of arguments for 'echo' command"));
}
