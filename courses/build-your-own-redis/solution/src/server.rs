//! El servidor: un hilo acepta conexiones y cada cliente tiene su hilo. La base está detrás de
//! un Mutex, así que los comandos se ejecutan de a uno, como en el Redis de un solo hilo.

use std::io;
use std::net::{SocketAddr, TcpListener};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::Duration;

use crate::Config;
use crate::conn;
use crate::db::{Db, now_ms};

pub struct Shared {
  pub db: Mutex<Db>,
  /// Avisa que la base cambió, para los clientes bloqueados (BLPOP).
  pub changed: Condvar,
  pub config: Config,
}

pub struct Server {
  addr: SocketAddr,
}

impl Server {
  pub fn start(addr: &str, config: Config) -> io::Result<Server> {
    let listener = TcpListener::bind(addr)?;
    let addr = listener.local_addr()?;
    let shared = Arc::new(Shared { db: Mutex::new(Db::default()), changed: Condvar::new(), config });

    let s = shared.clone();
    thread::spawn(move || {
      for stream in listener.incoming().flatten() {
        let s = s.clone();
        thread::spawn(move || {
          let _ = conn::handle(stream, s);
        });
      }
    });

    // Expiración activa: Redis la corre 10 veces por segundo (hz 10).
    let s = shared.clone();
    thread::spawn(move || {
      loop {
        thread::sleep(Duration::from_millis(100));
        s.db.lock().unwrap().active_expire_cycle(now_ms());
      }
    });

    Ok(Server { addr })
  }

  pub fn addr(&self) -> SocketAddr {
    self.addr
  }
}
