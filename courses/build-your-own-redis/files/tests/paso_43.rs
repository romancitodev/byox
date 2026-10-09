mod common;
use common::*;
use std::thread::sleep;
use std::time::Duration;

#[test]
fn una_clave_vencida_no_existe() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "k", "v", "PX", "100"]);
  sleep(Duration::from_millis(200));
  assert_eq!(c.cmd(&["EXISTS", "k"]), Reply::Int(0));
  assert_eq!(c.cmd(&["EXISTS", "k", "k"]), Reply::Int(0));
}

#[test]
fn se_puede_volver_a_crear() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "k", "vieja", "PX", "100"]);
  sleep(Duration::from_millis(200));
  // Para NX, una clave vencida es una clave que no existe.
  assert_eq!(c.cmd(&["SET", "k", "nueva", "NX"]), Reply::ok());
  assert_eq!(c.cmd(&["GET", "k"]), Reply::bulk("nueva"));
}
