mod common;
use common::*;

#[test]
fn devuelve_el_argumento() {
  let server = start();
  let mut c = connect(&server);
  c.send(&encode_command(&[b"ECHO", b"hola"]));
  assert_eq!(c.read_raw(), b"$4\r\nhola\r\n");
  assert_eq!(c.cmd(&["echo", "hola mundo"]), Reply::bulk("hola mundo"));
}

#[test]
fn bytes_cualesquiera() {
  let server = start();
  let mut c = connect(&server);
  let raro: &[u8] = b"a\r\nb\x00\xff";
  assert_eq!(c.cmd_bytes(&[b"ECHO", raro]), Reply::Bulk(raro.to_vec()));
  assert_eq!(c.cmd_bytes(&[b"ECHO", b""]), Reply::Bulk(Vec::new()));
}
