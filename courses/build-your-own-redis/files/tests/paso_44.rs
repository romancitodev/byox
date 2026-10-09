mod common;
use common::*;

#[test]
fn tiempos_invalidos() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["SET", "k", "v", "EX", "0"]), Reply::err("ERR invalid expire time in 'set' command"));
  assert_eq!(c.cmd(&["SET", "k", "v", "EX", "-1"]), Reply::err("ERR invalid expire time in 'set' command"));
  assert_eq!(c.cmd(&["SET", "k", "v", "PX", "0"]), Reply::err("ERR invalid expire time in 'set' command"));
  assert_eq!(c.cmd(&["SET", "k", "v", "EX", "abc"]), Reply::err("ERR value is not an integer or out of range"));
  assert_eq!(c.cmd(&["GET", "k"]), Reply::Nil);
}

#[test]
fn opciones_mal_combinadas() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["SET", "k", "v", "EX"]), Reply::err("ERR syntax error"));
  assert_eq!(c.cmd(&["SET", "k", "v", "EX", "10", "PX", "100"]), Reply::err("ERR syntax error"));
}
