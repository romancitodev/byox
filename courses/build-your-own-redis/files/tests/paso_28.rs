mod common;
use common::*;

#[test]
fn borra_y_cuenta() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "a", "1"]);
  c.cmd(&["SET", "b", "2"]);
  assert_eq!(c.cmd(&["DEL", "a", "b", "nada"]), Reply::Int(2));
  assert_eq!(c.cmd(&["GET", "a"]), Reply::Nil);
  assert_eq!(c.cmd(&["DEL", "a"]), Reply::Int(0));
}

#[test]
fn la_misma_clave_dos_veces() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "a", "1"]);
  assert_eq!(c.cmd(&["DEL", "a", "a"]), Reply::Int(1));
}
