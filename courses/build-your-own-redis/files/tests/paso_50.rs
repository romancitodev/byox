mod common;
use common::*;

#[test]
fn crea_la_lista() {
  let server = start();
  let mut c = connect(&server);
  // RPUSH responde el largo de la lista después de agregar.
  assert_eq!(c.cmd(&["RPUSH", "l", "a"]), Reply::Int(1));
  assert_eq!(c.cmd(&["RPUSH", "l", "b"]), Reply::Int(2));
  assert_eq!(c.cmd(&["RPUSH", "otra", "x"]), Reply::Int(1));
}

#[test]
fn aridad() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["RPUSH", "l"]), Reply::err("ERR wrong number of arguments for 'rpush' command"));
}
