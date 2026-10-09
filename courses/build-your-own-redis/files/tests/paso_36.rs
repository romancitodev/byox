mod common;
use common::*;

#[test]
fn mset_y_mget() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["MSET", "a", "1", "b", "2"]), Reply::ok());
  assert_eq!(c.cmd(&["MGET", "a", "nada", "b"]), Reply::Array(vec![Reply::bulk("1"), Reply::Nil, Reply::bulk("2")]));
}

#[test]
fn pares_incompletos() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["MSET", "a"]), Reply::err("ERR wrong number of arguments for 'mset' command"));
  assert_eq!(c.cmd(&["MSET", "a", "1", "b"]), Reply::err("ERR wrong number of arguments for 'mset' command"));
  assert_eq!(c.cmd(&["GET", "a"]), Reply::Nil, "un MSET inválido no escribe nada");
}
