mod common;
use common::*;

#[test]
fn sin_clave_o_sin_vencimiento() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["TTL", "nada"]), Reply::Int(-2));
  assert_eq!(c.cmd(&["PTTL", "nada"]), Reply::Int(-2));
  c.cmd(&["SET", "p", "v"]);
  assert_eq!(c.cmd(&["TTL", "p"]), Reply::Int(-1));
}

#[test]
fn cuanto_falta() {
  let server = start();
  let mut c = connect(&server);
  c.cmd(&["SET", "k", "v", "EX", "100"]);
  assert_eq!(c.cmd(&["TTL", "k"]), Reply::Int(100));
  match c.cmd(&["PTTL", "k"]) {
    Reply::Int(ms) => assert!((99_000..=100_000).contains(&ms), "PTTL dio {ms}"),
    other => panic!("PTTL respondió {other:?}"),
  }
}

#[test]
fn ttl_redondea() {
  let server = start();
  let mut c = connect(&server);
  // Con ~1.6 s por delante, TTL redondea a 2, como en expire.c: (ms + 500) / 1000.
  c.cmd(&["SET", "k", "v", "PX", "1600"]);
  assert_eq!(c.cmd(&["TTL", "k"]), Reply::Int(2));
  c.cmd(&["SET", "j", "v", "PX", "1400"]);
  assert_eq!(c.cmd(&["TTL", "j"]), Reply::Int(1));
}
