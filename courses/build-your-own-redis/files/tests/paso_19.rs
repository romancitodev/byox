mod common;
use common::*;

#[test]
fn dos_comandos_en_un_paquete() {
  let server = start();
  let mut c = connect(&server);
  c.send(b"*1\r\n$4\r\nPING\r\n*2\r\n$4\r\nECHO\r\n$1\r\nx\r\n");
  assert_eq!(c.read(), Reply::simple("PONG"));
  assert_eq!(c.read(), Reply::bulk("x"));
}

#[test]
fn cien_comandos_de_una() {
  let server = start();
  let mut c = connect(&server);
  let mut batch = Vec::new();
  for i in 0..100 {
    batch.extend(encode_command(&[b"ECHO", i.to_string().as_bytes()]));
  }
  c.send(&batch);
  for i in 0..100 {
    assert_eq!(c.read(), Reply::bulk(&i.to_string()), "las respuestas tienen que llegar en orden");
  }
}
