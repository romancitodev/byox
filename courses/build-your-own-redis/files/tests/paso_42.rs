mod common;
use common::*;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn px_vence() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["SET", "k", "v", "PX", "200"]), Reply::ok());
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("v"));
  sleep(Duration::from_millis(300));
  assert_eq!(c.cmd(&["GET", "k"]), Reply::Nil);
}

#[test]
fn ex_en_segundos() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["SET", "k", "v", "EX", "100"]), Reply::ok());
  sleep(Duration::from_millis(300));
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("v"), "EX es en segundos, no en milisegundos");
}

#[test]
fn set_sin_vencimiento_lo_borra() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "k", "v", "PX", "150"]);
  c.cmd(&["SET", "k", "w"]);
  sleep(Duration::from_millis(250));
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("w"), "un SET sin EX ni PX deja la clave sin vencimiento");
}
