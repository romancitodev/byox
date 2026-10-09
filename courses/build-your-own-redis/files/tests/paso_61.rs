mod common;
use common::*;

const WRONGTYPE: &str = "WRONGTYPE Operation against a key holding the wrong kind of value";

#[test]
fn comandos_de_lista_sobre_un_string() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "s", "v"]);
  for cmd in [&["RPUSH", "s", "x"][..], &["LPUSH", "s", "x"], &["LRANGE", "s", "0", "-1"], &["LLEN", "s"], &["LINDEX", "s", "0"], &["LPOP", "s"]] {
    assert_eq!(c.cmd(cmd), Reply::err(WRONGTYPE), "{cmd:?}");
  }
  assert_eq!(c.cmd(&["GET", "s"]), Reply::bulk("v"), "el string no cambió");
}

#[test]
fn comandos_de_string_sobre_una_lista() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "l", "a"]);
  assert_eq!(c.cmd(&["GET", "l"]), Reply::err(WRONGTYPE));
  assert_eq!(c.cmd(&["SET", "l", "x", "GET"]), Reply::err(WRONGTYPE));
  assert_eq!(c.cmd(&["LLEN", "l"]), Reply::Int(1), "la lista no cambió");
}
