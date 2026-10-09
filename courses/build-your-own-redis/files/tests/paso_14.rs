mod common;
use common::*;

#[test]
fn responde_pong() {
  let server = start();
  let mut c = connect(&server);
  c.send(b"*1\r\n$4\r\nPING\r\n");
  assert_eq!(c.read_raw(), b"+PONG\r\n");
}

#[test]
fn sin_importar_mayusculas() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["ping"]), Reply::simple("PONG"));
  assert_eq!(c.cmd(&["PiNg"]), Reply::simple("PONG"));
}
