mod common;
use common::*;
use std::time::Duration;

#[test]
fn comillas_dobles_y_simples() {
  let server = start();
  let mut c = connect(&server);
  c.send(b"ECHO \"hola mundo\"\r\n");
  assert_eq!(c.read(), Reply::bulk("hola mundo"));
  c.send(b"ECHO 'a b'\r\n");
  assert_eq!(c.read(), Reply::bulk("a b"));
}

#[test]
fn escapes() {
  let server = start();
  let mut c = connect(&server);
  // Entre comillas dobles: \n, \x41 y compañía.
  c.send(b"ECHO \"a\\nb\"\r\n");
  assert_eq!(c.read(), Reply::bulk("a\nb"));
  c.send(b"ECHO \"\\x41\\x42\"\r\n");
  assert_eq!(c.read(), Reply::bulk("AB"));
  // Entre comillas simples solo se escapa la comilla.
  c.send(b"ECHO 'it\\'s'\r\n");
  assert_eq!(c.read(), Reply::bulk("it's"));
  c.send(b"ECHO 'a\\nb'\r\n");
  assert_eq!(c.read(), Reply::bulk("a\\nb"));
}

#[test]
fn comillas_sin_cerrar() {
  let server = start();
  let mut c = connect(&server);
  c.send(b"ECHO \"abc\r\n");
  assert_eq!(c.read(), Reply::err("ERR Protocol error: unbalanced quotes in request"));
  assert!(c.is_closed(Duration::from_secs(1)), "después de un error de protocolo, Redis cierra la conexión");
}
