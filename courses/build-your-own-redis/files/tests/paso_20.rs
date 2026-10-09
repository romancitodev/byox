mod common;
use common::*;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn llega_de_a_pedazos() {
  let server = start();
  let mut c = connect(&server);
  let cmd = encode_command(&[b"ECHO", b"partido"]);
  let (a, b) = cmd.split_at(9);
  c.send(a);
  assert_eq!(c.try_read(Duration::from_millis(200)), None, "respondió antes de recibir el comando entero");
  c.send(b);
  assert_eq!(c.read(), Reply::bulk("partido"));
}

#[test]
fn byte_por_byte() {
  let server = start();
  let mut c = connect(&server);
  for byte in encode_command(&[b"ECHO", b"lento"]) {
    c.send(&[byte]);
    sleep(Duration::from_millis(2));
  }
  assert_eq!(c.read(), Reply::bulk("lento"));
}
