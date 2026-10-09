mod common;
use common::*;

#[test]
fn no_es_un_entero() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "k", "v"]);
  assert_eq!(c.cmd(&["INCR", "k"]), Reply::err("ERR value is not an integer or out of range"));
  c.cmd(&["SET", "n", "5"]);
  assert_eq!(c.cmd(&["INCRBY", "n", "abc"]), Reply::err("ERR value is not an integer or out of range"));
  assert_eq!(c.cmd(&["GET", "n"]), Reply::bulk("5"), "un error no cambia el valor");
}

#[test]
fn desborde() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "big", "9223372036854775807"]);
  assert_eq!(c.cmd(&["INCR", "big"]), Reply::err("ERR increment or decrement would overflow"));
  c.cmd(&["SET", "n", "5"]);
  assert_eq!(c.cmd(&["INCRBY", "n", "9223372036854775807"]), Reply::err("ERR increment or decrement would overflow"));
  assert_eq!(c.cmd(&["GET", "big"]), Reply::bulk("9223372036854775807"));
}
