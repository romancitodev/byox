mod common;
use common::*;

#[test]
fn el_tipo_de_cada_clave() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "s", "v"]);
  c.cmd(&["RPUSH", "l", "a"]);
  c.send(&encode_command(&[b"TYPE", b"l"]));
  assert_eq!(c.read_raw(), b"+list\r\n");
  assert_eq!(c.cmd(&["TYPE", "s"]), Reply::simple("string"));
  assert_eq!(c.cmd(&["TYPE", "nada"]), Reply::simple("none"));
}

#[test]
fn set_pisa_cualquier_tipo() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["RPUSH", "k", "a"]);
  assert_eq!(c.cmd(&["SET", "k", "otra"]), Reply::ok());
  assert_eq!(c.cmd(&["TYPE", "k"]), Reply::simple("string"));
}
