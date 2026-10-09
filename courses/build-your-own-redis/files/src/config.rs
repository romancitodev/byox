//! La configuración del servidor. No hace falta que la toques: ya trae todo lo que usa el curso.
//!
//! Los nombres y los valores por defecto son los de `redis.conf`:
//! https://raw.githubusercontent.com/redis/redis/unstable/redis.conf

use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
  /// `dir`: dónde se leen y escriben el RDB y el AOF.
  pub dir: PathBuf,
  /// `dbfilename`: el nombre del snapshot RDB adentro de `dir`.
  pub dbfilename: String,
  /// `appendonly`: si se registra cada escritura en el AOF.
  pub appendonly: bool,
  /// `appenddirname`: el directorio del AOF de varias partes, adentro de `dir`.
  pub appenddirname: String,
  /// `appendfilename`: el prefijo de los archivos del AOF.
  pub appendfilename: String,
  /// `replicaof <host> <port>`: si está, el servidor arranca como réplica de ese maestro.
  pub replicaof: Option<(String, u16)>,
  /// `requirepass`: la contraseña del usuario `default`.
  pub requirepass: Option<String>,
}

impl Default for Config {
  fn default() -> Self {
    Config {
      dir: PathBuf::from("."),
      dbfilename: "dump.rdb".into(),
      appendonly: false,
      appenddirname: "appendonlydir".into(),
      appendfilename: "appendonly.aof".into(),
      replicaof: None,
      requirepass: None,
    }
  }
}
