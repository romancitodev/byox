//! `cargo run -- --port 6380` levanta tu servidor para probarlo con `redis-cli -p 6380`.
//! Acepta los mismos nombres de opción que `redis-server`. No hace falta que lo toques.

use std::path::PathBuf;

use miredis::{Config, Server};

fn main() {
  let mut config = Config::default();
  let mut bind = "127.0.0.1".to_string();
  let mut port = 6379u16;

  let mut args = std::env::args().skip(1);
  while let Some(flag) = args.next() {
    let mut value = || args.next().unwrap_or_else(|| fail(&format!("falta el valor de {flag}")));
    match flag.as_str() {
      "--port" => port = value().parse().unwrap_or_else(|_| fail("--port tiene que ser un número")),
      "--bind" => bind = value(),
      "--dir" => config.dir = PathBuf::from(value()),
      "--dbfilename" => config.dbfilename = value(),
      "--appendonly" => config.appendonly = value() == "yes",
      "--appenddirname" => config.appenddirname = value(),
      "--appendfilename" => config.appendfilename = value(),
      "--requirepass" => config.requirepass = Some(value()),
      "--replicaof" => {
        // Como en redis-server: --replicaof "host port"
        let v = value();
        let (host, p) = v.split_once(' ').unwrap_or_else(|| fail("--replicaof espera \"host port\""));
        config.replicaof = Some((host.to_string(), p.parse().unwrap_or_else(|_| fail("puerto inválido"))));
      }
      other => fail(&format!("opción desconocida: {other}")),
    }
  }

  let server = Server::start(&format!("{bind}:{port}"), config).unwrap_or_else(|e| fail(&e.to_string()));
  println!("miredis escuchando en {}", server.addr());
  loop {
    std::thread::park();
  }
}

fn fail(msg: &str) -> ! {
  eprintln!("{msg}");
  std::process::exit(1);
}
