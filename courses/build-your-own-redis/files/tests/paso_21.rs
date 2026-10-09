mod common;
use common::*;

#[test]
fn como_por_telnet() {
  let server = start();
  let mut c = connect(&server);
  c.send(b"PING\r\n");
  assert_eq!(c.read_raw(), b"+PONG\r\n");
  c.send(b"ECHO   hola\r\n");
  assert_eq!(c.read(), Reply::bulk("hola"));
}

#[test]
fn solo_salto_de_linea() {
  let server = start();
  let mut c = connect(&server);
  c.send(b"PING\n");
  assert_eq!(c.read(), Reply::simple("PONG"));
}

#[test]
fn mezclado_con_resp() {
  let server = start();
  let mut c = connect(&server);
  c.send(b"PING\r\n*2\r\n$4\r\nECHO\r\n$2\r\nok\r\nECHO chau\r\n");
  assert_eq!(c.read(), Reply::simple("PONG"));
  assert_eq!(c.read(), Reply::bulk("ok"));
  assert_eq!(c.read(), Reply::bulk("chau"));
}
