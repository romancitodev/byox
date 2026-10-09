mod common;
use common::*;
use std::net::TcpStream;

#[test]
fn escucha_en_un_puerto_libre() {
  let server = start();
  assert_ne!(server.addr().port(), 0, "addr() tiene que devolver el puerto real, no el 0 que se pidió");
  TcpStream::connect(server.addr()).expect("no me pude conectar");
}

#[test]
fn varios_servidores_a_la_vez() {
  let a = start();
  let b = start();
  assert_ne!(a.addr(), b.addr());
}

#[test]
fn un_puerto_ocupado_es_un_error() {
  let a = start();
  let addr = a.addr().to_string();
  assert!(Server::start(&addr, Config::default()).is_err(), "el puerto {addr} ya está en uso");
}
