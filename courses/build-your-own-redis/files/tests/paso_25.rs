mod common;
use common::*;

#[test]
fn set_y_get() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["SET", "nombre", "redis"]), Reply::ok());
  assert_eq!(c.cmd(&["GET", "nombre"]), Reply::bulk("redis"));
}

#[test]
fn set_pisa_el_valor() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "k", "uno"]);
  c.cmd(&["SET", "k", "dos"]);
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("dos"));
}

#[test]
fn todos_los_clientes_ven_lo_mismo() {
  let server = start();
  let mut a = connect(&server);
  let mut b = connect(&server);
  a.cmd(&["SET", "compartida", "sí"]);
  assert_eq!(b.cmd(&["GET", "compartida"]), Reply::bulk("sí"));
}
