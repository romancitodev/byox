mod common;
use common::*;

#[test]
fn ping_con_mensaje() {
  let server = start();
  let mut c = connect(&server);
  c.send(&encode_command(&[b"PING", b"hola"]));
  // Con argumento, PING responde un bulk string, no un simple string.
  assert_eq!(c.read_raw(), b"$4\r\nhola\r\n");
}
