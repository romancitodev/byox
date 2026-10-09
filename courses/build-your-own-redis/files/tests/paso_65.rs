mod common;
use common::*;
use std::thread::sleep;
use std::time::{Duration, Instant};

#[test]
fn se_vence_el_tiempo() {
  let server = start();
  let mut c = connect(&server);
  let t = Instant::now();
  assert_eq!(c.cmd(&["BLPOP", "vacia", "0.3"]), Reply::NilArray);
  let dt = t.elapsed();
  assert!(dt >= Duration::from_millis(280) && dt < Duration::from_millis(1500), "tardó {dt:?}");
}

#[test]
fn cero_es_para_siempre() {
  let server = start();
  let mut esperando = connect(&server);
  let mut otro = connect(&server);
  esperando.send(&encode_command(&[b"BLPOP", b"cola", b"0"]));
  assert_eq!(esperando.try_read(Duration::from_millis(600)), None);
  otro.cmd(&["RPUSH", "cola", "tarde"]);
  assert_eq!(esperando.read(), Reply::strs(&["cola", "tarde"]));
}

#[test]
fn timeouts_invalidos() {
  let server = start();
  let mut c = connect(&server);
  assert_eq!(c.cmd(&["BLPOP", "cola", "-1"]), Reply::err("ERR timeout is negative"));
  assert_eq!(c.cmd(&["BLPOP", "cola", "abc"]), Reply::err("ERR timeout is not a float or out of range"));
  assert_eq!(c.cmd(&["BLPOP", "cola"]), Reply::err("ERR wrong number of arguments for 'blpop' command"));
}

#[test]
fn los_comandos_que_siguen_esperan_su_turno() {
  let server = start();
  let mut c = connect(&server);
  // Un cliente bloqueado no procesa lo que mandó después hasta desbloquearse.
  c.send(&encode_command(&[b"BLPOP", b"w", b"0.3"]));
  c.send(&encode_command(&[b"PING"]));
  sleep(Duration::from_millis(100));
  assert_eq!(c.read(), Reply::NilArray);
  assert_eq!(c.read(), Reply::simple("PONG"));
}
