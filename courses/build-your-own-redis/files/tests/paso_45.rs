mod common;
use common::*;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn expire_y_pexpire() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "k", "v"]);
  assert_eq!(c.cmd(&["PEXPIRE", "k", "200"]), Reply::Int(1));
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("v"));
  sleep(Duration::from_millis(300));
  assert_eq!(c.cmd(&["GET", "k"]), Reply::Nil);
}

#[test]
fn sobre_una_clave_que_no_existe() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["EXPIRE", "nada", "10"]), Reply::Int(0));
  c.cmd(&["SET", "k", "v"]);
  assert_eq!(c.cmd(&["EXPIRE", "k", "abc"]), Reply::err("ERR value is not an integer or out of range"));
  assert_eq!(c.cmd(&["EXPIRE", "k", "100"]), Reply::Int(1));
  sleep(Duration::from_millis(200));
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("v"), "EXPIRE es en segundos");
}
