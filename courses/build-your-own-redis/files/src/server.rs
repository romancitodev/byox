//! El servidor: acepta conexiones, lee comandos y responde. Casi todo el curso pasa por acá.

use std::io;
use std::net::SocketAddr;

use crate::Config;

/// Un servidor corriendo. Lo que necesites guardar (la base, los clientes, las réplicas) va acá
/// o en módulos nuevos: los tests solo usan `start` y `addr`.
pub struct Server {
  addr: SocketAddr,
}

impl Server {
  /// Empieza a escuchar en `addr` (por ejemplo `127.0.0.1:0`, que elige un puerto libre)
  /// y atiende a los clientes en segundo plano. Vuelve enseguida, sin bloquear.
  pub fn start(addr: &str, config: Config) -> io::Result<Server> {
    todo!("etapa 13")
  }

  /// La dirección en la que quedó escuchando.
  pub fn addr(&self) -> SocketAddr {
    self.addr
  }
}
