mod common;
use common::*;

#[test]
fn devuelve_el_valor_anterior() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "k", "v3"]);
  assert_eq!(c.cmd(&["SET", "k", "v4", "GET"]), Reply::bulk("v3"));
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("v4"));
  assert_eq!(c.cmd(&["SET", "nueva", "x", "GET"]), Reply::Nil);
  assert_eq!(c.cmd(&["GET", "nueva"]), Reply::bulk("x"));
}

#[test]
fn con_nx() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "k", "viejo"]);
  // NX no escribe, pero GET igual devuelve lo que había.
  assert_eq!(c.cmd(&["SET", "k", "nuevo", "NX", "GET"]), Reply::bulk("viejo"));
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("viejo"));
}
